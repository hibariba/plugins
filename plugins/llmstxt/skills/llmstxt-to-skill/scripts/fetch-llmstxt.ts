#!/usr/bin/env bun
/**
 * fetch-llmstxt.ts
 *
 * Fetches an llms.txt URL and parses it into a structured format.
 *
 * Usage: bun run fetch-llmstxt.ts <url> [output-file]
 *
 * If output-file is provided, writes JSON there. Otherwise prints to stdout.
 */

import { writeFile } from 'fs/promises';

interface Link {
  name: string;
  url: string;
  description: string;
}

interface LlmsTxtResult {
  title: string;
  skillName: string;
  links: Link[];
}

async function fetchLlmsTxt(url: string): Promise<LlmsTxtResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
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

  // Derive skill name from title
  const skillName = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Parse links in format: - [Title](url): description
  const links: Link[] = [];
  const linkRegex = /^-\s*\[([^\]]+)\]\(([^)]+)\)(?::\s*(.*))?$/;

  for (const line of lines) {
    const match = line.match(linkRegex);
    if (match) {
      const [, linkTitle, linkUrl, description] = match;
      const urlPath = new URL(linkUrl).pathname;
      const fileName = urlPath.split('/').pop() || '';
      const name = fileName.replace(/\.md$/, '') ||
        linkTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      links.push({
        name,
        url: linkUrl,
        description: description?.trim() || linkTitle
      });
    }
  }

  return { title, skillName, links };
}

// Main
const url = process.argv[2];
const outputFile = process.argv[3];

if (!url) {
  console.error('Usage: bun run fetch-llmstxt.ts <url> [output-file]');
  process.exit(1);
}

try {
  const result = await fetchLlmsTxt(url);
  const json = JSON.stringify(result, null, 2);

  if (outputFile) {
    await writeFile(outputFile, json, 'utf-8');
    console.log(`Wrote to ${outputFile}`);
  } else {
    console.log(json);
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
