# Retrospective Plugin

Systematic retrospectives after milestones or blockers to capture learnings and improve CLAUDE.md documentation.

## Overview

This plugin provides a structured approach to learning from development sessions. After completing milestones or resolving blockers, it guides you through analyzing what happened, identifying improvements, and updating project documentation to prevent recurring issues.

## Features

- **4-phase workflow**: Session Analysis → Improvement Identification → CLAUDE.md Updates → Decision Documentation
- **Selection criteria**: 4-test framework (Recurring, Discoverable, Actionable, General) ensures only valuable updates are documented
- **Templates**: Ready-to-use formats for Troubleshooting, Pre-Flight, Quick Reference sections
- **Examples**: Complete retrospectives showing real-world workflows

## When to Use

Invoke the skill after:
- **Milestones**: Completing a phase, finishing a feature branch, or before creating a PR
- **Blockers**: Resolving any issue that took >15 minutes
- **Explicit request**: Asking to analyze or improve processes
- **Quality gates**: Before merging code or transitioning to the next phase

Trigger phrases:
- "Run a retrospective"
- "Analyze what went wrong"
- "Improve documentation"
- "Learn from blockers"
- "Update CLAUDE.md based on issues"
- "Document this for future sessions"

## Structure

```
retrospective/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── retrospective/
│       ├── SKILL.md                    # Core workflow (~940 words)
│       ├── references/
│       │   └── claude-md-sections.md   # Section templates (~960 words)
│       └── examples/
│           ├── blocker-analysis.md     # Blocker retrospective example
│           └── milestone-review.md     # Milestone retrospective example
└── README.md
```

## Installation

```bash
# Test locally
cc --plugin-dir /path/to/plugins/retrospective

# Or copy to Claude Code plugins directory
cp -r retrospective ~/.claude-plugin/
```

## Usage Example

```
User: "That workspace package issue took 15 minutes to resolve. Let's document it."

Claude: [Invokes retrospective skill]
        [Analyzes session - identifies root cause]
        [Determines CLAUDE.md updates needed]
        [Applies updates using templates]
        [Documents decision and rationale]
```

## Key Concepts

### Selection Criteria

Only document issues that meet ALL four criteria:
- **Recurring**: Likely to happen again in similar contexts
- **Discoverable**: Can be found via error messages or symptoms
- **Actionable**: Has concrete solution or workaround
- **General**: Applies broadly, not specific to one environment

### Output Format

Retrospectives produce structured analysis:
- Session overview (goal, outcome, duration)
- What went well / didn't go well
- Root causes
- Recommended CLAUDE.md updates with rationale
- Final decision (update or skip, with justification)

## Version

0.1.0 - Initial release
