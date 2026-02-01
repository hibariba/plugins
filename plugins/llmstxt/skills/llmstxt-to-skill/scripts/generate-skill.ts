#!/usr/bin/env bun
/**
 * generate-skill.ts
 *
 * Generates a SKILL.md file from fetched references using AI synthesis.
 *
 * Usage: bun run generate-skill.ts <skill-dir> <title> '<links-json>'
 *
 * Creates SKILL.md in skill-dir with:
 * - Frontmatter with trigger descriptions
 * - AI-synthesized overview
 * - References section
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

interface Link {
  name: string;
  url: string;
  description: string;
}

async function generateSkill(
  skillDir: string,
  title: string,
  links: Link[]
): Promise<void> {
  const referencesDir = join(skillDir, 'references');

  // Read all reference files to build context
  let referenceFiles: string[] = [];
  try {
    referenceFiles = await readdir(referencesDir);
  } catch {
    // No references yet, that's okay
  }

  // Build descriptions from links for trigger phrases
  const topics = links
    .slice(0, 10) // Use first 10 for trigger phrases
    .map(l => l.description.split('.')[0]) // First sentence
    .filter(d => d.length > 0 && d.length < 100);

  // Derive skill name
  const skillName = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Build trigger description from topics
  const triggerPhrases = topics.slice(0, 5).join(', ');

  // Create reference list
  const referenceList = links
    .map(l => `- [${l.name}](references/${l.name}.md): ${l.description}`)
    .join('\n');

  // Build summary of what the documentation covers
  const categories = new Map<string, string[]>();
  for (const link of links) {
    // Categorize by common keywords
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

  // Build category summary
  const categorySummary = Array.from(categories.entries())
    .map(([cat, items]) => `- **${cat}**: ${items.slice(0, 5).join(', ')}${items.length > 5 ? ` (+${items.length - 5} more)` : ''}`)
    .join('\n');

  // Generate the SKILL.md content
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

  // Write the SKILL.md
  const skillPath = join(skillDir, 'SKILL.md');
  await writeFile(skillPath, skillContent, 'utf-8');

  console.log(JSON.stringify({
    skillPath,
    skillName,
    referenceCount: referenceFiles.length,
    linkCount: links.length
  }, null, 2));
}

// Main execution
const skillDir = process.argv[2];
const title = process.argv[3];
const linksJson = process.argv[4];

if (!skillDir || !title || !linksJson) {
  console.error('Usage: bun run generate-skill.ts <skill-dir> <title> \'<links-json>\'');
  console.error('  skill-dir: Directory where skill will be created');
  console.error('  title: Title from llms.txt');
  console.error('  links-json: JSON array of links from fetch-llmstxt.ts');
  process.exit(1);
}

try {
  const links: Link[] = JSON.parse(linksJson);

  if (!Array.isArray(links)) {
    throw new Error('Links must be an array');
  }

  await generateSkill(skillDir, title, links);

} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
