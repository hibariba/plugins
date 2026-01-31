# Example Plugin - Hello World Demonstration

A working "hello world" plugin demonstrating the two most common plugin components: skills and commands. Also serves as a copy-paste template for creating your own plugins.

## Quick Start

### Installation

```bash
# Install from marketplace
/plugin install example-plugin@hibariba-plugins

# Or test locally
cc --plugin-dir /Users/me/dev/projects/plugins/plugins/example-plugin
```

### Try It Out

**1. Test the skill:**
```
User: "show me an example"
Claude: [Loads skill and gives hello message]
```

**2. Test the command:**
```bash
/example-plugin:example-command --name "Your Name"

# Output:
Hello, Your Name!

This is a working example command from example-plugin.
...
```

**3. Try verbose mode:**
```bash
/example-plugin:example-command --name "Test" --verbose

# Output:
🔍 Parsing arguments...
   --name: Test
   --verbose: true

⚡ Executing example-command...
Hello, Test!
...
```

## What This Demonstrates

### Skill Component
- Auto-loads when you ask about "example workflows" or "plugin templates"
- Provides knowledge that guides Claude's responses
- Simple structure: just SKILL.md

### Command Component
- User-invoked action: `/example-plugin:example-command`
- Argument parsing (--name, --verbose)
- Formatted output

## Plugin Structure

```
example-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── skills/
│   └── example-skill/
│       └── SKILL.md          # Skill definition
├── commands/
│   └── example-command.md    # Slash command
└── README.md                 # This file
```

## Using as a Template

This plugin is a template you can copy and customize:

### 1. Copy Structure

```bash
# From repository root
cp -r plugins/example-plugin plugins/my-plugin
cd plugins/my-plugin
```

### 2. Update Metadata

Edit `.claude-plugin/plugin.json`:
- Change `name` to your plugin name
- Update `description`, `author`, `homepage`

### 3. Customize Components

**Skill:**
- Edit `skills/example-skill/SKILL.md`
- Update frontmatter with your trigger phrases
- Replace content with your knowledge

**Command:**
- Edit `commands/example-command.md`
- Update frontmatter (name, description, allowed-tools)
- Replace instructions with your command logic

**Remove what you don't need:**
```bash
# Don't need skill? Remove it
rm -rf skills/

# Don't need command? Remove it
rm -rf commands/
```

### 4. Test Locally

```bash
cc --plugin-dir /path/to/your/plugin

# Test skill: Ask questions with your trigger phrases
# Test commands: Run /your-plugin:your-command
```

### 5. Add to Marketplace

Add entry to `/.claude-plugin/marketplace.json`:
```json
{
  "name": "my-plugin",
  "description": "What it does",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "your-email@example.com"
  },
  "source": "./plugins/my-plugin",
  "category": "development",
  "homepage": "https://github.com/yourusername/plugins/tree/main/plugins/my-plugin"
}
```

## Component Types

This plugin demonstrates the two most common components. For advanced use cases:

### Skills - Knowledge Layer
- **What:** Domain expertise, workflows, patterns
- **When:** Triggered automatically by user questions
- **How:** Claude reads and applies the knowledge
- **Structure:** SKILL.md (required), optional references/, examples/, scripts/

### Commands - User Actions
- **What:** Explicit user-invoked actions
- **When:** User runs `/plugin:command-name`
- **How:** Argument parsing and execution
- **Structure:** Command markdown with frontmatter

### Agents - Autonomous Tasks (Advanced)
- **What:** Long-running autonomous processes
- **When:** Triggered by conditions or proactively
- **How:** Independent execution with specialized prompts
- **Not in this demo** - See git history or plugin-dev for examples

### Hooks - Event Automation (Advanced)
- **What:** Event-driven automation and validation
- **When:** Lifecycle events (PreToolUse, PostToolUse, etc.)
- **How:** Scripts or prompts that run on events
- **Not in this demo** - See git history or plugin-dev for examples

## Best Practices

### Skills
✅ Third-person description with specific trigger phrases
✅ Imperative form instructions FOR Claude
✅ Progressive disclosure (lean SKILL.md, detailed references/)
✅ Keep under 2,000 words for core content

### Commands
✅ Clear description and argument-hint in frontmatter
✅ Minimal allowed-tools (only what's needed)
✅ Instructions FOR Claude (not user-facing docs)
✅ Sensible defaults and helpful error messages

### General
✅ One clear purpose per component
✅ Simple structure beats complexity
✅ Test locally before publishing
✅ Document what's not obvious

## Development Tips

### Use plugin-dev for AI-Assisted Development

```bash
/plugin install plugin-dev@claude-plugins-official
/plugin-dev:create-plugin
```

The plugin-dev skill will guide you through:
- Component planning
- Implementation with best practices
- Validation and testing

### Validate Your Plugin

After customization:

1. **Check JSON syntax:**
   ```bash
   jq empty .claude-plugin/plugin.json
   ```

2. **Test locally:**
   ```bash
   cc --plugin-dir /path/to/your-plugin
   ```

3. **Verify components load:**
   - Skills: Ask questions with trigger phrases
   - Commands: Run `/plugin-name:command-name`

## Troubleshooting

**Skill doesn't load:**
- Check trigger phrases are specific enough in description
- Make sure you're asking questions that match those phrases
- Try exact phrases from description field

**Command not found:**
- Verify plugin is loaded with `/plugin`
- Check command name matches frontmatter `name:` field
- Use full syntax: `/plugin-name:command-name`

**Plugin won't install:**
- Validate plugin.json syntax with `jq`
- Check all file paths exist
- Ensure marketplace.json has correct source path

## Resources

- [Claude Code Plugin Docs](https://code.claude.com/docs/en/plugins)
- [Official Plugins](https://github.com/anthropics/claude-plugins-official)
- [plugin-dev Skill](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/plugin-dev)
- [MCP Documentation](https://modelcontextprotocol.io)

## License

MIT - Use this template freely for your own plugins

---

**Ready to create your own plugin?** Copy this template and start customizing!
