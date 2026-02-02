# Agent Testing Guide

This document contains test prompts to verify all 6 agents in the plugin-workflow plugin.

## Setup

Start a new Claude Code session with the plugin loaded:

```bash
claude --plugin-dir plugins/plugin-workflow
```

Or if testing from the marketplace:
```bash
claude  # (plugin-workflow should auto-load from marketplace)
```

## Test 1: test-writer

**Trigger phrase:** "Create tests for the example-plugin"

**Expected behavior:**
- Agent loads and identifies as test-writer
- Reads example-plugin components
- Generates test file at `tests/example-plugin.txt`
- Creates tests in format: `prompt|expected behavior`
- Covers skills, commands, and edge cases

**Verification:**
```bash
cat tests/example-plugin.txt
```

## Test 2: doc-generator

**Trigger phrase:** "Generate README for the example-plugin"

**Expected behavior:**
- Agent loads and identifies as doc-generator
- Analyzes plugin.json and component files
- Creates or updates README.md with proper structure
- Includes installation, usage, examples
- Documents all components (skills, commands)

**Verification:**
```bash
cat plugins/example-plugin/README.md
```

## Test 3: marketplace-manager

**Trigger phrase:** "Check the marketplace entry for plugin-workflow"

**Expected behavior:**
- Agent loads and identifies as marketplace-manager
- Reads .claude-plugin/marketplace.json
- Validates the plugin-workflow entry
- Reports on entry status and validity
- Shows category and metadata

**Verification:**
```bash
jq '.plugins[] | select(.name=="plugin-workflow")' .claude-plugin/marketplace.json
```

## Test 4: release-preparer

**Trigger phrase:** "What would you check before releasing plugin-workflow?"

**Expected behavior:**
- Agent loads and identifies as release-preparer
- Lists pre-release validation steps
- Mentions JSON validation, tests, version bumping
- Describes changelog generation
- Explains git tagging process

**Verification:** Review response for comprehensive release checklist

## Test 5: plugin-migrator

**Trigger phrase:** "Analyze example-plugin for outdated patterns"

**Expected behavior:**
- Agent loads and identifies as plugin-migrator
- Scans plugin structure and files
- Identifies any outdated frontmatter or patterns
- Suggests modernization steps
- Reports on naming conventions

**Verification:** Review analysis for pattern detection

## Test 6: dependency-analyzer

**Trigger phrase:** "Analyze dependencies for the llmstxt plugin"

**Expected behavior:**
- Agent loads and identifies as dependency-analyzer
- Scans for external tool requirements (jq, curl, etc.)
- Identifies package dependencies
- Checks for MCP servers
- Reports conflicts if any

**Verification:** Review dependency report for completeness

## Quick Test All (Run in sequence)

```
1. "Create tests for example-plugin"
   Wait for completion, verify tests/ directory

2. "Generate README for plugin-workflow"
   Wait for completion, check README.md

3. "Verify plugin-workflow is in marketplace"
   Wait for confirmation

4. "What pre-release checks would you run for plugin-workflow?"
   Verify checklist appears

5. "Check example-plugin for migration needs"
   Verify migration analysis

6. "Analyze dependencies for plugin-workflow"
   Verify dependency report
```

## Hook Testing

The plugin includes 3 example hooks. To test:

1. **PostToolUse - Doc suggestion:**
   ```
   Edit a skill file: plugins/example-plugin/skills/hello-world/SKILL.md
   Expected: "💡 Tip: Update docs with doc-generator agent"
   ```

2. **PostToolUse - Marketplace validation:**
   ```
   Edit: .claude-plugin/marketplace.json (introduce syntax error)
   Expected: Auto-fix with error message
   ```

3. **Stop - Release suggestion:**
   ```
   After substantial plugin work, press Ctrl+C to stop
   Expected: "💡 Next steps: Would you like me to prepare a release?"
   ```

4. **SessionStart - Silent health check:**
   ```
   Start new session, then ask: "What's the plugin repository health?"
   Expected: Agent has context from silent check at session start
   ```

## Troubleshooting

**Agents don't trigger:**
- Restart Claude Code after adding the plugin
- Try more explicit trigger phrases
- Use Task tool manually: `Task(subagent_type="test-writer", prompt="...")`
- Check plugin loads: Look for agents in available subagent types

**Hooks don't fire:**
- Restart Claude Code (hooks load at session start)
- Verify hooks.json is valid: `jq empty plugins/plugin-workflow/hooks/hooks.json`
- Check filter conditions match your actions
- Review hook event types (PreToolUse vs PostToolUse)

**JSON validation fails:**
- Run: `jq empty plugins/plugin-workflow/.claude-plugin/plugin.json`
- Run: `jq empty .claude-plugin/marketplace.json`
- Check for trailing commas, missing quotes, syntax errors

## Success Criteria

✅ All 6 agents load and respond to trigger phrases
✅ Agents demonstrate domain-specific knowledge
✅ Generated outputs match expected formats
✅ Hooks fire on appropriate events
✅ No JSON validation errors
✅ Plugin appears in marketplace

## Next Steps After Testing

If all tests pass:
1. Commit the plugin: `git add plugins/plugin-workflow .claude-plugin/marketplace.json`
2. Create release: Use the release-preparer agent!
3. Push to remote: `git push origin main`
4. Share with community
