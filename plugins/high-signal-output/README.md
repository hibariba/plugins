# high-signal-output

High-signal writing style guides for Claude Code — concise LLM responses and technical documentation.

## Skills

| Skill | Triggers On |
|-------|-------------|
| `high-signal-style-guide` | Chat replies, explanations, debugging, plans, comparisons |
| `high-signal-technical-style-guide` | Design docs, RFCs, ADRs, READMEs, specs, research reports |

## Core Principle

**High-Entropy Rule:** Include content only if it adds constraints, reduces uncertainty, changes decisions, or prevents misuse. Delete everything else.

## Installation

```bash
claude --plugin-dir /path/to/high-signal-output
```

Or add to your project's `.claude-plugin/` directory.

## Usage

Skills trigger automatically based on context:
- Ask Claude to explain code → uses response style guide
- Ask Claude to write a design doc → uses technical style guide

## License

MIT
