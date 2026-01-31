# Claude Code Plugin Development

> **Core Principle:** Keep everything simple, clear, and minimal—from documentation to plugins to code to processes.

This guide is for Claude Code (the AI assistant). It contains developer-focused workflows, patterns, and best practices for this plugin marketplace repository.

## Quick Start

The fastest way to create a plugin:

1. **Copy the template:**
   ```bash
   cp -r plugins/example-plugin plugins/my-new-plugin
   cd plugins/my-new-plugin
   ```

2. **Customize metadata:**
   - Edit `.claude-plugin/plugin.json` (name, description, author)

3. **Remove what you don't need:**
   - Delete unused directories (skills/, commands/, agents/, hooks/)
   - Keep only what this plugin requires

4. **Test locally:**
   ```bash
   cc --plugin-dir /Users/me/Developer/projects/plugins/plugins/my-new-plugin
   ```

5. **Add to marketplace:**
   - Edit `/.claude-plugin/marketplace.json`
   - Add plugin entry with source path

6. **Commit and push:**
   ```bash
   git add plugins/my-new-plugin .claude-plugin/marketplace.json
   git commit -m "Add my-new-plugin"
   git push
   ```

## Core Principles

These principles apply to **all aspects** of this repository:

### Simplicity Everywhere
- **Documentation:** Concise and scannable, not walls of text
- **Plugins:** Focused, single-purpose components
- **Code:** Clean, maintainable, minimal dependencies
- **Architecture:** Straightforward, not over-engineered
- **Processes:** Streamlined, not bureaucratic

### Template-First Development
- Start by copying `plugins/example-plugin/`
- Don't build from scratch
- Remove what you don't need rather than adding what you might

### Progressive Disclosure
- Core content in main files (~2000 words max for SKILL.md)
- Detailed content in subdirectories (references/, examples/)
- README.md gives overview, CLAUDE.md gives depth

### One Purpose Per Component
- **Skills** = Knowledge that guides Claude
- **Commands** = User-invoked actions
- **Agents** = Autonomous task handlers
- **Hooks** = Event-driven automation
- **MCP** = External service integrations

### Instructions FOR Claude
Write all content (skills, commands, agents) as instructions TO Claude, not documentation FOR users:
- ✅ "Search the codebase for the pattern..."
- ❌ "This skill searches the codebase..."
- Use imperative style, direct commands

## Repository Structure

```
hibariba-plugins/
├── .claude-plugin/
│   └── marketplace.json           # Plugin catalog
├── plugins/                        # Your custom plugins
│   └── example-plugin/            # Copy this as template
│       ├── .claude-plugin/
│       │   └── plugin.json        # Plugin metadata
│       ├── skills/                # Domain knowledge (optional)
│       ├── commands/              # Slash commands (optional)
│       ├── agents/                # Autonomous tasks (optional)
│       ├── hooks/                 # Event automation (optional)
│       ├── .mcp.json              # MCP servers (optional)
│       └── README.md              # Documentation
└── external_plugins/              # Third-party (git submodules)
```

**Key Points:**
- Only `.claude-plugin/plugin.json` is required in a plugin
- All other directories/files are optional
- Choose components based on what you actually need

## Component Patterns

### Skills - Knowledge Layer

**Purpose:** Domain expertise, workflows, patterns that guide Claude's understanding

**Location:** `skills/skill-name/SKILL.md` within plugin

**Triggers:** Automatically loaded when skill description matches conversation context

**Structure:**
```
skills/
└── my-skill/
    ├── SKILL.md              # Main skill content (~2000 words)
    ├── references/           # Detailed docs (optional)
    ├── examples/             # Code samples (optional)
    └── scripts/              # Helper scripts (optional)
```

**Frontmatter:**
```yaml
---
name: skill-name
description: Specific trigger phrases, concrete terms, what this skill knows about
---
```

