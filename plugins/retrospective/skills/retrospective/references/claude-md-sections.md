# CLAUDE.md Section Templates

Reference guide for formatting updates to different CLAUDE.md sections during retrospectives.

## Troubleshooting Section

**Purpose**: Document recurring errors with known solutions for quick discovery via error messages.

**Template:**
```markdown
### [Subsection Title - Problem Category]

**Symptom**: [Exact error message or observable behavior]

**Solution**: [Exact commands to fix]
```bash
# Step 1 description
command-one

# Step 2 description
command-two
```

**Additional context**: [Optional - when to expect this, what causes it]
```

**Example:**
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

**Context**: This occurs when working on workspace members that aren't auto-installed by `uv sync`. Always install in editable mode after creating new workspace packages.
```

**Anti-patterns:**
- "Fix the package installation issue" (not specific)
- Long explanations (keep to 1-2 paragraphs max)
- Conceptual solutions without exact commands

## Pre-Flight Checklist Section

**Purpose**: Verification steps before starting implementation to catch issues early.

**Template:**
```markdown
N. **[Check name]**:
   ```bash
   [verification command]  # Expected output: [description]
   ```
```

**Example:**
```markdown
2. **Install workspace package in editable mode**:
   ```bash
   uv pip install -e shared/dsl/  # Should complete without errors
   ```

3. **Verify package imports**:
   ```bash
   uv run python -c "import portfolio_dsl; print('OK')"  # Should print: OK
   ```
```

**Guidelines:**
- Each check should be independently verifiable
- Include expected output in comments
- Order checks logically (structure → installation → verification → testing)
- Keep checks minimal - only add what prevents common blockers

**Anti-patterns:**
- Vague checks: "Make sure everything works"
- Checks without commands: "Verify the setup is correct"
- Optional checks: Everything in pre-flight should be mandatory

## Quick Reference Section

**Purpose**: Frequently-used commands for common operations.

**Template:**
```bash
# [Description of what command does]
[exact command]
```

**Example:**
```bash
# Install workspace member in editable mode
uv pip install -e shared/dsl/

# Run unit tests only
uv run pytest -m unit -v

# Run tests for specific workspace member
uv run pytest tests/shared/dsl/ -v
```

**Guidelines:**
- One command per line, with inline comment
- Group related commands together
- Use exact commands that can be copy-pasted
- Keep descriptions short (one line)

**Anti-patterns:**
- Generic placeholders: `pytest [path]` (be specific)
- Multi-line explanations (use Troubleshooting section for that)
- Commands without comments

## Phase-Specific Instructions

**Purpose**: Workflow steps for specific development phases (e.g., "Phase 1: shared/dsl").

**Template:**
```markdown
### Phase X: [Phase Name]

**Prerequisites:**
- [Prerequisite 1]
- [Prerequisite 2]

**Implementation Steps:**

1. **[Step name]**:
   ```bash
   [commands for this step]
   ```

2. **[Step name]**:
   [procedural instructions]

**Verification:**
```bash
# Verify step 1
[verification command]

# Verify step 2
[verification command]
```
```

**Example:**
```markdown
### Phase 1: shared/dsl - Parser Implementation

**Prerequisites:**
- Databases running (`docker-compose up -d`)
- Workspace package installed (`uv pip install -e shared/dsl/`)
- Neo4j seeded (`uv run python scripts/seed_neo4j.py`)

**Implementation Steps:**

1. **Implement AST dataclasses** (`ast.py`):
   - Create frozen dataclasses for NamespaceNode, TransformNode, ExpressionNode
   - Add validation in `__post_init__`

2. **Write unit tests** (`test_ast.py`):
   ```bash
   uv run pytest tests/shared/dsl/unit/test_ast.py -v
   ```

**Verification:**
```bash
# All unit tests pass
uv run pytest tests/shared/dsl -m unit -v

# Package imports work
uv run python -c "from portfolio_dsl.ast import ExpressionNode; print('OK')"
```
```

**Guidelines:**
- Prerequisites prevent starting with missing setup
- Steps are ordered and actionable
- Verification confirms completion
- Keep focused on one phase

## Common Patterns Section

**Purpose**: Reusable code patterns and architectural conventions.

**Template:**
```markdown
### [Pattern Name]

**Purpose**: [What this pattern achieves]

**Usage:**
```[language]
[code example]
```

**When to use**: [Specific scenarios]
```

**Example:**
```markdown
### Repository Usage

**Purpose**: Encapsulate database access and handle errors consistently

**Usage:**
```python
# In service layer
async def get_portfolio(portfolio_id: str) -> Portfolio:
    portfolio = await self.portfolio_repo.find_by_id(portfolio_id)
    if not portfolio:
        raise PortfolioNotFoundError(portfolio_id)
    return portfolio
```

**When to use**: Any service-layer method that accesses Neo4j or MySQL data
```

**Guidelines:**
- Focus on patterns that appear 3+ times in codebase
- Show concrete code, not abstract descriptions
- Include when to use (and when not to use)

## Notes for AI Assistants Section

**Purpose**: Instructions and reminders for AI assistants working on the codebase.

**Template:**
```markdown
N. **[Principle name]**: [Instruction or reminder]. [Elaboration if needed].
```

**Example:**
```markdown
7. **Learn from blockers**: After resolving any blocker that took >15 minutes, consider if it should be documented in CLAUDE.md to prevent recurrence. Use `/retrospective` skill after completing milestones.
```

**Guidelines:**
- Keep numbered list format
- Each note should be actionable
- Focus on non-obvious principles
- Reference tools/skills when relevant

## Decision: When to Add vs. Skip

Use this decision tree:

```
Is the issue likely to recur?
├─ No → Skip documentation
└─ Yes → Continue
         ├─ Is it discoverable via error message?
         │  ├─ No → Skip documentation
         │  └─ Yes → Continue
         │           ├─ Is there a concrete solution?
         │           │  ├─ No → Skip documentation
         │           │  └─ Yes → Continue
         │           │           ├─ Does it apply generally?
         │           │           │  ├─ No → Skip documentation
         │           │           │  └─ Yes → Document it!
```

**Examples of what NOT to document:**
- One-off environment issues (Python version mismatch on specific machine)
- Obvious errors (typo in file name)
- External service outages (GitHub down)
- Already documented elsewhere in CLAUDE.md
- Issues with no known solution yet

**Examples of what TO document:**
- Workspace package installation (recurring for each new member)
- Database connection setup (recurring across sessions)
- Test execution patterns (recurring for each phase)
- Build configuration issues (recurring in similar projects)
