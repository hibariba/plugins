#!/usr/bin/env bun
/**
 * fetch-llmstxt.ts - Parse llms.txt URL into structured JSON
 *
 * Usage:
 *   bun run fetch-llmstxt.ts <url> [output-file]
 *
 * Arguments:
 *   url         - URL to llms.txt file (required)
 *   output-file - Path to write JSON output (optional, prints to stdout if omitted)
 *
 * Output JSON:
 *   { title: string, skillName: string, links: Array<{name, url, description}> }
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid arguments or usage error
 *   2 - Network error (fetch failed)
 *   3 - Parse error (invalid llms.txt format)
 *   4 - Write error (cannot write output file)
 */

import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

// ============================================================================
// Types
// ============================================================================

interface Link {
  name: string;
  url: string;
  description: string;
}

interface LlmsTxtResult {
  title: string;
  skillName: string;
  links: Link[];
  sourceUrl: string;
  fetchedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function printUsage(): void {
  console.error(`
Usage: bun run fetch-llmstxt.ts <url> [output-file]

Arguments:
  url         - URL to llms.txt file (required)
  output-file - Path to write JSON output (optional)

Examples:
  bun run fetch-llmstxt.ts https://example.com/llms.txt
  bun run fetch-llmstxt.ts https://example.com/llms.txt /tmp/data.json

Exit codes:
  0 - Success
  1 - Invalid arguments
  2 - Network error
  3 - Parse error
  4 - Write error
`);
}

function validateUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function deriveSkillName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed-skill';
}

function deriveFileName(linkUrl: string, linkTitle: string): string {
  try {
    const urlPath = new URL(linkUrl).pathname;
    const fileName = urlPath.split('/').pop() || '';
    const name = fileName.replace(/\.md$/, '');
    if (name && name.length > 0) {
      return name;
    }
  } catch {
    // Fall through to title-based name
  }

  return linkTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed';
}

// ============================================================================
// Core Logic
// ============================================================================

async function fetchLlmsTxt(url: URL): Promise<LlmsTxtResult> {
  // Fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'llmstxt-to-skill/1.0 (Claude Code Plugin)',
        'Accept': 'text/plain, text/markdown, */*'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after 30 seconds`);
    }
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const content = await response.text();

  if (!content || content.trim().length === 0) {
    throw new Error('Empty response from server');
  }

  const lines = content.split('\n');

  // Extract title from first heading
  let title = 'Untitled';
  for (const line of lines) {
    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      break;
    }
  }

  // Parse links in format: - [Title](url): description
  // Also supports: - [Title](url)
  const links: Link[] = [];
  const linkRegex = /^-\s*\[([^\]]+)\]\(([^)]+)\)(?::\s*(.*))?$/;

  for (const line of lines) {
    const match = line.match(linkRegex);
    if (match) {
      const [, linkTitle, linkUrl, description] = match;

      // Validate URL
      try {
        new URL(linkUrl);
      } catch {
        console.error(`Warning: Skipping invalid URL: ${linkUrl}`);
        continue;
      }

      links.push({
        name: deriveFileName(linkUrl, linkTitle),
        url: linkUrl,
        description: (description?.trim() || linkTitle).slice(0, 500) // Limit description length
      });
    }
  }

  if (links.length === 0) {
    throw new Error('No valid links found in llms.txt - expected format: - [Title](url): description');
  }

  return {
    title,
    skillName: deriveSkillName(title),
    links,
    sourceUrl: url.toString(),
    fetchedAt: new Date().toISOString()
  };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const urlArg = args[0];
  const outputFile = args[1];

  // Validate URL
  const url = validateUrl(urlArg);
  if (!url) {
    console.error(`Error: Invalid URL: ${urlArg}`);
    console.error('URL must start with http:// or https://');
    process.exit(1);
  }

  // Validate output directory exists (if output file specified)
  if (outputFile) {
    const dir = dirname(outputFile);
    if (dir !== '.' && !existsSync(dir)) {
      console.error(`Error: Output directory does not exist: ${dir}`);
      process.exit(4);
    }
  }

  // Fetch and parse
  let result: LlmsTxtResult;
  try {
    console.error(`Fetching ${url}...`);
    result = await fetchLlmsTxt(url);
    console.error(`Found: "${result.title}" with ${result.links.length} links`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Network') || message.includes('HTTP') || message.includes('timeout')) {
      console.error(`Error: Failed to fetch URL: ${message}`);
      process.exit(2);
    } else {
      console.error(`Error: Failed to parse llms.txt: ${message}`);
      process.exit(3);
    }
  }

  // Output
  const json = JSON.stringify(result, null, 2);

  if (outputFile) {
    try {
      await writeFile(outputFile, json, 'utf-8');
      console.error(`Wrote ${result.links.length} links to ${outputFile}`);
    } catch (error) {
      console.error(`Error: Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(4);
    }
  } else {
    console.log(json);
  }
}

main().catch((error) => {
  console.error(`Unexpected error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