**Best Practices:**
- Write trigger descriptions with specific, concrete phrases (not vague terms)
- Keep SKILL.md focused (~2000 words), use subdirectories for details
- Write imperatively FOR Claude: "Do X when Y" not "This skill does X"
- One domain per skill (don't combine unrelated topics)

**Use When:**
- You want Claude to understand domain-specific knowledge
- Information should load automatically based on context
- Building expertise that guides behavior

### Commands - User Actions

**Purpose:** Explicit user-invoked actions via slash commands

**Location:** `commands/command-name.md` within plugin

**Triggers:** User runs `/plugin-name:command-name`

**Frontmatter:**
```yaml
---
name: command-name
description: Brief description of what this command does
allowed-tools: [Bash, Read, Write, Edit]  # Minimal set needed
argument-hint: --flag <value>              # Optional: show in UI
---
```

**Argument Parsing:**
- Use standard patterns: `--flag value` or `--flag=value`
- Boolean flags: `--verbose` (presence = true)
- Parse from command string passed to you

**Best Practices:**
- Keep allowed-tools minimal (only what's actually needed)
- Write imperatively: "Do X, then Y, then output Z"
- Include argument-hint if command accepts parameters
- Output results in clear format for user

**Use When:**
- Users need to invoke specific actions explicitly
- Task requires parameters/configuration
- Building tools with direct user interaction

### Agents - Autonomous Tasks (Advanced)

**Purpose:** Long-running autonomous processes with specialized system prompts

**Location:** `agents/agent-name.md` within plugin

**Triggers:** Proactively based on conditions defined in frontmatter

**Frontmatter:**
```yaml
---
name: agent-name
description: When to trigger this agent (leave empty for Task tool only)
color: blue                    # Visual identifier
examples:                      # Example user queries (optional)
  - "Run security analysis"
  - "Audit the codebase"
---
```

**Best Practices:**
- Use description field only if agent should trigger automatically
- Leave description empty if agent is only called via Task tool
- Define clear, autonomous behavior in agent prompt
- Specify color for visual distinction in UI

**Use When:**
- Tasks require autonomous, multi-step execution
- Specialized system prompts improve results
- Behavior differs significantly from main Claude instance

### Hooks - Event Automation (Advanced)

**Purpose:** Event-driven automation at lifecycle points

**Location:** `hooks/` directory within plugin with `hooks.json` config

**Events:** PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd, UserPromptSubmit, PreCompact, Notification, SubagentStop

**Structure:**
```
hooks/
├── hooks.json              # Hook configuration
└── my-hook.ts              # Hook implementation
```

**Best Practices:**
- Use for validation, logging, notifications
- Keep hooks fast (they block execution)
- Use prompt-based hooks for complex validation
- Handle errors gracefully

**Use When:**
- Need validation before/after tool use
- Want automatic logging or notifications
- Require event-driven workflow automation

### MCP Servers - External Integrations (Advanced)

**Purpose:** Model Context Protocol servers for external service integration

**Location:** `.mcp.json` within plugin root

**Structure:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/path/to/server.js"],
      "type": "stdio"
    }
  }
}
```

**Best Practices:**
- Use `${CLAUDE_PLUGIN_ROOT}` for portable paths
- Choose appropriate server type (stdio, SSE, HTTP, WebSocket)
- Document required environment variables
- Provide clear setup instructions

**Use When:**
- Integrating with external APIs or services
- Need tools beyond Claude Code's built-in capabilities
- Building bridges to existing systems

## Testing & Validation

### Local Testing Workflow

```bash
# Test plugin installation
cc --plugin-dir /Users/me/Developer/projects/plugins/plugins/my-plugin

# Test with debug mode for verbose output
cc --debug --plugin-dir /Users/me/Developer/projects/plugins/plugins/my-plugin

# Test specific components:
# - Skills: Ask questions with trigger phrases
# - Commands: Run /plugin-name:command-name with args
# - Agents: Trigger conditions or use Task tool
```

### JSON Validation

```bash
# Validate plugin.json
jq empty plugins/my-plugin/.claude-plugin/plugin.json

# Validate marketplace.json
jq empty .claude-plugin/marketplace.json

# Both should exit silently (no output = valid)
```

### Pre-Publish Checklist

Before committing a new plugin:

- [ ] `plugin.json` is valid JSON
- [ ] Marketplace entry added to `marketplace.json`
- [ ] Local testing completed (plugin loads successfully)
- [ ] Components tested (skills trigger, commands execute)
- [ ] README.md includes usage examples
- [ ] Prerequisites/dependencies documented
- [ ] Author attribution included
- [ ] Git commit message is clear and specific

## Common Workflows

### Create Plugin

```bash
# 1. Copy template
cp -r plugins/example-plugin plugins/my-plugin
cd plugins/my-plugin

# 2. Update metadata
# Edit .claude-plugin/plugin.json

# 3. Customize components
# Remove unneeded directories, customize what remains

