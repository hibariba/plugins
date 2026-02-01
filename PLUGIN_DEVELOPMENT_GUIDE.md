# Plugin Development Guide

Best practices learned from production issues. Follow these to avoid common bugs.

## Golden Rules

### 1. Never Pass Complex Data via CLI Arguments

**Problem:** Shell escaping breaks with quotes, apostrophes, backticks, newlines.

```bash
# BROKEN - will fail with special characters
bun run script.ts '{"text": "Claude's response"}'

# CORRECT - use file-based data passing
bun run script.ts --input /tmp/data.json --output /tmp/result.json
```

**Pattern for scripts:**
```typescript
// Read input from file, not argument
const inputFile = process.argv[2];
const data = JSON.parse(await readFile(inputFile, 'utf-8'));

// Write output to file, not stdout (for complex data)
await writeFile(outputFile, JSON.stringify(result), 'utf-8');
```

### 2. Defensive Script Template

Every script should include:

```typescript
#!/usr/bin/env bun
/**
 * script-name.ts - Brief description
 *
 * Usage:
 *   bun run script-name.ts <input-file> <output-dir>
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid arguments
 *   2 - Input file error
 *   3 - Output directory error
 *   4 - Processing error
 */

import { existsSync } from 'fs';
import { readFile, writeFile, access, constants } from 'fs/promises';

function printUsage(): void {
  console.error(`
Usage: bun run script-name.ts <input-file> <output-dir>

Arguments:
  input-file  - Path to JSON input file
  output-dir  - Directory for output

Exit codes:
  0 - Success
  1 - Invalid arguments
  2 - Input error
  3 - Output error
  4 - Processing error
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Validate arguments
  if (args.length < 2) {
    console.error('Error: Missing required arguments');
    printUsage();
    process.exit(1);
  }

  const [inputFile, outputDir] = args;

  // Validate input file
  if (!existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`);
    process.exit(2);
  }

  // Validate output directory
  if (!existsSync(outputDir)) {
    console.error(`Error: Output directory not found: ${outputDir}`);
    process.exit(3);
  }

  try {
    await access(outputDir, constants.W_OK);
  } catch {
    console.error(`Error: Output directory not writable: ${outputDir}`);
    process.exit(3);
  }

  // Main logic with try-catch
  try {
    const data = JSON.parse(await readFile(inputFile, 'utf-8'));
    // ... process data ...
    console.error('Success: Processed X items'); // Progress to stderr
    console.log(JSON.stringify(result)); // Data to stdout
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    process.exit(4);
  }
}

main().catch((e) => {
  console.error(`Unexpected error: ${e}`);
  process.exit(1);
});
```

### 3. Cross-Platform Compatibility

```typescript
// Sanitize filenames for all platforms
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') // Windows + Unix invalid chars
    .replace(/^\.+/, '')                      // No leading dots (hidden on Unix)
    .replace(/\.+$/, '')                      // No trailing dots (Windows issue)
    .replace(/-+/g, '-')                      // Collapse multiple dashes
    .slice(0, 200)                            // Length limit
    || 'unnamed';
}

// Use path.join, not string concatenation
import { join } from 'path';
const filePath = join(outputDir, fileName); // Correct
// const filePath = `${outputDir}/${fileName}`; // Wrong on Windows
```

### 4. Network Requests with Timeout

```typescript
async function fetchWithTimeout(url: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'my-plugin/1.0 (Claude Code Plugin)',
        'Accept': 'text/plain, text/markdown, */*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

### 5. Graceful Degradation for Batch Operations

```typescript
// Don't fail everything if one item fails
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<{ success: R[]; failed: { item: T; error: string }[] }> {
  const success: R[] = [];
  const failed: { item: T; error: string }[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(processor));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        success.push(result.value);
      } else {
        failed.push({
          item: batch[j],
          error: result.reason?.message || 'Unknown error'
        });
      }
    }

    // Progress indicator
    console.error(`Progress: ${Math.min(i + concurrency, items.length)}/${items.length}`);
  }

  return { success, failed };
}
```

## Pre-Release Checklist

Before committing any plugin:

### Structure Validation
- [ ] `jq empty .claude-plugin/plugin.json` passes
- [ ] All required fields in plugin.json present
- [ ] SKILL.md has valid frontmatter (name, description)

### Script Validation
- [ ] Each script has `--help` that works
- [ ] Each script has documented exit codes
- [ ] Each script validates inputs before processing
- [ ] No CLI arguments contain user-generated content (use files)

### Integration Testing
- [ ] Test through Claude Code: `claude --plugin-dir /path/to/plugin`
- [ ] Test the actual skill trigger phrases
- [ ] Test with edge cases:
  - [ ] Content with apostrophes (`Claude's`)
  - [ ] Content with quotes (`"quoted"`)
  - [ ] Content with backticks (`` `code` ``)
  - [ ] Very long content (>10KB)
  - [ ] Empty/missing content

### Cross-Platform
- [ ] No hardcoded paths (use `${CLAUDE_PLUGIN_ROOT}`)
- [ ] Filenames sanitized
- [ ] Uses `path.join` not string concatenation

## Common Failure Patterns

| Pattern | Problem | Solution |
|---------|---------|----------|
| JSON as CLI arg | Shell escaping breaks | Use temp files |
| Hardcoded `/tmp` | May not exist on Windows | Use configurable temp |
| No timeout on fetch | Hangs indefinitely | 30s AbortController |
| All-or-nothing batch | One failure kills all | Graceful degradation |
| Silent failures | User confused | Clear error messages |
| No progress indicator | Seems frozen | Print to stderr |

## Testing Script

Quick validation script for plugins:

```bash
#!/bin/bash
# validate-plugin.sh <plugin-dir>

PLUGIN_DIR="${1:-.}"

echo "=== Plugin Validation ==="

# Check structure
echo -n "plugin.json valid: "
jq empty "$PLUGIN_DIR/.claude-plugin/plugin.json" 2>/dev/null && echo "✓" || echo "✗"

# Check scripts have --help
for script in "$PLUGIN_DIR"/**/scripts/*.ts; do
  [ -f "$script" ] || continue
  echo -n "$(basename $script) --help: "
  bun run "$script" --help >/dev/null 2>&1 && echo "✓" || echo "✗"
done

# Check SKILL.md frontmatter
for skill in "$PLUGIN_DIR"/**/SKILL.md; do
  [ -f "$skill" ] || continue
  echo -n "$(dirname $skill | xargs basename) frontmatter: "
  head -10 "$skill" | grep -q "^name:" && echo "✓" || echo "✗"
done

echo "=== Done ==="
```

## Recommended Workflow

1. **Design** - Decide on file-based IPC upfront
2. **Template** - Copy defensive script template
3. **Implement** - Build with validation from start
4. **Unit Test** - Test scripts directly with edge cases
5. **Integration Test** - Test through `claude --plugin-dir`
6. **Validate** - Run validation script
7. **Release** - Commit and push
8. **Monitor** - Watch for user issues

---

*This guide was created after the llmstxt shell escaping bug. Update it as new patterns emerge.*
