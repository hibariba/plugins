#!/usr/bin/env bun
/**
 * validate-dependencies.ts - Validate dependencies across all plugins
 *
 * Usage:
 *   bun run scripts/validate-dependencies.ts [--json] [--check]
 *
 * Flags:
 *   --json   Output JSON only (no human-readable summary)
 *   --check  Exit with code 1 if any dependencies are missing
 *
 * Exit codes:
 *   0 - Success (all dependencies satisfied or no --check flag)
 *   1 - Missing dependencies (only with --check flag)
 *   2 - Script error
 */

import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

interface Dependency {
  type: 'runtime' | 'package' | 'system' | 'network';
  name: string;
  version?: string;
  required: boolean;
  satisfied: boolean;
  checkCommand?: string;
}

interface PluginDependencies {
  name: string;
  version: string;
  path: string;
  dependencies: Dependency[];
  scripts: string[];
  hasHooks: boolean;
  hasMcp: boolean;
}

interface ValidationResult {
  timestamp: string;
  pluginCount: number;
  plugins: PluginDependencies[];
  summary: {
    totalDependencies: number;
    satisfied: number;
    missing: number;
    runtimes: string[];
    systemTools: string[];
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function checkCommand(command: string): Promise<boolean> {
  const path = Bun.which(command);
  return path !== null;
}

async function getVersion(command: string, versionFlag: string = '--version'): Promise<string | undefined> {
  try {
    const proc = Bun.spawn([command, versionFlag], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const match = output.match(/\d+\.\d+\.\d+/);
    return match ? match[0] : 'installed';
  } catch {
    return undefined;
  }
}

async function detectDependencies(pluginPath: string): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  // Check for TypeScript/JavaScript files that use Bun
  const scripts: string[] = [];
  const skillsDir = join(pluginPath, 'skills');

  if (existsSync(skillsDir)) {
    const findTsFiles = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...await findTsFiles(fullPath));
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
            files.push(fullPath);
          }
        }
      } catch {
        // Directory read error, skip
      }
      return files;
    };

    scripts.push(...await findTsFiles(skillsDir));
  }

  // Check if any scripts have #!/usr/bin/env bun shebang
  let needsBun = false;
  for (const script of scripts) {
    try {
      const content = await readFile(script, 'utf-8');
      if (content.startsWith('#!/usr/bin/env bun')) {
        needsBun = true;
        break;
      }
    } catch {
      // File read error, skip
    }
  }

  if (needsBun) {
    const bunInstalled = await checkCommand('bun');
    deps.push({
      type: 'runtime',
      name: 'bun',
      version: bunInstalled ? await getVersion('bun', '--version') : undefined,
      required: true,
      satisfied: bunInstalled,
      checkCommand: 'bun --version'
    });
  }

  // Check for network requirements (llms.txt plugin needs network access)
  const skillFiles = scripts.filter(s => s.includes('fetch') || s.includes('download'));
  if (skillFiles.length > 0) {
    deps.push({
      type: 'network',
      name: 'network-access',
      required: true,
      satisfied: true, // Assume satisfied, can't easily test
      checkCommand: 'ping -c 1 example.com'
    });
  }

  // Check for package.json
  const packageJson = join(pluginPath, 'package.json');
  if (existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(await readFile(packageJson, 'utf-8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies
      };

      for (const [name, version] of Object.entries(allDeps)) {
        deps.push({
          type: 'package',
          name,
          version: version as string,
          required: true,
          satisfied: existsSync(join(pluginPath, 'node_modules', name))
        });
      }
    } catch {
      // Invalid package.json, skip
    }
  }

  return deps;
}

