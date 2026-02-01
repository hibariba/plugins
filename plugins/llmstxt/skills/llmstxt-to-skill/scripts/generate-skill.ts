#!/usr/bin/env bun
/**
 * generate-skill.ts - Generate SKILL.md from fetched references
 *
 * Usage:
 *   bun run generate-skill.ts <skill-dir> <json-file>
 *
 * Arguments:
 *   skill-dir - Directory where skill will be created (required)
 *   json-file - Path to JSON file from fetch-llmstxt.ts (required)
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid arguments or usage error
 *   2 - JSON file read/parse error
 *   3 - Skill directory error
 *   4 - Write error
 */

import { readdir, readFile, writeFile, access, constants } from 'fs/promises';
import { join } from 'path';
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
  title: string;
  skillName: string;
  links: Link[];
  sourceUrl?: string;
  fetchedAt?: string;
}

interface GenerateResult {
  skillPath: string;
  skillName: string;
  title: string;
  referenceCount: number;
  linkCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

function printUsage(): void {
  console.error(`
Usage: bun run generate-skill.ts <skill-dir> <json-file>

Arguments:
  skill-dir - Directory where skill will be created
  json-file - Path to JSON file from fetch-llmstxt.ts

Examples:
  bun run generate-skill.ts ./my-skill /tmp/data.json
  bun run generate-skill.ts ~/.claude/skills/my-skill data.json

Exit codes:
  0 - Success
  1 - Invalid arguments
  2 - JSON file error
  3 - Directory error
  4 - Write error
`);
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

function categorizeLinks(links: Link[]): Map<string, string[]> {
  const categories = new Map<string, string[]>();

  const categoryPatterns: [string, string[]][] = [
    ['Getting Started', ['setup', 'install', 'start', 'quickstart', 'begin', 'introduction', 'overview']],
    ['Configuration', ['config', 'setting', 'option', 'preference', 'customize']],
    ['Reference', ['api', 'reference', 'cli', 'command', 'syntax']],
    ['Guides', ['guide', 'tutorial', 'example', 'how-to', 'walkthrough', 'workflow']],
    ['Security', ['security', 'auth', 'permission', 'access', 'iam']],
    ['Integration', ['integration', 'plugin', 'extension', 'connect', 'mcp']],
    ['Troubleshooting', ['troubleshoot', 'debug', 'error', 'issue', 'problem', 'fix']]
  ];

  for (const link of links) {
    const desc = link.description.toLowerCase();
    const name = link.name.toLowerCase();
    const combined = `${desc} ${name}`;

    let matched = false;
    for (const [category, patterns] of categoryPatterns) {
      if (patterns.some(p => combined.includes(p))) {
        const existing = categories.get(category) || [];
        categories.set(category, [...existing, link.name]);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const existing = categories.get('Core Concepts') || [];
      categories.set('Core Concepts', [...existing, link.name]);
    }
  }

  return categories;
}

function buildCategorySummary(categories: Map<string, string[]>): string {
  return Array.from(categories.entries())
    .filter(([_, items]) => items.length > 0)
    .map(([cat, items]) => {
      const display = items.slice(0, 5).join(', ');
      const more = items.length > 5 ? ` (+${items.length - 5} more)` : '';
      return `- **${cat}**: ${display}${more}`;
    })
    .join('\n');
}

function buildTriggerPhrases(links: Link[]): string {
  // Extract unique, meaningful phrases from descriptions
  const phrases = links
    .slice(0, 15) // Sample first 15
    .map(l => {
      // Get first sentence or clause
      const desc = l.description.split(/[.!?]/)[0].trim();
      // Extract key topic
      const match = desc.match(/(?:about|for|to|with|using)\s+(.+?)(?:\s+(?:and|or|in|on|for|with)\s|$)/i);
      return match ? match[1].trim() : null;
    })
    .filter((p): p is string => p !== null && p.length > 3 && p.length < 50)
    .slice(0, 5);

  return phrases.length > 0 ? phrases.join(', ') : 'this documentation';
}

// ============================================================================
// Core Logic
// ============================================================================

async function generateSkill(skillDir: string, jsonFile: string): Promise<GenerateResult> {
  // Read JSON data
  const jsonContent = await readFile(jsonFile, 'utf-8');
  const data: InputData = JSON.parse(jsonContent);

  // Validate required fields
  if (!data.title) {
    throw new Error('JSON missing required field: title');
  }
  if (!Array.isArray(data.links)) {
    throw new Error('JSON missing required field: links (array)');
  }

  const title = data.title;
  const skillName = data.skillName || deriveSkillName(title);
  const links = data.links;

  // Count reference files if they exist
  const referencesDir = join(skillDir, 'references');
  let referenceFiles: string[] = [];
  try {
    if (existsSync(referencesDir)) {
      referenceFiles = await readdir(referencesDir);
    }
  } catch {
    // References directory doesn't exist yet, that's fine
  }

  // Build skill content
  const categories = categorizeLinks(links);
  const categorySummary = buildCategorySummary(categories);
  const triggerPhrases = buildTriggerPhrases(links);

  const referenceList = links
    .map(l => `- [${l.name}](references/${l.name}.md): ${l.description.slice(0, 200)}`)
    .join('\n');

  const firstWord = title.split(/\s+/)[0] || 'this topic';

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
- "How do I get started with ${firstWord}?"
- "What are the configuration options?"
- "Show me examples of common workflows"
- "How does authentication work?"

## Reference Documents

${referenceList}

---

*Generated from [llms.txt](${data.sourceUrl || 'unknown'}) on ${data.fetchedAt || new Date().toISOString()}*
*Fetched ${referenceFiles.length} of ${links.length} documents*
`;

  const skillPath = join(skillDir, 'SKILL.md');
  await writeFile(skillPath, skillContent, 'utf-8');

  return {
    skillPath,
    skillName,
    title,
    referenceCount: referenceFiles.length,
    linkCount: links.length
  };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length < 2 ? 1 : 0);
  }

  const skillDir = args[0];
  const jsonFile = args[1];

  // Validate JSON file exists
  if (!existsSync(jsonFile)) {
    console.error(`Error: JSON file not found: ${jsonFile}`);
    process.exit(2);
  }

  // Validate skill directory exists
  if (!existsSync(skillDir)) {
    console.error(`Error: Skill directory does not exist: ${skillDir}`);
    console.error('Create it first with: mkdir -p <skill-dir>/references');
    process.exit(3);
  }

  // Check directory is writable
  try {
    await access(skillDir, constants.W_OK);
  } catch {
    console.error(`Error: Skill directory is not writable: ${skillDir}`);
    process.exit(3);
  }

  // Generate skill
  let result: GenerateResult;
  try {
    console.error(`Generating SKILL.md in ${skillDir}...`);
    result = await generateSkill(skillDir, jsonFile);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`Error: Invalid JSON in file: ${error.message}`);
      process.exit(2);
    }
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(4);
  }

  // Output result as JSON
  console.log(JSON.stringify(result, null, 2));

  // Summary to stderr
  console.error(`\nGenerated: ${result.skillPath}`);
  console.error(`  Skill name: ${result.skillName}`);
  console.error(`  Title: ${result.title}`);
  console.error(`  References: ${result.referenceCount}/${result.linkCount}`);
}

main().catch((error) => {
  console.error(`Unexpected error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
