---
name: llmstxt-to-skill
description: Convert llms.txt URL to Claude Code skill. Use when user says "create skill from llms.txt", "convert llms.txt", "generate skill from documentation URL", "llms.txt to skill", or provides a URL ending in llms.txt.
---

# llmstxt-to-skill

Convert any llms.txt URL into a Claude Code skill with all referenced documentation.

## Workflow

### Step 1: Get URL

If no URL provided, ask:
```
What llms.txt URL would you like to convert?
Example: https://code.claude.com/docs/llms.txt
```

### Step 2: Ask Output Location

Use AskUserQuestion:
- **Question:** "Where should I create the skill?"
- **Options:**
  1. `.claude/skills/` (Recommended) - Local to this project
  2. `~/.claude/skills/` - Global, available everywhere
  3. Custom path...

### Step 3: Parse llms.txt and Save to File

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/skills/llmstxt-to-skill/scripts/fetch-llmstxt.ts "URL" /tmp/llmstxt-data.json
```

This saves the parsed data to a temp file. Read the file to get title and skillName.

### Step 4: Create Directory

```bash
mkdir -p "OUTPUT_PATH/SKILL_NAME/references"
```

### Step 5: Fetch References

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/skills/llmstxt-to-skill/scripts/fetch-references.ts /tmp/llmstxt-data.json "OUTPUT_PATH/SKILL_NAME/references"
```

Report: "Fetching X references..." then "Fetched X/Y (Z warnings)"

### Step 6: Generate SKILL.md

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/skills/llmstxt-to-skill/scripts/generate-skill.ts "OUTPUT_PATH/SKILL_NAME" /tmp/llmstxt-data.json
```

### Step 7: Cleanup and Report

```bash
rm /tmp/llmstxt-data.json
```

Report success:
```
Created skill: SKILL_NAME
Location: OUTPUT_PATH/SKILL_NAME/
  - SKILL.md (main skill file)
  - references/ (X documents)

The skill will auto-trigger when asking about TOPIC.
```

## Error Handling

| Error | Action |
|-------|--------|
| Reference fetch fails | Log warning, continue with others |
| Invalid llms.txt URL | Report clear error message |
| Directory not writable | Suggest alternative location |

## Example

```
User: Create a skill from https://code.claude.com/docs/llms.txt

[Ask output location] → User: .claude/skills/

Parsing llms.txt... saved to /tmp/llmstxt-data.json
Found: Claude Code Docs with 52 links
Creating .claude/skills/claude-code-docs/references/
Fetching references... 52/52 complete
Generating SKILL.md...
Cleanup temp file...

Created skill: claude-code-docs
Location: .claude/skills/claude-code-docs/
  - SKILL.md (main skill file)
  - references/ (52 documents)

The skill will auto-trigger when asking about Claude Code.
```
