#!/usr/bin/env bun
/**
 * generate-skill.ts
 *
 * Generates a SKILL.md file from fetched references.
 *
 * Usage: bun run generate-skill.ts <skill-dir> <json-file>
 *
 * Reads title and links from json-file, creates SKILL.md in skill-dir.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface Link {
  name: string;
  url: string;
  description: string;
}

async function generateSkill(skillDir: string, jsonFile: string): Promise<void> {
  // Read the JSON data
  const jsonContent = await readFile(jsonFile, 'utf-8');
  const data = JSON.parse(jsonContent);

  const title: string = data.title || 'Untitled';
  const links: Link[] = data.links || [];

  const referencesDir = join(skillDir, 'references');

  // Read all reference files to build context
  let referenceFiles: string[] = [];
  try {
    referenceFiles = await readdir(referencesDir);
  } catch {
    // No references yet
  }

  // Build descriptions from links for trigger phrases
  const topics = links
    .slice(0, 10)
    .map(l => l.description.split('.')[0])
    .filter(d => d.length > 0 && d.length < 100);

  // Derive skill name
  const skillName = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const triggerPhrases = topics.slice(0, 5).join(', ');

  // Create reference list
  const referenceList = links
    .map(l => `- [${l.name}](references/${l.name}.md): ${l.description}`)
    .join('\n');

  // Categorize links
  const categories = new Map<string, string[]>();
  for (const link of links) {
    const desc = link.description.toLowerCase();
    if (desc.includes('setup') || desc.includes('install') || desc.includes('start')) {
      categories.set('Getting Started', [...(categories.get('Getting Started') || []), link.name]);
    } else if (desc.includes('config') || desc.includes('setting')) {
      categories.set('Configuration', [...(categories.get('Configuration') || []), link.name]);
    } else if (desc.includes('api') || desc.includes('reference')) {
      categories.set('Reference', [...(categories.get('Reference') || []), link.name]);
    } else if (desc.includes('example') || desc.includes('tutorial') || desc.includes('guide')) {
      categories.set('Guides', [...(categories.get('Guides') || []), link.name]);
    } else {
      categories.set('Core Concepts', [...(categories.get('Core Concepts') || []), link.name]);
    }
  }

  const categorySummary = Array.from(categories.entries())
    .map(([cat, items]) => `- **${cat}**: ${items.slice(0, 5).join(', ')}${items.length > 5 ? ` (+${items.length - 5} more)` : ''}`)
    .join('\n');

  const skillContent = `---
name: ${skillName}
description: ${title} documentation and reference. Use when asking about ${triggerPhrases.toLowerCase()}.
---

# ${title}

This skill provides access to ${title} documentation with ${links.length} reference documents.

## Overview

${categorySummary}

## How to Use

Ask questions about any topic covered in this documentation. The skill will help you find relevant information from the reference documents.

**Example queries:**
- "How do I get started with ${title.split(' ')[0]}?"
- "What are the configuration options?"
- "Show me examples of common workflows"

## Reference Documents

${referenceList}

---

*Generated from llms.txt with ${referenceFiles.length} fetched documents.*
`;

  const skillPath = join(skillDir, 'SKILL.md');
  await writeFile(skillPath, skillContent, 'utf-8');

  console.log(JSON.stringify({
    skillPath,
    skillName,
    referenceCount: referenceFiles.length,
    linkCount: links.length
  }, null, 2));
}

// Main
const skillDir = process.argv[2];
const jsonFile = process.argv[3];

if (!skillDir || !jsonFile) {
  console.error('Usage: bun run generate-skill.ts <skill-dir> <json-file>');
  console.error('  skill-dir: Directory where skill will be created');
  console.error('  json-file: Path to JSON file from fetch-llmstxt.ts');
  process.exit(1);
}

try {
  await generateSkill(skillDir, jsonFile);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
