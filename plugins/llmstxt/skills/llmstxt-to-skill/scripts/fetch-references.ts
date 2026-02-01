#!/usr/bin/env bun
/**
 * fetch-references.ts - Download all linked documents from llms.txt
 *
 * Usage:
 *   bun run fetch-references.ts <json-file> <output-dir>
 *
 * Arguments:
 *   json-file  - Path to JSON file from fetch-llmstxt.ts (required)
 *   output-dir - Directory to save fetched documents (required)
 *
 * Exit codes:
 *   0 - Success (all or some files fetched)
 *   1 - Invalid arguments or usage error
 *   2 - JSON file read/parse error
 *   3 - Output directory error
 *   4 - All fetches failed (complete failure)
 */

import { mkdir, writeFile, readFile, access, constants } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

interface Link {
  name: string;
  url: string;
  description: string;
}

interface InputData {
  title?: string;
  skillName?: string;
  links: Link[];
}

interface FetchResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  warnings: string[];
  files: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function printUsage(): void {
  console.error(`
Usage: bun run fetch-references.ts <json-file> <output-dir>

Arguments:
  json-file  - Path to JSON file from fetch-llmstxt.ts
  output-dir - Directory to save fetched documents

Examples:
  bun run fetch-references.ts /tmp/data.json ./references
  bun run fetch-references.ts data.json ~/.claude/skills/my-skill/references

Exit codes:
  0 - Success (all or some files fetched)
  1 - Invalid arguments
  2 - JSON file error
  3 - Output directory error
  4 - All fetches failed
`);
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') // Remove invalid chars
    .replace(/^\.+/, '')                      // No leading dots
    .replace(/\.+$/, '')                      // No trailing dots
    .replace(/-+/g, '-')                      // Collapse dashes
    .slice(0, 200)                            // Limit length
    || 'unnamed';
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

async function isWritable(dir: string): Promise<boolean> {
  try {
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Core Logic
// ============================================================================

async function fetchSingleReference(
  link: Link,
  outputDir: string,
  timeoutMs: number = 30000
): Promise<{ success: boolean; file?: string; error?: string }> {
  const fileName = `${sanitizeFileName(link.name)}.md`;
  const filePath = join(outputDir, fileName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(link.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'llmstxt-to-skill/1.0 (Claude Code Plugin)',
        'Accept': 'text/plain, text/markdown, */*'
      }
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      return { success: false, error: 'Empty response' };
    }

    // Add frontmatter with metadata
    const fileContent = `---
source: ${link.url}
title: ${link.name}
description: ${link.description.replace(/\n/g, ' ').slice(0, 200)}
fetched: ${new Date().toISOString()}
---

${content}`;

    await writeFile(filePath, fileContent, 'utf-8');
    return { success: true, file: fileName };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Timeout (30s)' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchReferences(links: Link[], outputDir: string): Promise<FetchResult> {
  const result: FetchResult = {
    total: links.length,
    success: 0,
    failed: 0,
    skipped: 0,
    warnings: [],
    files: []
  };

  // Validate links
  const validLinks = links.filter(link => {
    if (!link.url || !link.name) {
      result.skipped++;
      result.warnings.push(`Skipped: Missing URL or name`);
      return false;
    }
    try {
      new URL(link.url);
      return true;
    } catch {
      result.skipped++;
      result.warnings.push(`Skipped: Invalid URL: ${link.url}`);
      return false;
    }
  });

  // Fetch in batches with concurrency limit
  const concurrency = 5;
  const batches: Link[][] = [];

  for (let i = 0; i < validLinks.length; i += concurrency) {
    batches.push(validLinks.slice(i, i + concurrency));
  }

  let processed = 0;
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(link => fetchSingleReference(link, outputDir))
    );

    for (let i = 0; i < batchResults.length; i++) {
      processed++;
      const res = batchResults[i];
      const link = batch[i];

      if (res.success && res.file) {
        result.success++;
        result.files.push(res.file);
      } else {
        result.failed++;
        result.warnings.push(`${link.name}: ${res.error || 'Unknown error'}`);
      }

      // Progress indicator (to stderr so it doesn't pollute JSON output)
      if (processed % 10 === 0 || processed === validLinks.length) {
        console.error(`Progress: ${processed}/${validLinks.length} (${result.success} success, ${result.failed} failed)`);
      }
    }
  }

  return result;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help flag always exits 0
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Missing arguments
  if (args.length < 2) {
    console.error('Error: Missing required arguments');
    printUsage();
    process.exit(1);
  }

  const jsonFile = args[0];
  const outputDir = args[1];

  // Validate JSON file exists
  if (!existsSync(jsonFile)) {
    console.error(`Error: JSON file not found: ${jsonFile}`);
    process.exit(2);
  }

  // Read and parse JSON
  let data: InputData;
  try {
    const content = await readFile(jsonFile, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Error: Failed to read/parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(2);
  }

  // Validate data structure
  const links = data.links || (Array.isArray(data) ? data : null);
  if (!links || !Array.isArray(links)) {
    console.error('Error: JSON must contain a "links" array');
    console.error('Expected format: { "links": [{ "name": "...", "url": "...", "description": "..." }] }');
    process.exit(2);
  }

  if (links.length === 0) {
    console.error('Error: No links found in JSON file');
    process.exit(2);
  }

  // Create/validate output directory
  try {
    await ensureDir(outputDir);
    if (!await isWritable(outputDir)) {
      console.error(`Error: Output directory is not writable: ${outputDir}`);
      process.exit(3);
    }
  } catch (error) {
    console.error(`Error: Cannot create output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(3);
  }

  // Fetch all references
  console.error(`Fetching ${links.length} references to ${outputDir}...`);
  const result = await fetchReferences(links, outputDir);

  // Output result as JSON
  console.log(JSON.stringify(result, null, 2));

  // Summary to stderr
  console.error(`\nSummary: ${result.success}/${result.total} fetched`);
  if (result.failed > 0) {
    console.error(`  - ${result.failed} failed`);
  }
  if (result.skipped > 0) {
    console.error(`  - ${result.skipped} skipped`);
  }

  // Show first few warnings
  if (result.warnings.length > 0) {
    console.error(`\nWarnings (showing first 5):`);
    result.warnings.slice(0, 5).forEach(w => console.error(`  - ${w}`));
    if (result.warnings.length > 5) {
      console.error(`  ... and ${result.warnings.length - 5} more`);
    }
  }

  // Exit code based on success rate
  if (result.success === 0 && result.total > 0) {
    console.error('\nError: All fetches failed');
    process.exit(4);
  }
}

main().catch((error) => {
  console.error(`Unexpected error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
