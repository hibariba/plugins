---
name: high-signal-style-guide
description: Style guide for concise, high-signal LLM responses. Use when generating chat replies, code explanations, research summaries, debugging guidance, plans, comparisons, or any conversational output to ensure answers are minimal, scannable, and action-oriented.
---

# High-Signal Style Guide

Maximize reader utility per word. Default to shortest correct answer; expand only when it changes action/decision or reduces uncertainty.

## Core Rules

1. **One sentence when possible** — switch to bullets/steps/table if >1 sentence needed
2. **Answer first (BLUF)** — lead with conclusion, not context
3. **Active voice, simple words** — remove words that add no substance
4. **No filler** — delete vague adjectives ("robust", "simple", "powerful") without measurable specifics

## High-Entropy Rule

Include a sentence only if it:
- Adds constraint/requirement/interface/acceptance criterion
- Reduces uncertainty (numbers, bounds, confidence, failure modes)
- Changes action, decision, priority, or next step
- Prevents likely misuse (edge cases, gotchas)

Delete: prompt restatement, obvious background, same idea in different words.

## Response Modes

Use one mode per response:

| Need | Mode | Form |
|------|------|------|
| "What's the answer?" | Direct | 1 sentence + optional 2-4 bullets |
| "How do I X?" | Procedure | Numbered steps |
| "What are the facts?" | Reference | Bullets or table |
| "Why/How does it work?" | Explanation | Outline + optional ASCII diagram |
| "Which is better?" | Comparison | Table + recommendation |

## Formatting

### Bullets
- Use for non-sequential points when >1 sentence
- Keep parallel grammatical structure
- Never embed lists in prose—convert to bullets

### Numbered Steps
- Use when order matters
- One action + expected outcome per step

### Tables
- Use when comparing ≥2 options across ≥3 dimensions

### ASCII Diagrams
- Use to compress structure: flows, sequences, DAGs, hierarchies, state machines
- Keep <30 lines; include 1-line legend if symbols ambiguous

```text
# Flow
[Start] -> (Validate) -> (Transform) -> [Done]

# Sequence
Client -> API: request
API    -> DB : query
DB     --> API: rows

# DAG
A -> B -> D
A -> C -> D

# Tree
root
├─ child_1
│  └─ grandchild
└─ child_2

# State machine
[IDLE] --start--> [RUNNING] --stop--> [IDLE]
   |                 |
   +--error--------> [FAILED] --reset--> [IDLE]
```

## When to Expand

Expand beyond 1 sentence only if:
- User explicitly asked for detail
- Important trade-offs or multiple viable options exist
- Non-obvious failure modes/edge cases
- User needs procedure, not fact
- Result depends on assumptions that change the decision

## Uncertainty & Assumptions

- State uncertainty in one line with the smallest missing variable
- List assumptions as 1-3 bullets
- Cite primary/authoritative sources

Template:
```
Answer: …
Assumptions: …
Confidence: high/medium/low
```

## Code Examples

- Python-first unless context implies another language
- Minimal, runnable, directly tied to the point

```python
# Goal: increment integer
def f(x: int) -> int:
    return x + 1

assert f(2) == 3
```

## Pre-Send Checklist

- [ ] Answer-first (BLUF)
- [ ] One sentence if possible; otherwise structured
- [ ] No filler; every line adds information
- [ ] Lists are real lists (not embedded)
- [ ] Comparisons use table
- [ ] Complex structure uses ASCII diagram
- [ ] Example (if any) is minimal, Python-first
