# Plugin Workflow Automation

> Automated agents for plugin development, testing, documentation, and release management

## Overview

This plugin provides specialized agents that automate common plugin development workflows: creating tests, generating documentation, managing marketplace entries, preparing releases, migrating plugins, and analyzing dependencies.

## Installation

```bash
claude --plugin-install plugin-workflow
```

## Agents

### Test Writer

**Trigger:** "Create tests", "write test file", "generate test cases"

Automatically generates behavioral test files (`tests/plugin-name.txt`) for `eval-plugin.sh`:
- Analyzes plugin components (skills, commands, agents)
- Creates comprehensive test cases covering happy paths, edge cases, errors
- Formats tests in prompt|expected-behavior format
- Suggests 10-20 tests covering all critical functionality

**Example:**
```
Create tests for my-plugin
```

### Documentation Generator

**Trigger:** "Generate documentation", "create README", "update docs"

Creates comprehensive README.md files for plugins:
- Extracts information from plugin.json and component files
- Generates installation instructions, usage examples, prerequisites
- Follows repository documentation standards
- Includes troubleshooting and configuration sections

**Example:**
```
Generate README for this plugin
```

### Marketplace Manager

**Trigger:** "Add to marketplace", "publish plugin", "update marketplace"

Manages `.claude-plugin/marketplace.json` entries:
- Validates plugins before adding to marketplace
- Checks for duplicates and conflicts
- Maintains alphabetical order and consistent formatting
- Handles adding, updating, and removing marketplace entries

**Example:**
```
Add my-plugin to the marketplace
```

### Release Preparer

**Trigger:** "Prepare release", "create release", "bump version"

Automates complete release workflow:
- Determines semantic version bump from commits
- Runs pre-release validation (JSON, tests, hooks)
- Updates version in plugin.json and marketplace.json
- Generates changelog from conventional commits
- Creates annotated git tags

**Example:**
```
Prepare release for this plugin
```

### Plugin Migrator

**Trigger:** "Migrate plugin", "upgrade plugin structure", "update to latest patterns"

Upgrades plugins to latest standards:
- Modernizes frontmatter format
- Fixes file naming (converts to kebab-case)
- Updates paths to use ${CLAUDE_PLUGIN_ROOT}
- Restructures directories to current conventions
- Rewrites content to follow best practices

**Example:**
```
Migrate this plugin to latest patterns
```

### Dependency Analyzer

**Trigger:** "Analyze dependencies", "check dependencies", "find conflicts"

Comprehensive dependency analysis:
- Scans for external tool dependencies (jq, git, npm, etc.)
- Identifies MCP server requirements
- Detects package dependencies (Node.js, Python)
- Finds conflicts (version, port, environment variable, hook)
- Generates detailed dependency report with installation instructions

**Example:**
```
Analyze plugin dependencies
```

## Automatic Triggering

See the **Automatic Triggering Guide** section below for how to configure these agents to run automatically during your workflow.

## Prerequisites

- Claude Code 1.0+
- Git (for release-preparer)
- jq (for JSON validation)

## Use Cases

### During Development
1. **Test Writer** - After adding new components
2. **Documentation Generator** - When plugin structure changes
3. **Dependency Analyzer** - Before first release

### Before Release
1. **Release Preparer** - Automates entire release process
2. **Marketplace Manager** - Publishes to marketplace
3. **Test Writer** - Ensures test coverage

### Maintenance
1. **Plugin Migrator** - Upgrade to latest patterns
2. **Documentation Generator** - Keep docs current
3. **Dependency Analyzer** - Audit requirements

## Example Workflow

```bash
# 1. Develop plugin
cp -r plugins/example-plugin plugins/my-plugin
# ... edit components ...

# 2. Generate tests
# "Create tests for my-plugin"

# 3. Generate documentation
# "Generate README for my-plugin"

# 4. Validate
./tests/eval-plugin.sh plugins/my-plugin

# 5. Prepare release
# "Prepare v1.0.0 release for my-plugin"

# 6. Publish to marketplace
# "Add my-plugin to marketplace"

# 7. Push
git push origin main
git push origin v1.0.0
```

## Benefits

- **Consistency** - Automated workflows ensure standards compliance
- **Speed** - Agents handle repetitive tasks in seconds
- **Quality** - Comprehensive validation and testing
- **Documentation** - Always up-to-date docs
- **Best Practices** - Agents encode current patterns

## License

MIT

## Author

Plugin Marketplace
