---
name: retrospective
description: This skill should be used when completing a milestone, encountering a blocker that took >15 minutes, finishing a feature branch, or when the user asks to "run a retrospective", "analyze what went wrong", "improve documentation", "learn from blockers", "update CLAUDE.md based on issues", or "document this for future sessions". Analyzes recent work to identify process improvements and updates project documentation systematically.
---

# Retrospective

Conduct systematic retrospectives after milestones or blockers to capture learnings and improve project documentation, preventing recurring issues in future sessions.

## Purpose

Transform blockers and milestones into documentation improvements. Each retrospective identifies gaps in CLAUDE.md that, if filled, would prevent similar issues or accelerate similar work in the future.

## When to Invoke

Trigger this skill after:
- **Milestones**: Completing a phase, finishing a feature branch, or before creating a PR
- **Blockers**: Resolving any issue that took >15 minutes
- **Explicit request**: User asks to analyze or improve processes
- **Quality gates**: Before merging code or transitioning to the next phase

## Retrospective Workflow

### Phase 1: Session Analysis

Review the recent work session to understand what happened:

**Goal Assessment:**
- What was the intended outcome?
- Was it achieved? If not, what changed?

**Success Identification:**
- What worked smoothly and efficiently?
- What patterns or approaches should be repeated?
- What existing documentation proved helpful?

**Failure Analysis:**
- What caused delays or confusion?
- What assumptions were incorrect?
- What information was missing or hard to find?

**Root Cause Determination:**
- Why did blockers occur? (missing docs, unclear process, environment issues)
- What would have prevented them? (pre-flight check, troubleshooting entry, command reference)

### Phase 2: Improvement Identification

Determine actionable documentation changes:

**Missing Commands:**
- What exact commands would have saved time?
- Where in CLAUDE.md should they live? (Quick Reference vs. Troubleshooting)

**Missing Checks:**
- What verification steps would catch issues earlier?
- Should they be in Pre-Flight Checklist or phase-specific instructions?

**Missing Troubleshooting:**
- What error messages or symptoms lacked guidance?
- What solutions are reusable for similar issues?

**Process Gaps:**
- What workflow steps were unclear or undocumented?
- What assumptions need to be made explicit?

### Phase 3: CLAUDE.md Updates

Apply targeted improvements using the templates in `references/claude-md-sections.md`.

**Target Sections:**

| Section | When to Add | Format |
|---------|-------------|--------|
| **Troubleshooting** | Recurring errors with known solutions | Symptom → Solution |
| **Pre-Flight Checklist** | Setup verification steps | Numbered checklist with commands |
| **Quick Reference** | Frequently-used commands | Commented bash commands |
| **Phase Instructions** | Workflow steps for specific phases | Ordered procedures |

**Update Guidelines:**
- Include exact commands, not conceptual descriptions
- One paragraph maximum per entry
- Focus on actionable, testable information
- Avoid documenting environment-specific or one-off issues

**Selection Criteria** (only document if ALL apply):
- **Recurring**: Likely to happen again in similar contexts
- **Discoverable**: Can be found via error messages or symptoms
- **Actionable**: Has concrete solution or workaround
- **General**: Applies broadly, not specific to one environment

### Phase 4: Decision Documentation

Record what was changed and why:

**If updates were made:**
```markdown
## Retrospective: [Date] - [Brief Title]

**Issue**: [What blocked or slowed progress]
**Root Cause**: [Why it occurred]
**Solution**: [What was added to CLAUDE.md]
**Location**: [Section/line number where added]
**Prevents**: [What this will prevent in future sessions]
```

**If no updates were made:**
```markdown
## Retrospective: [Date] - [Brief Title]

**Issue**: [What occurred]
**Decision**: No documentation update
**Reasoning**: [Why - e.g., "Environment-specific", "Already documented in section X", "One-off situation"]
```

Save decision log to project scratchpad or append to CLAUDE.md under "## Retrospective Log" section if maintaining history.

## Verification Checklist

After updating CLAUDE.md, validate documentation quality:

- [ ] **Discoverability**: Would future Claude/developer find this via error message or symptom?
- [ ] **Exactness**: Are exact commands included, not just concepts?
- [ ] **Testability**: Can the solution be verified to work?
- [ ] **Clarity**: Is the symptom description clear from outside perspective?
- [ ] **Placement**: Is it in the right section for discovery?

## Output Format

Present findings in this structure:

```markdown
# Retrospective Analysis

## Session Overview
- **Goal**: [What was being attempted]
- **Outcome**: [Success/Partial/Blocked]
- **Duration**: [Time spent, including blocker time]

## What Went Well
- [Success 1]
- [Success 2]

## What Didn't Go Well
- [Issue 1: Description + time lost]
- [Issue 2: Description + time lost]

## Root Causes
- [Cause 1: Why issue occurred]
- [Cause 2: Why issue occurred]

## Recommended CLAUDE.md Updates

### [Section Name] - [Add/Update]
**Change**: [Exact text or command to add]
**Rationale**: [Why this prevents recurrence]
**Assessment**: [Meets/Doesn't meet selection criteria]

## Decision
[Whether to update CLAUDE.md and why]
```

## Example Retrospective

See `examples/blocker-analysis.md` for a complete retrospective of a workspace package installation blocker, and `examples/milestone-review.md` for a phase completion retrospective.

## Additional Resources

### Reference Files

- **`references/claude-md-sections.md`** - Templates for each CLAUDE.md section type with examples

### Example Files

- **`examples/blocker-analysis.md`** - Retrospective after resolving a 15-minute blocker
- **`examples/milestone-review.md`** - Retrospective after completing a development phase

## Best Practices

**Selectivity**: Not every issue deserves documentation. Apply selection criteria rigorously.

**Specificity**: "Add pre-flight check" is vague. "Add `uv pip install -e shared/dsl/` to step 2 of Pre-Flight Checklist" is actionable.

**Testability**: Every addition should be verifiable. Commands should be runnable, symptoms should be reproducible.

**Brevity**: CLAUDE.md is a reference, not a manual. One paragraph maximum per entry keeps it scannable.

**Meta-learning**: The retrospective process itself should improve over time. If retrospectives consistently miss important updates, adjust the analysis framework.
