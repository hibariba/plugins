# Automatic Agent Triggering Guide

This guide explains how to configure the plugin-workflow agents to run automatically during your development workflow.

## Triggering Mechanisms

### 1. Description-Based Auto-Triggering (Built-in)

Agents already auto-trigger based on their `description` field when Claude detects matching conversation context.

**How it works:**
- Each agent has a `description` with trigger phrases
- Claude automatically loads the agent when context matches
- User doesn't need to explicitly invoke the agent

**Current agent triggers:**

| Agent | Trigger Phrases |
|-------|----------------|
| test-writer | "create tests", "write test file", "generate test cases" |
| doc-generator | "generate documentation", "create README", "update docs" |
| marketplace-manager | "add to marketplace", "publish plugin", "update marketplace" |
| release-preparer | "prepare release", "create release", "bump version" |
| plugin-migrator | "migrate plugin", "upgrade plugin structure" |
| dependency-analyzer | "analyze dependencies", "check dependencies" |

**Tip:** Use natural language with these phrases and the agent will trigger automatically.

### 2. Hook-Based Auto-Triggering (Advanced)

Use Claude Code hooks to trigger agents at specific lifecycle events.

#### Create Plugin Workflow Hooks

Create `plugins/plugin-workflow/hooks/hooks.json`:

```json
{
  "description": "Automated plugin workflow triggers",
  "hooks": {
    "PostToolUse": [
      {
        "description": "Auto-generate docs after plugin component changes",
        "prompt": "If a file matching patterns [\"plugins/*/skills/*.md\", \"plugins/*/commands/*.md\", \"plugins/*/agents/*.md\", \"plugins/*/.claude-plugin/plugin.json\"] was just written or edited, suggest running the doc-generator agent to update README.md. Keep suggestion brief (1 line). Only suggest if the change was substantial (not typo fixes).",
        "filter": {
          "toolNames": ["Write", "Edit"],
          "pathPatterns": [
            "plugins/*/skills/*.md",
            "plugins/*/commands/*.md",
            "plugins/*/agents/*.md",
            "plugins/*/.claude-plugin/plugin.json"
          ]
        }
      },
      {
        "description": "Validate JSON after marketplace changes",
        "prompt": "The file .claude-plugin/marketplace.json was just modified. Run 'jq empty .claude-plugin/marketplace.json' to validate it's still valid JSON. If invalid, show the error and fix it immediately.",
        "filter": {
          "toolNames": ["Write", "Edit"],
          "pathPatterns": [".claude-plugin/marketplace.json"]
        }
      }
    ],
    "Stop": [
      {
        "description": "Suggest release prep when plugin development is complete",
        "prompt": "Review the conversation. If the user just finished developing or updating a plugin and hasn't mentioned releasing it, suggest: 'Would you like me to prepare a release for this plugin?' Only suggest once per session. Keep it brief (1 line)."
      }
    ],
    "SessionStart": [
      {
        "description": "Check for outdated plugins at session start",
        "prompt": "Silent check: Scan plugins/ directory. If any plugin hasn't been updated in >6 months (check git log), make a mental note. Don't output anything unless user asks about maintenance or plugin health."
      }
    ]
  }
}
```

**Important:** After adding hooks, restart Claude Code for changes to take effect.

#### Hook Event Reference

| Event | When It Fires | Use For |
|-------|--------------|---------|
| `PreToolUse` | Before tool execution | Validation, blocking dangerous operations |
| `PostToolUse` | After tool execution | Triggering follow-up actions, documentation updates |
| `Stop` | User stops agent with Ctrl+C | Cleanup, suggesting next steps |
| `SessionStart` | Claude Code starts | Health checks, setup validation |
| `SessionEnd` | Claude Code exits | Final cleanup, status reports |
| `UserPromptSubmit` | User submits prompt | Input validation, context checks |

### 3. Git Hook Integration

Trigger agents during git operations.

#### Pre-Commit Hook

Add to `.githooks/pre-commit`:

```bash
#!/bin/bash

# If plugin files changed, validate them
PLUGIN_FILES=$(git diff --cached --name-only | grep "plugins/.*/\.claude-plugin/plugin.json")

if [ -n "$PLUGIN_FILES" ]; then
  echo "🔍 Validating plugin.json files..."

  for file in $PLUGIN_FILES; do
    if ! jq empty "$file" 2>/dev/null; then
      echo "❌ Invalid JSON in $file"
      exit 1
    fi
  done

  echo "✅ Plugin JSON files valid"
fi

# If marketplace.json changed, validate it
if git diff --cached --name-only | grep -q "\.claude-plugin/marketplace.json"; then
  echo "🔍 Validating marketplace.json..."

  if ! jq empty .claude-plugin/marketplace.json 2>/dev/null; then
    echo "❌ Invalid marketplace.json"
    exit 1
  fi

  echo "✅ Marketplace JSON valid"
fi
```

