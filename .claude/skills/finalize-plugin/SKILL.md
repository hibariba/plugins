---
name: finalize-plugin
description: Finalize plugin for marketplace - validate, test, add marketplace entry, commit and push
disable-model-invocation: true
---

# Finalize Plugin for Marketplace

Complete workflow to prepare a plugin for publication to the marketplace.

## What This Does

1. **Validate structure** - Run validation scripts
2. **Test behavior** - Run behavioral tests (if available)
3. **Update marketplace** - Add/update marketplace.json entry
4. **Validate JSON** - Ensure all JSON is valid
5. **Stage & commit** - Create commit with conventional commit style
6. **Push** - Push to remote repository

## Usage

```
/finalize-plugin plugins/my-plugin
```

## Workflow Steps

### 1. Run Validation

```bash
./tests/validate-plugin.sh plugins/my-plugin/
```

If validation fails, stop and report issues.

### 2. Run Behavioral Tests (if available)

```bash
# Check if test file exists
if [ -f "tests/my-plugin.txt" ]; then
  ./tests/eval-plugin.sh plugins/my-plugin
fi
```

If tests fail, report and ask if user wants to proceed anyway.

### 3. Update Marketplace Entry

Read the plugin's `.claude-plugin/plugin.json` and check if entry exists in `.claude-plugin/marketplace.json`.

- If missing: Add new entry
- If exists: Verify it matches plugin.json

Marketplace entry format:
```json
{
  "name": "plugin-name",
  "description": "from plugin.json",
  "version": "from plugin.json",
  "author": {
    "name": "from plugin.json",
    "email": "from plugin.json"
  },
  "source": "./plugins/plugin-name",
  "category": "[appropriate category]",
  "homepage": "https://github.com/hibariba/plugins/tree/main/plugins/plugin-name"
}
```

Categories: `development`, `productivity`, `testing`, `learning`

### 4. Validate All JSON

```bash
jq empty .claude-plugin/marketplace.json && \
jq empty plugins/my-plugin/.claude-plugin/plugin.json && \
echo "✅ All JSON valid"
```

### 5. Stage Files

```bash
git add .claude-plugin/marketplace.json plugins/my-plugin/
```

### 6. Create Commit

Follow conventional commit style from recent commits:

```bash
git log --oneline -5  # Check recent style

# Commit format
git commit -m "feat: add [plugin-name] plugin

- [Brief description of what plugin does]
- [Key features/skills included]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### 7. Push to Remote

```bash
git push
```

## Pre-Commit Checklist

Before running this workflow, ensure:

- [ ] Plugin has LICENSE file
- [ ] README.md has installation & usage examples
- [ ] All skills have clear trigger descriptions
- [ ] No .DS_Store or temp files
- [ ] No hardcoded credentials or absolute paths
- [ ] Author email is correct (not placeholder)

## Error Handling

If any step fails:
1. Report the error clearly
2. Show the exact command that failed
3. Suggest fixes
4. Ask if user wants to continue or abort

## Success Output

```
✅ Plugin finalized successfully

Validation: Passed
Tests: Passed (or Skipped)
Marketplace: Updated
Commit: [commit-hash]
Pushed: main -> origin/main

Plugin is now published in marketplace!
```

## Notes

- This is a user-invocable skill only (disable-model-invocation: true)
- Always run from repository root
- Requires git remote access
- Follows repository's commit conventions
