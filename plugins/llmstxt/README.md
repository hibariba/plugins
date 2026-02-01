# llmstxt

Tools for working with [llms.txt](https://llmstxt.org) files - the standard for LLM-friendly documentation.

## Skills

### llmstxt-to-skill

Convert any llms.txt URL into a fully-formed Claude Code skill with all referenced documentation.

**Trigger phrases:**
- "Create skill from llms.txt"
- "Convert llms.txt to skill"
- "Generate skill from https://example.com/llms.txt"

**What it does:**
1. Fetches and parses the llms.txt file
2. Downloads all linked documentation
3. Creates a skill with proper frontmatter and references

**Example:**
```
User: Create a skill from https://code.claude.com/docs/llms.txt

Claude: Where should I create the skill?
  1. .claude/skills/ (recommended)
  2. ~/.claude/skills/ (global)
  3. Custom path

User: 1

Claude:
  Fetching llms.txt... found 47 documentation links
  Downloading references... 45/47 complete (2 warnings)
  Generating SKILL.md...

  Created skill: claude-code-docs
  Location: .claude/skills/claude-code-docs/
  Files: SKILL.md + 45 reference documents
```

## Installation

```bash
# Local testing
claude --plugin-dir /path/to/llmstxt

# Or install from marketplace
/plugin install llmstxt
```

## Requirements

- Bun runtime (for TypeScript scripts)
- Network access to fetch llms.txt and linked documents

## Scripts

The plugin includes three utility scripts:

| Script | Purpose |
|--------|---------|
| `fetch-llmstxt.ts` | Parse llms.txt URL, extract links |
| `fetch-references.ts` | Download all linked documents |
| `generate-skill.ts` | Create SKILL.md from content |

## License

MIT
