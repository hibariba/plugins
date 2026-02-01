# Example Retrospective: Workspace Package Installation Blocker

This example demonstrates a retrospective after encountering and resolving a blocker during Phase 1 DSL implementation.

## Session Overview

- **Goal**: Implement AST dataclasses and unit tests for Phase 1 (shared/dsl)
- **Outcome**: Success (after 15-minute blocker)
- **Duration**: 45 minutes total (15 minutes blocked, 30 minutes productive)
- **Blocker**: `ModuleNotFoundError: No module named 'portfolio_dsl'` when running tests

## What Went Well

1. **TDD approach worked smoothly**: Writing tests immediately after implementation caught any issues
2. **Clear task tracking**: Todo items made progress visible
3. **Frozen dataclasses**: Immutability validation in AST prevented bugs
4. **Lark grammar**: EBNF format allowed complete DSL syntax in ~50 lines

## What Didn't Go Well

1. **Build configuration blocker** (~5 minutes):
   - Root `pyproject.toml` missing hatchling wheel configuration
   - Error: "Unable to determine which files to ship inside the wheel"
   - Had to add manual `[tool.hatch.build.targets.wheel]` config

2. **Workspace package not installed** (~10 minutes):
   - Tests failed with `ModuleNotFoundError: No module named 'portfolio_dsl'`
   - `uv sync` didn't auto-install workspace members
   - Had to manually run `uv pip install -e shared/dsl/`

3. **Missing pre-flight verification** (~0 minutes but preventable):
   - Started writing tests before verifying package could be imported
   - Could have caught issue earlier with import check

## Root Causes

1. **Build config**: Root project using hatchling but with no source code (workspace-only)
2. **Workspace installation**: uv workspaces require explicit editable installs for members
3. **Documentation gap**: CLAUDE.md had no guidance on workspace package setup

## Recommended CLAUDE.md Updates

### 1. Troubleshooting → New Subsection

**Change**: Add "Workspace Package Installation" subsection
```markdown
### Workspace Package Installation

**Symptom**: `ModuleNotFoundError: No module named 'portfolio_dsl'` when running tests

**Solution**: Install workspace packages in editable mode:
```bash
# Install specific workspace member
uv pip install -e shared/dsl/

# Or install all workspace members at once
uv pip install -e shared/dsl/ -e shared/orm/ -e services/portfolio-service/ -e services/library-service/
```

**Root pyproject.toml build errors**: If `uv sync` fails with "Unable to determine which files to ship", the root package needs hatchling configuration:
```toml
[tool.hatch.build.targets.wheel]
packages = ["."]
only-include = ["main.py"]
```
```

**Rationale**: This exact error will recur when working on shared/orm, services/*, or when new contributors set up the project.

**Assessment**:
- Recurring (happens for each workspace member)
- Discoverable (exact error message provided)
- Actionable (concrete commands to fix)
- General (applies to all workspace members)

**Verdict**: MEETS criteria - should be documented

### 2. Pre-Flight Checklist → New Section

**Change**: Add entire "Pre-Flight Checklist" section after Quick Reference
```markdown
## Pre-Flight Checklist

Before starting implementation on a new workspace member (shared/*, services/*):

1. **Verify workspace structure** exists:
   ```bash
   ls shared/dsl/pyproject.toml  # Should exist
   ```

2. **Install workspace package in editable mode**:
   ```bash
   uv pip install -e shared/dsl/  # Or whichever package you're working on
   ```

3. **Verify package imports**:
   ```bash
   uv run python -c "import portfolio_dsl; print('OK')"
   ```

4. **Run existing tests** (should pass or be empty):
   ```bash
   uv run pytest tests/shared/dsl/ -v
   ```

If any step fails, fix it before implementing new features.
```

**Rationale**: Pre-flight checks prevent starting work with broken setup. Would have caught the import issue before writing tests.

**Assessment**:
- Recurring (needed for each new workspace member)
- Discoverable (catches issues proactively)
- Actionable (clear verification steps)
- General (applies to all workspace implementation)

**Verdict**: MEETS criteria - should be documented

### 3. Notes for AI Assistants → New Note

**Change**: Add note #7
```markdown
7. **Learn from blockers**: After resolving any blocker that took >15 minutes, consider if it should be documented in CLAUDE.md to prevent recurrence. Use `/retrospective` skill after completing milestones.
```

**Rationale**: Creates feedback loop for continuous documentation improvement.

**Assessment**:
- Recurring (blockers happen regularly)
- Discoverable (AI assistants see this section)
- Actionable (references specific skill)
- General (applies to all development work)

**Verdict**: MEETS criteria - should be documented

## Decision

**Action**: UPDATE CLAUDE.md with all three recommended changes

**Justification**:
1. All changes meet the 4-criteria test (Recurring, Discoverable, Actionable, General)
2. Changes are minimal and high-impact (prevent 15-minute blockers)
3. Exact commands provided (copy-paste ready)
4. Will benefit future sessions on shared/orm, services/*, and new contributors

**Implementation**:
- Added Troubleshooting → Workspace Package Installation section
- Added Pre-Flight Checklist section after Quick Reference
- Added Notes for AI Assistants #7 about retrospectives

**Verification**:
- Symptom description matches actual error message
- Commands are exact and testable
- Placement in sections aids discovery
- Concise (1 paragraph per entry)

## Meta-Learning

**About the retrospective process itself**:
- Taking 5 minutes for retrospective after 15-minute blocker is 25% overhead but prevents recurrence
- Having templates (this example) makes retrospectives faster
- Selection criteria (4 tests) prevents documentation bloat
- Next retrospective will be faster with these templates established
