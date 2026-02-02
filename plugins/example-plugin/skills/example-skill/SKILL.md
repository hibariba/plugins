---
name: example-skill
description: This skill is triggered when users ask about "example workflows", "plugin templates", or "show me an example". It demonstrates proper skill structure, progressive disclosure, and best practices for skill development.
---

Hello! You've loaded the example-skill from the example-plugin.

This skill is part of a working plugin demonstration. The example-plugin shows:
- **Skills** (you're reading one now) - Knowledge that guides Claude
- **Commands** (try next) - User-invoked actions

Try running: `/example-plugin:example-command --name "Your Name"`

## Using This Plugin as a Template

This plugin demonstrates the two most common components. To create your own:

1. **Copy the plugin:**
   ```bash
   cp -r plugins/example-plugin plugins/my-plugin
   ```

2. **Update metadata:**
   Edit `.claude-plugin/plugin.json` with your plugin name and details

3. **Customize components:**
   - **Skill:** Update SKILL.md with your knowledge
   - **Command:** Update commands/example-command.md with your action

4. **Add to marketplace:**
   Add entry to `.claude-plugin/marketplace.json`

5. **Test locally:**
   ```bash
   claude --plugin-dir plugins/my-plugin
   ```

## Component Types

**Skills** - Knowledge/workflows (trigger on phrases)
- Provide domain expertise
- Guide Claude's responses
- Load automatically based on description triggers

**Commands** - User actions (invoke with `/plugin:command`)
- Execute specific tasks
- Parse arguments
- Provide formatted output

**Agents** - Autonomous tasks (advanced, not in this demo)
- Long-running processes
- Independent execution
- Custom personalities

**Hooks** - Event automation (advanced, not in this demo)
- PreToolUse/PostToolUse events
- Validation and processing
- System-level automation

## Best Practices

- **Skills:** Write in imperative form FOR Claude, use specific trigger phrases
- **Commands:** Keep focused on ONE clear action, provide helpful output
- **Integration:** Skills inform, commands execute, agents automate
- **Progressive disclosure:** Core concepts in SKILL.md, details in references/

## See Also

- README.md in this directory for installation and template usage
- Main repository for more examples
- Official docs: https://code.claude.com/docs/en/plugins

---

**Next step:** Try the command! `/example-plugin:example-command --name "Test"`
