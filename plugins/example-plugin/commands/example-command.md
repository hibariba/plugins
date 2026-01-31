---
name: example-command
description: Working hello world command demonstrating argument parsing
allowed-tools: []
argument-hint: "[--name <value>] [--verbose]"
---

# Example Command - Hello World

This is a working command that demonstrates basic argument parsing and output.

## Instructions FOR Claude

When the user runs this command:

1. **Parse arguments:**
   - `--name <value>` - Name to greet (default: "World")
   - `--verbose` - Show detailed output (optional)

2. **Generate output:**

   **Basic mode:**
   ```
   Hello, [name]!

   This is a working example command from example-plugin.

   What this demonstrates:
   - Argument parsing (--name)
   - Simple output formatting
   - Basic command structure

   Try adding --verbose for detailed output!
   ```

   **Verbose mode:**
   ```
   🔍 Parsing arguments...
      --name: [value]
      --verbose: true

   ⚡ Executing example-command...

   Hello, [name]!

   This is a working example command from example-plugin.

   What this demonstrates:
   - Argument parsing (--name)
   - Simple output formatting
   - Basic command structure
   - Verbose mode output

   ✅ Command completed successfully
   ```

3. **Handle missing arguments:**
   - If no `--name` provided, use "World" as default
   - Never error on missing --name, just use the default

## Usage Examples

**Basic:**
```bash
/example-plugin:example-command
# Output: Hello, World!

/example-plugin:example-command --name "Alice"
# Output: Hello, Alice!
```

**Verbose:**
```bash
/example-plugin:example-command --name "Bob" --verbose
# Output: Detailed output with argument parsing shown
```

## Template Usage

To customize this command for your plugin:

1. Update `name:` and `description:` in frontmatter
2. Add necessary tools to `allowed-tools:` (currently empty for this demo)
3. Update argument handling for your use case
4. Replace output messages with your command's functionality

Keep commands focused on ONE clear action.

## Best Practices

### Argument Parsing
- Use clear, descriptive argument names (--name, --verbose, --output)
- Provide sensible defaults when possible
- Validate input and show helpful errors

### Output Formatting
- Use emojis for status (✅ ❌ 🔍 ⚡) to improve readability
- Structure output with clear sections
- Provide context about what the command accomplished

### Tool Usage
- Only request tools you actually need in `allowed-tools`
- Empty array `[]` is fine for simple output commands
- Common combinations:
  - Read-only: `["Read", "Grep", "Glob"]`
  - File ops: `["Read", "Write", "Edit"]`
  - Full automation: `["Read", "Write", "Bash"]`

### Command vs Skill vs Agent

**Use a command when:**
- User explicitly invokes an action with slash command
- Takes arguments/parameters
- Performs a discrete, immediate task

**Use a skill when:**
- Providing knowledge/workflows
- Triggered automatically by user questions
- Guiding Claude's behavior

**Use an agent when:**
- Task should run autonomously
- Complex multi-step workflow
- Benefits from specialized system prompt

## See Also

- Plugin skill: `skills/example-skill/SKILL.md`
- Plugin README: `README.md` in this directory
- Official docs: https://code.claude.com/docs/en/commands