#### Pre-Push Hook

Add to `.githooks/pre-push`:

```bash
#!/bin/bash

# Check if pushing to main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "main" ]; then
  # Get list of changed plugins
  CHANGED_PLUGINS=$(git diff origin/main --name-only | grep "plugins/" | cut -d/ -f2 | sort -u)

  if [ -n "$CHANGED_PLUGINS" ]; then
    echo "📦 Plugins modified: $CHANGED_PLUGINS"
    echo "❓ Have you:"
    echo "   - Generated tests?"
    echo "   - Updated documentation?"
    echo "   - Added to marketplace?"
    echo ""
    read -p "Continue push? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi
```

### 4. Workflow Aliases (Convenience)

Create custom commands that chain agent invocations.

#### Add to `.claude/commands/` (User Commands)

**`publish-plugin.md`:**
```markdown
---
name: publish-plugin
description: Complete plugin publishing workflow
allowed-tools: [Task, Bash, Read, Write, Edit]
argument-hint: <plugin-name>
---

You are running the complete plugin publishing workflow.

Steps:
1. Parse plugin name from argument
2. Invoke test-writer agent: Generate tests
3. Invoke doc-generator agent: Update README
4. Run tests: `./tests/eval-plugin.sh plugins/{name}`
5. Invoke dependency-analyzer agent: Check requirements
6. Invoke release-preparer agent: Prepare release
7. Invoke marketplace-manager agent: Add to marketplace
8. Show summary and next steps (git push instructions)

Execute each step, wait for completion, then move to next.
```

**`maintain-plugin.md`:**
```markdown
---
name: maintain-plugin
description: Plugin maintenance workflow (upgrade, test, document)
allowed-tools: [Task, Bash, Read, Write, Edit]
argument-hint: <plugin-name>
---

You are running plugin maintenance workflow.

Steps:
1. Parse plugin name from argument
2. Invoke plugin-migrator agent: Upgrade to latest patterns
3. Invoke test-writer agent: Update tests
4. Run tests: `./tests/eval-plugin.sh plugins/{name}`
5. Invoke doc-generator agent: Update documentation
6. Invoke dependency-analyzer agent: Check for outdated dependencies
7. Show maintenance report and recommendations

Execute each step sequentially.
```

**Usage:**
```bash
/publish-plugin my-plugin
/maintain-plugin old-plugin
```

### 5. Task List Integration

Use task lists to chain agent invocations systematically.

**Example: Release Workflow**

```typescript
// When user says "release plugin my-plugin", create tasks:

TaskCreate({
  subject: "Run dependency analysis",
  description: "Invoke dependency-analyzer agent for my-plugin",
  activeForm: "Analyzing dependencies"
})

TaskCreate({
  subject: "Generate or update tests",
  description: "Invoke test-writer agent for my-plugin",
  activeForm: "Writing tests"
})

TaskCreate({
  subject: "Run behavioral tests",
  description: "Execute ./tests/eval-plugin.sh plugins/my-plugin",
  activeForm: "Running tests"
})

TaskCreate({
  subject: "Update documentation",
  description: "Invoke doc-generator agent for my-plugin",
  activeForm: "Generating docs"
})

TaskCreate({
  subject: "Prepare release",
  description: "Invoke release-preparer agent for my-plugin",
  activeForm: "Preparing release"
})

TaskCreate({
  subject: "Add to marketplace",
  description: "Invoke marketplace-manager agent for my-plugin",
  activeForm: "Updating marketplace"
})
```

## Recommended Automation Strategy

### For Plugin Development (Active Work)

1. **Manual triggering** - Use natural language trigger phrases
   - "Create tests for this plugin"
   - "Generate README"
   - "Add to marketplace"

2. **PostToolUse hooks** - Auto-suggest actions after file changes
   - Suggest doc updates after component edits
   - Auto-validate JSON after marketplace changes

### For Plugin Release (Milestone)

1. **Custom commands** - Single command for entire workflow
   - `/publish-plugin my-plugin`
   - Chains all necessary agents automatically

