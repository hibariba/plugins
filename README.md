# Personal Claude Code Plugin Marketplace

A curated collection of custom and third-party plugins for Claude Code.

> **⚠️ Important:** This is a personal marketplace. Plugins here are either developed by me or carefully selected from the community. Always review plugins before use.

## Installation

To use this marketplace in Claude Code:

```bash
# Add this marketplace
/plugin add-marketplace https://github.com/hibariba/plugins.git

# Install a plugin from this marketplace
/plugin install {plugin-name}@hibariba-plugins

# Or browse available plugins
/plugin > Discover
```

## What Are Plugins?

Plugins are extensions that can include multiple components:

- **Skills** - Domain knowledge that guides Claude (auto-loads based on context)
- **Commands** - User-invoked slash commands for specific actions
- **Agents** - Autonomous task handlers for complex workflows
- **Hooks** - Event-driven automation for validation and processing
- **MCP servers** - External service integrations

**Not all plugins need all components.** The simplest plugin might have just a skill or just a command. See `plugins/example-plugin/` for a working template.

## Creating Plugins

The fastest way to create a plugin:

```bash
# Copy the template
cp -r plugins/example-plugin plugins/my-new-plugin

# Customize it
cd plugins/my-new-plugin
# Edit .claude-plugin/plugin.json
# Remove what you don't need, customize what you keep
```

For detailed development workflows, component patterns, and best practices, see **[CLAUDE.md](CLAUDE.md)** - the complete developer guide.

## Categories

Plugins are organized by category for easy discovery:

| Category | Description |
|----------|-------------|
| **Development** | Dev tools, language servers, code generation |
| **Productivity** | Workflow automation, task management, integrations |
| **Testing** | Testing frameworks, quality assurance tools |
| **Security** | Security analysis, vulnerability scanning |
| **Database** | Database integrations, query builders |
| **Deployment** | CI/CD, deployment automation |
| **Monitoring** | Error tracking, analytics, logging |
| **Design** | UI/UX tools, design system integrations |
| **Learning** | Educational plugins, interactive modes |

## Repository Structure

```
hibariba-plugins/
├── plugins/              # Personal plugins
├── external_plugins/     # Third-party plugins (git submodules)
└── .claude-plugin/
    └── marketplace.json  # Plugin catalog
```

## Resources

- **Example Plugin:** `plugins/example-plugin/` - Working template with skill and command
- **Developer Guide:** [CLAUDE.md](CLAUDE.md) - Complete development reference
- **Official Docs:** [Claude Code Plugin Documentation](https://code.claude.com/docs/en/plugins)
- **Official Marketplace:** [Anthropic Plugins](https://github.com/anthropics/claude-plugins-official)

---

**Philosophy:** Keep everything simple, clear, and minimal. Copy the template. Remove what you don't need. Ship it.