# 4. Test locally
cc --plugin-dir /Users/me/Developer/projects/plugins/plugins/my-plugin

# 5. Add to marketplace
# Edit /.claude-plugin/marketplace.json

# 6. Commit
git add plugins/my-plugin .claude-plugin/marketplace.json
git commit -m "Add my-plugin"
git push
```

### Add External Plugin

```bash
# 1. Add as git submodule
git submodule add https://github.com/author/plugin.git external_plugins/plugin-name
git submodule update --init --recursive

# 2. Update marketplace.json
# Add entry with source: "./external_plugins/plugin-name"

# 3. Commit
git add .gitmodules external_plugins/plugin-name .claude-plugin/marketplace.json
git commit -m "Add external plugin: plugin-name"
git push
```

### Update External Plugins

```bash
# Update all submodules to latest
git submodule update --remote

# Commit updates
git add external_plugins/
git commit -m "Update external plugins"
git push
```

### Remove Plugin

```bash
# 1. Remove from marketplace.json
# Delete the plugin entry

# 2. Remove from filesystem
rm -rf plugins/plugin-name  # or external_plugins/plugin-name

# 3. If external plugin, clean up submodule
git submodule deinit -f external_plugins/plugin-name
git rm -f external_plugins/plugin-name
rm -rf .git/modules/external_plugins/plugin-name

# 4. Commit
git add .claude-plugin/marketplace.json
git commit -m "Remove plugin-name"
git push
```

## Marketplace Configuration

### Entry Format

Each plugin in `marketplace.json` requires:

```json
{
  "name": "plugin-name",
  "description": "Brief description of what the plugin does",
  "version": "1.0.0",
  "author": {
    "name": "Author Name",
    "email": "author@example.com"
  },
  "source": "./plugins/plugin-name",  // or "./external_plugins/plugin-name"
  "category": "development",
  "homepage": "https://github.com/..."
}
```

### Categories

Choose the most appropriate category:

| Category | Use For |
|----------|---------|
| `development` | Dev tools, language servers, code generation |
| `productivity` | Workflow automation, task management, integrations |
| `testing` | Testing frameworks, quality assurance tools |
| `security` | Security analysis, vulnerability scanning |
| `database` | Database integrations, query builders |
| `deployment` | CI/CD, deployment automation |
| `monitoring` | Error tracking, analytics, logging |
| `design` | UI/UX tools, design system integrations |
| `learning` | Educational plugins, interactive modes |

## Naming Conventions

- **Plugins:** `kebab-case` (my-plugin-name)
- **Skills:** `kebab-case` (my-skill-name)
- **Commands:** `kebab-case.md` (my-command.md)
- **Agents:** `kebab-case.md` (my-agent.md)
- **Hooks:** `kebab-case.ts` (my-hook.ts)

## Git Workflow

### Branching Strategy

```
main          ← Clean, publishing-ready content only
  │
  └── dev     ← Development work, artifacts, WIP
        │
        └── feat/plugin-name   ← Feature branches for new plugins
        └── fix/issue-name     ← Bug fix branches
        └── docs/topic         ← Documentation branches
```

**Rules:**
- **main**: Always deployable. Only merge from dev when ready to publish.
- **dev**: Active development. All work happens here or in feature branches.
- **Feature branches**: Create from dev, merge back to dev when complete.

### Dev-Only Artifacts

Some files exist **only on dev** and are excluded when publishing to main:

```
_dev/                  # Dev-only directory
├── .mainignore        # List of files to exclude from main
├── tests/             # Test suites
├── scripts/           # Automation scripts
└── README.md          # Explains this pattern

Makefile               # Dev commands (at root, excluded from main)
```

**What stays on dev only:**
- `_dev/` directory and all contents
- `Makefile` / `justfile`
- Test files (`*.test.ts`, `tests/`, `coverage/`)
- Dev configs (`.eslintrc`, `tsconfig.json`, etc.)

**Why:** Main is the published marketplace. Users don't need test infrastructure or dev tooling—just clean, working plugins.

**Workflow:**
```bash
# Start new plugin development
git checkout dev
git checkout -b feat/my-new-plugin

# Work on feature...
git add . && git commit -m "feat(my-plugin): add initial structure"

# When complete, merge to dev
git checkout dev
git merge feat/my-new-plugin
git branch -d feat/my-new-plugin

