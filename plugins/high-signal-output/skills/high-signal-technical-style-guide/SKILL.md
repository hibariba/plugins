---
name: high-signal-technical-style-guide
description: High-signal technical writing guide for documentation artifacts. Use when writing or editing design docs, RFCs, ADRs, research reports, READMEs, specs, or any technical document where clarity and information density are critical. Enforces the High-Entropy Rule, BLUF structure, BCP 14 normative keywords, and precision vocabulary.
---

# High-Signal Technical Writing Style Guide

## North Star

Maximize reader utility per word. Keep only decision-relevant, non-obvious information. Delete everything else.

## Core Principles

### 1. High-Entropy Rule (Information Policy)

A sentence is allowed only if it does >= 1 of:
- Adds a new constraint, assumption, invariant, requirement, interface, or acceptance test
- Reduces meaningful uncertainty (numbers, bounds, evidence, confidence, failure modes)
- Changes a decision, priority, or next action
- Documents a non-goal (what we are explicitly not doing) that prevents wasted work

**Hard deletions:**
- Restating headings/titles
- Generic claims without measurable specifics ("robust", "simple", "best", "scalable", "important")
- Background not needed to interpret the decision/result
- Duplicates (same idea said twice)

**If content is useful but not decision-critical:** Move to an appendix, footnote, or link.

### 2. Normative Keywords (BCP 14)

Interpret these keywords exactly as in BCP 14 (RFC 2119 + RFC 8174):
- MUST, MUST NOT, REQUIRED
- SHOULD, SHOULD NOT, RECOMMENDED
- MAY, OPTIONAL

**Rule:** Only UPPERCASE carries normative meaning.

### 3. Audience Assumption

Default reader = competent engineer/researcher unfamiliar with this specific artifact.
- Don't teach basics they likely know
- Define local terms, abbreviations, and project-specific jargon once

### 4. Ordering (Reader-First)

Use inverted-pyramid / BLUF structure:
- Lead with the conclusion/recommendation/result
- Put details, rationale, and history later

**Default first section:** TL;DR (3–6 bullets)

### 5. "Show the Delta" Rule

When proposing changes, always state:
- what changes (before/after)
- what stays the same
- why now (trigger)
- how we know it worked (acceptance criteria)

## Standard Templates

### Decision / Design Doc (DEFAULT)

```
- TL;DR (result + decision + next step)
- Problem (1 paragraph max)
- Constraints & assumptions (bullets; quantify)
- Proposal (what changes; interfaces)
- Alternatives (2–4; why rejected)
- Risks / failure modes / mitigations
- Acceptance criteria (tests, metrics, rollout)
- Open questions (ranked by impact)
```

### Research Report / Experiment Note

```
- TL;DR (finding + implication + next step)
- Setup (minimal; only what affects interpretation)
- Method (enough to reproduce; link to code/data)
- Results (tables/figures; key numbers)
- Caveats (confounders, limitations)
- Decision impact (what changes now)
- Next experiments (smallest informative steps)
```

### Spec / RFC

```
- Abstract (what this enables; 3–5 lines)
- Goals / Non-goals
- Terms (only local definitions)
- Requirements (MUST/SHOULD/MAY)
- Interfaces (schemas, endpoints, contracts)
- State machine / flows (if applicable)
- Error handling & edge cases
- Security / privacy / safety considerations
- Test plan & acceptance criteria
- Rollout / compatibility / migration
```

### README (Repo or Module)

```
- What it is (1–2 lines)
- Quickstart (copy/paste)
- API/usage examples
- Config (only knobs that matter)
- Operational notes (limits, costs, failure modes)
- Links (full docs, ADRs, runbooks)
```

## Language Rules (Clarity + Compression)

- Prefer short sentences; one idea per sentence
- Prefer active voice and explicit actors ("Service A writes ...")
- Prefer concrete nouns/verbs over adjectives/adverbs
- Quantify: latency, cost, memory, accuracy, sample size, confidence, error bars, bounds
- Replace paragraphs with:
  - bullet lists for discrete points
  - tables for comparisons
  - math/notation for precision (only if it reduces ambiguity)
- Use consistent terminology; one name per concept

## Precision Vocabulary

**Prefer:**
- constraint, assumption, invariant, precondition, postcondition
- requirement, acceptance criterion, non-goal
- trade-off, risk, failure mode, edge case
- interface, contract, guarantee
- baseline, delta, metric, threshold, budget
- evidence, confidence, uncertainty

**Avoid unless quantified:**
- robust, simple, scalable, performant, optimal, best, easy, clearly, obviously, important

## Formatting Rules (Markdown)

- Use headings to encode hierarchy; avoid deep nesting (>3)
- Bullets: parallel grammar; no full paragraphs inside bullets
- Tables: when comparing >= 2 options across >= 3 dimensions
- Code blocks: minimal, runnable, with expected output when helpful
- Links: prefer canonical sources; don't paste long URLs inline unless in References

## Structure (Document Types)

Use Diátaxis categories to keep intent clean:
- **Tutorial**: learning path
- **How-to**: task completion steps
- **Reference**: precise facts/interfaces
- **Explanation**: concepts/why

Do not mix categories in one section. If needed, split.

## Agent Output Contract

When generating or editing artifacts, you MUST:
- Start with TL;DR bullets (unless the doc is pure reference)
- Apply the High-Entropy Rule sentence-by-sentence
- Convert vague statements into measurable criteria or delete them
- Surface constraints, assumptions, trade-offs, and failure modes explicitly
- Produce a final "Diff Summary" of what was removed/added and why (1–8 bullets)

You MUST NOT:
- Add motivational filler, obvious background, or generic best practices
- Repeat the prompt or restate headings as content
- Introduce new terminology without defining it once

## Quality Gates (Pre-Ship Checklist)

Before finalizing any document, verify:
- [ ] TL;DR exists and matches the body
- [ ] Every section answers: "What decision/action does this enable?"
- [ ] Requirements are testable (objective pass/fail)
- [ ] Assumptions are explicit; unknowns are tracked
- [ ] Alternatives considered; rejection reasons recorded
- [ ] Risks include mitigations and detection signals
- [ ] No duplicate ideas; no vague adjectives without numbers
- [ ] Links to code/data/runbooks exist where relevant

## Scoring Rubric (Quick Self-Audit)

Score 0–2 each:
- Signal density (no filler)
- Decision clarity (what to do, now)
- Testability (acceptance criteria)
- Explicit constraints/assumptions
- Failure modes covered
- Reproducibility (for research)

**Target:** >= 10/12 for publish; >= 8/12 for internal draft

## References

- BCP 14: RFC 2119 + RFC 8174 (normative keywords)
- Google Technical Writing (clarity; active voice)
- Microsoft Writing Style Guide ("make every word count")
- NARA Plain Language Principles ("major points first", active voice, short sentences)
- Diátaxis framework (doc types: tutorial/how-to/reference/explanation)
- Purdue OWL (inverted pyramid concept)
