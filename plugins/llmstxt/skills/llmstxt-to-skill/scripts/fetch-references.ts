#!/usr/bin/env bun
/**
 * fetch-references.ts
 *
 * Downloads all linked documents from an llms.txt parse result.
 *
 * Usage: bun run fetch-references.ts '<json>' <output-dir>
 *
 * Input: JSON string with links array from fetch-llmstxt.ts
 * Output: Downloads files to output-dir, prints summary
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

interface Link {
  name: string;
  url: string;
  description: string;
}

interface FetchResult {
  success: number;
  failed: number;
  warnings: string[];
}

async function fetchReferences(links: Link[], outputDir: string): Promise<FetchResult> {
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  const result: FetchResult = {
    success: 0,
    failed: 0,
    warnings: []
  };

  // Fetch each link with concurrency limit
  const concurrency = 5;
  const chunks: Link[][] = [];

  for (let i = 0; i < links.length; i += concurrency) {
    chunks.push(links.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (link) => {
      try {
        const response = await fetch(link.url);

        if (!response.ok) {
          result.failed++;
          result.warnings.push(`${link.name}: HTTP ${response.status}`);
          return;
        }

        const content = await response.text();
        const fileName = `${link.name}.md`;
        const filePath = join(outputDir, fileName);

        // Add frontmatter with source info
        const fileContent = `---
source: ${link.url}
description: ${link.description}
---

${content}`;

        await writeFile(filePath, fileContent, 'utf-8');
        result.success++;

      } catch (error) {
        result.failed++;
        const message = error instanceof Error ? error.message : String(error);
        result.warnings.push(`${link.name}: ${message}`);
      }
    }));
  }

  return result;
}

// Main execution
const jsonInput = process.argv[2];
const outputDir = process.argv[3];

if (!jsonInput || !outputDir) {
  console.error('Usage: bun run fetch-references.ts \'<json>\' <output-dir>');
  console.error('  json: JSON string with links array from fetch-llmstxt.ts');
  console.error('  output-dir: Directory to save fetched documents');
  process.exit(1);
}

try {
  const data = JSON.parse(jsonInput);
  const links: Link[] = data.links || data;

  if (!Array.isArray(links)) {
    throw new Error('Input must contain a links array');
  }

  console.error(`Fetching ${links.length} references...`);

  const result = await fetchReferences(links, outputDir);

  // Output summary as JSON
  console.log(JSON.stringify({
    total: links.length,
    success: result.success,
    failed: result.failed,
    warnings: result.warnings
  }, null, 2));

  if (result.failed > 0) {
    console.error(`\nWarnings (${result.failed}):`);
    result.warnings.forEach(w => console.error(`  - ${w}`));
  }

} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