# When dev is ready for publishing (excludes dev-only artifacts)
make publish
```

### Conventional Commits (Required)

All commits must follow the Conventional Commits format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
| Type | Use For |
|------|---------|
| `feat` | New feature or plugin |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no new feature or fix |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `build` | Build system, dependencies |
| `ci` | CI/CD configuration |
| `chore` | Maintenance, updates |
| `revert` | Reverting previous commit |

**Examples:**
```bash
# Good - follows format
git commit -m "feat(auth-plugin): add OAuth2 authentication support"
git commit -m "fix: resolve marketplace.json syntax error"
git commit -m "docs: update CLAUDE.md with git workflow"
git commit -m "chore: update external plugins to latest"

# Bad - doesn't follow format
git commit -m "Add authentication"      # Missing type
git commit -m "fix stuff"               # Too vague
git commit -m "WIP"                     # Not descriptive
```

### Git Hooks Setup

This repository uses `.githooks/` for automated validation:

```bash
# Enable the hooks (run once after cloning)
git config core.hooksPath .githooks
```

**Included Hooks:**
- **pre-commit**: Runs gitleaks to prevent committing secrets
- **commit-msg**: Validates Conventional Commits format

**Bypassing (not recommended):**
```bash
git commit --no-verify -m "message"  # Skip hooks
```

### Best Practices

**Keep commits atomic:**
- One logical change per commit
- If you can split it, split it
- Commit often, push when ready

**Write meaningful messages:**
- Describe what AND why
- Use imperative mood: "Add feature" not "Added feature"
- Keep first line under 72 characters

**Keep main clean:**
- Never commit directly to main
- All changes go through dev first
- Only merge publishing-ready content

**Feature branch hygiene:**
- Delete branches after merging
- Keep branches short-lived
- Rebase on dev before merging if needed

**Before pushing:**
```bash
# Validate JSON files
jq empty .claude-plugin/marketplace.json
jq empty plugins/*/.claude-plugin/plugin.json

# Check for secrets
gitleaks detect --source . --verbose
```

## Quality Standards

All plugins in this marketplace should have:

- ✅ Clear README explaining purpose and usage
- ✅ Usage examples (code snippets or commands)
- ✅ Installation instructions
- ✅ Prerequisites/dependencies listed
- ✅ Semantic versioning (1.0.0)
- ✅ Proper error handling
- ✅ Configuration options documented
- ✅ Author attribution

## Quick Reference

### Plugin Development
| Task | Command |
|------|---------|
| **Create plugin** | `cp -r plugins/example-plugin plugins/name` |
| **Test plugin** | `cc --plugin-dir plugins/name` |
| **Test with debug** | `cc --debug --plugin-dir plugins/name` |
| **Validate plugin.json** | `jq empty plugins/name/.claude-plugin/plugin.json` |
| **Validate marketplace** | `jq empty .claude-plugin/marketplace.json` |

### Git Workflow
| Task | Command |
|------|---------|
| **Enable hooks** | `git config core.hooksPath .githooks` |
| **Start feature** | `git checkout dev && git checkout -b feat/name` |
| **Merge to dev** | `git checkout dev && git merge feat/name` |
| **Publish to main** | `make publish` (clean merge, excludes dev artifacts) |
| **Check for secrets** | `gitleaks detect --source . --verbose` |

### Make Commands (dev branch only)
| Task | Command |
|------|---------|
| **Run tests** | `make test` |
| **Validate JSON** | `make validate` |
| **Publish to main** | `make publish` |
| **Sync branches** | `make sync` |
| **Clean artifacts** | `make clean` |

### External Plugins
| Task | Command |
|------|---------|
| **Add external plugin** | `git submodule add URL external_plugins/name` |
| **Update externals** | `git submodule update --remote` |
| **Remove submodule** | `git submodule deinit -f external_plugins/name` |

## Resources

- **Example Plugin:** `plugins/example-plugin/` - Copy this to start
- **Official Docs:** [Claude Code Plugin Documentation](https://code.claude.com/docs/en/plugins)
- **Official Plugins:** [Anthropic Marketplace](https://github.com/anthropics/claude-plugins-official)
- **Plugin Dev Tool:** `/plugin install plugin-dev@claude-plugins-official`
- **MCP Docs:** [Model Context Protocol](https://modelcontextprotocol.io)

---

**Remember:** Simple, clear, minimal. Remove what you don't need. Copy the template. Test locally. Ship it.