2. **Task lists** - Track progress through complex workflows
   - Create tasks for each release step
   - Mark complete as agents finish

### For Maintenance (Periodic)

1. **SessionStart hooks** - Check plugin health on startup
   - Detect outdated plugins
   - Flag missing documentation

2. **Git hooks** - Enforce quality at commit/push time
   - Validate JSON before commit
   - Remind about documentation before push

## Best Practices

### DO
✅ Use description-based triggering for ad-hoc invocations
✅ Use hooks for automatic validation and suggestions
✅ Use custom commands for repeatable workflows
✅ Keep hook prompts concise and specific
✅ Restart Claude Code after modifying hook configuration

### DON'T
❌ Don't make hooks too aggressive (frustrates users)
❌ Don't auto-trigger expensive operations (always suggest first)
❌ Don't create circular triggering (agent triggers agent infinitely)
❌ Don't forget filter conditions (hooks run on every tool use otherwise)
❌ Don't assume hooks work immediately (requires restart)

## Testing Your Triggers

### Test Description-Based Triggering
```bash
# Start Claude Code
claude --plugin-dir plugins/plugin-workflow

# Try trigger phrases
> "Create tests for example-plugin"
# Should invoke test-writer agent

> "Generate README for example-plugin"
# Should invoke doc-generator agent
```

### Test Hook-Based Triggering
```bash
# 1. Add hooks to plugins/plugin-workflow/hooks/hooks.json
# 2. Restart Claude Code
claude --plugin-dir plugins/plugin-workflow

# 3. Trigger hook condition
> "Let me edit this plugin.json file"
# Make a change

# 4. Hook should fire after tool execution
# Should see suggestion or validation output
```

### Test Custom Commands
```bash
# 1. Add command to .claude/commands/
# 2. Start Claude Code
claude

# 3. Run command
> "/publish-plugin my-plugin"
# Should execute complete workflow
```

## Troubleshooting

**Agent doesn't auto-trigger:**
- Check description field has trigger phrases
- Use more explicit trigger language
- Manually invoke with Task tool as fallback

**Hook doesn't fire:**
- Verify hooks.json is valid JSON: `jq empty hooks/hooks.json`
- Restart Claude Code (hooks load at session start)
- Check filter conditions match your tool use
- Verify hook event is correct (PreToolUse vs PostToolUse)

**Custom command not found:**
- Check file is in `.claude/commands/` directory
- Verify frontmatter has `name` field
- Restart Claude Code
- Run `/help` to see if command appears

**Hook fires too often:**
- Add filter conditions (toolNames, pathPatterns)
- Make prompt more selective (check file patterns)
- Use "silent check" pattern (only output if condition met)

## Example: Complete Automation Setup

Here's a full working example combining all approaches:

**1. Plugin hooks** (`plugins/plugin-workflow/hooks/hooks.json`):
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "prompt": "If plugin component file was edited, suggest: 'Update docs with: doc-generator agent'",
        "filter": {
          "toolNames": ["Write", "Edit"],
          "pathPatterns": ["plugins/*/skills/*.md", "plugins/*/commands/*.md"]
        }
      }
    ]
  }
}
```

**2. Custom command** (`.claude/commands/release-workflow.md`):
```markdown
---
name: release-workflow
description: Full release workflow for a plugin
allowed-tools: [Task]
argument-hint: <plugin-name>
---

Run complete release workflow:
1. Test writer agent
2. Doc generator agent
3. Dependency analyzer agent
4. Release preparer agent
5. Marketplace manager agent

Execute sequentially with status updates.
```

**3. Git hook** (`.githooks/pre-commit`):
```bash
#!/bin/bash
# Validate plugin JSON before commit
if git diff --cached --name-only | grep -q "plugin.json"; then
  jq empty plugins/*/.claude-plugin/plugin.json || exit 1
fi
```

**Usage:**
```bash
# Development: Auto-suggestions via hooks
> "Let me update this skill"
# ... edit skill ...
# Hook suggests: "Update docs with: doc-generator agent"

# Release: Single command
> "/release-workflow my-plugin"
# Runs all 5 agents automatically

# Commit: Git hook validates
git commit -m "feat: add new skill"
# Hook validates JSON before commit succeeds
```

## Summary

**Easiest:** Natural language trigger phrases (built-in)
**Most Powerful:** Hook-based automation (requires setup)
**Most Convenient:** Custom commands (reusable workflows)
**Most Enforcing:** Git hooks (quality gates)

Start with trigger phrases, add hooks as needed, create custom commands for frequent workflows.