async function analyzePlugin(pluginPath: string): Promise<PluginDependencies | null> {
  const pluginJsonPath = join(pluginPath, '.claude-plugin', 'plugin.json');

  if (!existsSync(pluginJsonPath)) {
    return null;
  }

  try {
    const pluginJson = JSON.parse(await readFile(pluginJsonPath, 'utf-8'));
    const dependencies = await detectDependencies(pluginPath);

    // Find all script files
    const scripts: string[] = [];
    const scanForScripts = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.includes('node_modules')) {
            await scanForScripts(fullPath);
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.sh')) {
            scripts.push(fullPath.replace(pluginPath + '/', ''));
          }
        }
      } catch {
        // Directory read error, skip
      }
    };
    await scanForScripts(pluginPath);

    return {
      name: pluginJson.name || basename(pluginPath),
      version: pluginJson.version || '0.0.0',
      path: pluginPath,
      dependencies,
      scripts,
      hasHooks: existsSync(join(pluginPath, 'hooks', 'hooks.json')),
      hasMcp: existsSync(join(pluginPath, '.mcp.json'))
    };
  } catch (error) {
    console.error(`Error analyzing ${pluginPath}: ${error}`);
    return null;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const checkMode = args.includes('--check');

  const pluginsDir = join(process.cwd(), 'plugins');

  if (!existsSync(pluginsDir)) {
    console.error('Error: plugins/ directory not found');
    process.exit(2);
  }

  const entries = await readdir(pluginsDir, { withFileTypes: true });
  const pluginDirs = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => join(pluginsDir, e.name));

  const plugins: PluginDependencies[] = [];

  for (const dir of pluginDirs) {
    const analysis = await analyzePlugin(dir);
    if (analysis) {
      plugins.push(analysis);
    }
  }

  // Calculate summary
  const allDeps = plugins.flatMap(p => p.dependencies);
  const runtimes = [...new Set(
    allDeps.filter(d => d.type === 'runtime').map(d => d.name)
  )];
  const systemTools = [...new Set(
    allDeps.filter(d => d.type === 'system').map(d => d.name)
  )];

  const result: ValidationResult = {
    timestamp: new Date().toISOString(),
    pluginCount: plugins.length,
    plugins,
    summary: {
      totalDependencies: allDeps.length,
      satisfied: allDeps.filter(d => d.satisfied).length,
      missing: allDeps.filter(d => !d.satisfied).length,
      runtimes,
      systemTools
    }
  };

  // Output
  if (jsonOnly) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('# Dependency Validation Report\n');
    console.log(`Generated: ${new Date().toLocaleString()}`);
    console.log(`Plugins analyzed: ${result.pluginCount}\n`);

    console.log('## Summary\n');
    console.log(`Total dependencies: ${result.summary.totalDependencies}`);
    console.log(`✅ Satisfied: ${result.summary.satisfied}`);
    console.log(`❌ Missing: ${result.summary.missing}\n`);

    if (result.summary.runtimes.length > 0) {
      console.log('Runtimes required:', result.summary.runtimes.join(', '));
    }
    if (result.summary.systemTools.length > 0) {
      console.log('System tools required:', result.summary.systemTools.join(', '));
    }

    console.log('\n## Plugin Details\n');

    for (const plugin of result.plugins) {
      console.log(`### ${plugin.name} (v${plugin.version})`);

      if (plugin.dependencies.length === 0) {
        console.log('  No external dependencies ✅');
      } else {
        console.log(`  Dependencies: ${plugin.dependencies.length}`);
        for (const dep of plugin.dependencies) {
          const status = dep.satisfied ? '✅' : '❌';
          const version = dep.version ? ` (${dep.version})` : '';
          console.log(`    ${status} ${dep.type}: ${dep.name}${version}`);
        }
      }

      if (plugin.scripts.length > 0) {
        console.log(`  Scripts: ${plugin.scripts.length} file(s)`);
      }
      if (plugin.hasHooks) {
        console.log('  Has hooks: Yes');
      }
      if (plugin.hasMcp) {
        console.log('  Has MCP: Yes');
      }

      console.log('');
    }

    // Missing dependencies details
    const missing = plugins.filter(p =>
      p.dependencies.some(d => !d.satisfied)
    );

    if (missing.length > 0) {
      console.log('\n## Missing Dependencies\n');
      for (const plugin of missing) {
        const missingDeps = plugin.dependencies.filter(d => !d.satisfied);
        console.log(`${plugin.name}:`);
        for (const dep of missingDeps) {
          console.log(`  - ${dep.name} (${dep.type})`);
          if (dep.checkCommand) {
            console.log(`    Check: ${dep.checkCommand}`);
          }
        }
        console.log('');
      }
    }
  }

  // Exit with error if --check and missing deps
  if (checkMode && result.summary.missing > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(2);
});
