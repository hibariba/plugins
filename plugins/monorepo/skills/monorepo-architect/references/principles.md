# Monorepo Management Principles

Foundational principles that determine long-term success independent of tooling choice. These practices enabled Google, Meta, and Microsoft to scale to hundreds of thousands of developers.

## Atomic Commits

Atomic commits allow logically related changes spanning multiple packages to land together in a single commit, eliminating broken intermediate states.

### Definition

An atomic commit represents a complete, logically coherent change that:
- Compiles/runs without errors
- Maintains all tests passing
- Does not break dependent packages
- Is reversible with a single `git revert`

**Atomic commits ≠ atomic releases**: You can merge atomic commits to main while deployments remain independent per-package.

### Example: Cross-package refactoring

**Bad (non-atomic)**:

```bash
# Commit 1: Refactor shared-lib API
git commit -m "shared-lib: rename authenticate() → auth()"

# Commit 2: Update auth-service to use new API
git commit -m "auth-service: update to use new auth() function"

# Problem: Between commits, tests fail; CI breaks; other branches diverge
```

**Good (atomic)**:

```bash
# Single atomic commit
git add packages/shared-lib/src/auth.py
git add packages/auth-service/src/main.py
git commit -m "Refactor: rename authenticate() → auth() across shared-lib and auth-service

- shared-lib: rename function and update exports
- auth-service: update all call sites
- All tests passing
- auth-service is only dependent package"

# Benefits: Clean bisect history, easy rollback, CI never broken
```

### Atomic Commits in Practice

**Enable atomic commits with tooling**:

```bash
# Pre-commit hook to ensure related changes together
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Warn if changing both pyproject.toml and imports without test changes
CHANGED_FILES=$(git diff --cached --name-only)

if echo "$CHANGED_FILES" | grep -q "pyproject.toml" && \
   echo "$CHANGED_FILES" | grep -q "\.py$" && \
   ! echo "$CHANGED_FILES" | grep -q "test"; then
  echo "⚠️  Warning: Modifying dependencies without test changes"
  echo "   Ensure tests cover changes before committing"
fi
EOF

chmod +x .git/hooks/pre-commit
```

**Enforce at merge time**:

```bash
# CI check: prevent merging commits that break tests on their own
# (not just tests passing with later commits)

git rebase origin/main --exec pytest

# Each commit should be independently testable
```

### Google's Piper Implementation

Google requires that every commit to Piper (their monorepo) passes all tests for affected code at commit time:

```python
# Simplified Piper logic
def validate_commit(commit):
    affected_tests = find_affected_tests(commit)
    return run_tests(affected_tests).passed
```

This prevents all intermediate broken states.

---

## Single Version Policy

Exactly one version of each external dependency exists across the entire monorepo. No diamond dependency problems, no "works on my machine" issues.

### Rationale

With multiple versions of the same package, you get:

**Diamond dependency problem** (classic):
```
┌─────────────────┐
│   api-gateway   │
├─────────────────┤
│ depends on:     │
│ - auth==2.0     │
│ - utils==1.0    │
└────────┬────────┘
         │
┌────────────────────┐      ┌──────────────┐
│   auth (lib)       │      │  utils (lib) │
├────────────────────┤      ├──────────────┤
│ depends on:        │      │ depends on:  │
│ - pydantic==2.5    │      │ - pydantic==2.3
└────────────────────┘      └──────────────┘

Result: Two pydantic versions in dependency tree
→ Type mismatches at runtime
→ Security patch fragmentation
```

**Single version solution**:
```
All packages use pydantic==2.5 (chosen version)
auth library accepts 2.5 or higher
utils library accepts 2.3+, compatible with 2.5
No conflicts
```

### Implementation

**Root-level dependency management** (uv, pnpm):

```toml
# pyproject.toml (root workspace)
[tool.uv.sources]
pydantic = ">=2.5,<3.0"  # Single version policy
sqlalchemy = ">=2.0,<3.0"
requests = ">=2.31,<3.0"

# All packages use these versions
# packages/auth/pyproject.toml
[project]
dependencies = ["pydantic"]  # Inherits >=2.5,<3.0 from root
```

**Enforcement in CI/CD**:

```bash
#!/bin/bash
# Detect multiple versions of same package
python << 'EOF'
import tomllib
import json

# Parse all pyproject.toml files
packages = glob.glob("packages/*/pyproject.toml")
deps = defaultdict(set)

for pkg_file in packages:
    with open(pkg_file) as f:
        config = tomllib.load(f)
        for dep in config.get("project", {}).get("dependencies", []):
            name = parse_package_name(dep)
            deps[name].add(dep)

# Report violations
for pkg, versions in deps.items():
    if len(versions) > 1:
        print(f"❌ Multiple versions of {pkg}: {versions}")
        exit(1)

print("✓ Single version policy maintained")
EOF
```

### Version Update Strategy

**Annual major dependency upgrade**:

```bash
# 1. Audit new versions
pip-audit -u  # Show new versions available

# 2. Upgrade in root pyproject.toml
[tool.uv.sources]
pydantic = ">=3.0,<4.0"  # Major version bump

# 3. Test comprehensively across all packages
uv sync --all-packages
pytest packages/ -v --tb=short

# 4. If conflicts: negotiate between teams
# e.g., "new pydantic breaks auth library; waiting for patch"

# 5. Document decision
git commit -m "chore: upgrade pydantic to 3.0

Rationale: 2.0 EOL approaching, 3.0 available
Breaking changes:
- auth library needed refactoring (updated)
- processor library compatible without changes

Tested against all packages"
```

**Security patch cadence**:

```bash
# Within 48 hours of critical CVE
pip list --outdated | grep -i "CRITICAL"

# Update single dependency
uv pip compile -r requirements.txt --upgrade-package vulnerable-pkg

# Test and deploy immediately (bypass normal review)
```

### Google's Version Policy

Google takes single version policy furthest: internal packages have NO version numbers.

```python
# Google's Piper monorepo
import auth  # Always HEAD of auth package
# No version specified; always latest (committed) version

# Rationale: Continuous integration requires HEAD compatibility
# Breaking changes require coordinated migration with dependent code
```

This works at Google's scale because:
- Atomic commits ensure HEAD is always working
- File-level build system (Blaze/Bazel) ensures affected-only testing
- Strict code review process prevents breaking changes
- Large teams can coordinate major migrations

---

## Trunk-Based Development

Short-lived feature branches (1-3 days), frequent merges to main, main branch always deployable.

### Rationale

**Long-lived branches create**:
- Merge hell when integrating (conflicts, hidden dependency shifts)
- Duplicate test runs (same tests on branch + main)
- Stale code (becomes out-of-date vs main)
- Risk concentration (big bang merge)

**Trunk-based development**:
- Main branch is production-ready at all times
- Features merged daily with high confidence
- Conflicts found and fixed immediately
- CI/CD pipeline simple (test main → deploy)

### Implementation Pattern

```bash
# Feature development
git checkout -b feat/user-auth
# ... make changes ...
# Tests pass locally and in CI

# Code review + merge (target: <1 day)
git push origin feat/user-auth
# Create PR
# Review + approval
git switch main && git pull
git merge feat/user-auth --ff-only  # Fast-forward only
git push origin main

# Branch deleted
git branch -d feat/user-auth
```

**Pre-merge checklist**:

```yaml
# .github/workflows/merge-check.yml
name: Pre-merge Verification

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Test must pass on current main BEFORE your changes
      - name: Verify base branch is clean
        run: |
          git fetch origin main
          git checkout origin/main
          pytest packages/ -v

      # Test must pass WITH your changes
      - name: Verify feature branch
        run: |
          git checkout ${{ github.head_ref }}
          uv sync --all-packages
          pytest packages/ -v

      - name: Verify no lint regressions
        run: black --check packages/

      # Require branch protection
      - name: Check branch protection
        run: |
          # GitHub Actions does not allow manual enforcement
          # Configure in repo settings:
          # - Require PR review before merge (1+ approvers)
          # - Dismiss stale reviews on push
          # - Require branches up to date with base
          # - Require status checks to pass
          # - Admin bypass disabled
          echo "Branch protection must be configured in GitHub settings"
```

### Feature Flags for Main Branch Deployment

Not all features are production-ready when code merges to main. Use feature flags:

```python
# common/flags.py
class FeatureFlags:
    NEW_PAYMENT_SYSTEM = os.getenv("FEATURE_NEW_PAYMENT") == "true"
    OPTIMIZED_AUTH = os.getenv("FEATURE_OPTIMIZED_AUTH") == "true"

# apps/api/main.py
if FeatureFlags.NEW_PAYMENT_SYSTEM:
    from features.new_payment import PaymentProcessor
else:
    from features.legacy_payment import PaymentProcessor

# Deployment:
# 1. Merge code with new_payment system (feature flag OFF)
# 2. Main branch is stable and deployable
# 3. Enable flag gradually per region
# 4. Remove flag and cleanup once fully rolled out
```

### Trunk-Based Development at Scale

**Meta's approach** (Sapling VCS):
- 100,000+ commits/day to single shared repository
- 95% of changes bypass human review (automatable changes)
- 5% of changes require human review (business logic)
- Every change must pass CI before landing on trunk
- Deployment independent of code merge

**Google's approach** (Piper):
- Changes land on trunk after code review + CI passing
- Per-package deployment (not all-or-nothing)
- Continuous deployment pipeline (release multiple times/day)

---

## Code Ownership via CODEOWNERS

Define clear ownership without blocking collaboration.

### CODEOWNERS File Format

```gitignore
# .github/CODEOWNERS or .gitea/CODEOWNERS

# Catch-all: all files owned by platform team
* @org/platform-team

# Specific path: frontend team owns UI
packages/frontend/** @org/frontend-team

# Shared package: both teams need to review
packages/shared/** @org/frontend-team @org/backend-team

# Database migrations: require DBA + security lead
infrastructure/migrations/** @org/dba-team @org/security-lead

# Pattern: only last matching rule applies
packages/frontend/tests/** @org/qa-team  # Override parent rule
```

### Enforcing Code Review

**GitHub branch protection rule**:

```bash
# In repository settings:
# - Require pull request reviews before merging: enabled
# - Required number of reviewers: 1
# - Dismiss stale pull request approvals: enabled
# - Require code owner reviews: enabled  # Uses CODEOWNERS file
# - Require status checks to pass before merging: enabled
```

**Example flow**:

```
1. Developer creates PR modifying packages/shared/**
2. GitHub automatically adds @org/frontend-team and @org/backend-team as reviewers
3. Merge button disabled until BOTH teams approve
4. Once approved + CI passes: merge enabled
```

### CODEOWNERS Best Practices

**Use teams, not individuals**:

```gitignore
# Good
packages/auth/** @org/auth-team

# Bad (person leaves team)
packages/auth/** @alice @bob @charlie
# Bob leaves → code review blocked for 2 weeks
```

**Define ownership at appropriate granularity**:

```gitignore
# Too coarse: everything needs all teams to review
* @org/frontend-team @org/backend-team

# Too fine: ownership fragmented
packages/frontend/components/Button.tsx @alice
packages/frontend/components/Input.tsx @bob
packages/frontend/components/Form.tsx @charlie

# Right balance: by feature area
packages/frontend/components/** @org/frontend-team
packages/frontend/pages/** @org/frontend-team
packages/shared/** @org/frontend-team @org/backend-team
packages/backend/** @org/backend-team
```

**Allow some unblocking mechanisms**:

```gitignore
# Security hotfixes can bypass normal review
security/** @org/security-team

# Documentation doesn't require code owner review
docs/** @org/documentation
*.md @org/documentation

# Build/infra can be fast-tracked with one reviewer
.github/** @org/devops-team
infrastructure/** @org/devops-team
```

---

## Common Anti-Patterns to Avoid

### 1. Monorepo as Monolith

**Problem**: No clear package boundaries; code scattered across random locations.

```
monorepo/
├── src/
│   ├── auth.py
│   ├── payments.py
│   ├── users.py
│   ├── notifications.py
│   ├── utils.py
│   └── ... 200 more files

# No clear ownership, circular dependencies likely, slow to navigate
```

**Solution**: Enforce clear structure with build system validation

```
monorepo/
├── packages/
│   ├── auth/
│   │   ├── pyproject.toml
│   │   ├── src/
│   │   └── tests/
│   ├── payments/
│   ├── users/
│   └── shared/
├── apps/
│   └── api-gateway/

# Build system validates:
# - No imports across packages without declaring dependencies
# - No circular dependencies
# - Clear ownership boundaries (CODEOWNERS)
```

### 2. No Tooling Investment

**Problem**: Slow builds, developer frustration, brain drain.

```bash
# Scenario: 45-minute test suite
pytest packages/ -v

# Developer experience:
# 8:00am - commit code
# 8:45am - finish coffee, test results ready
# Too slow for feedback loop; developers context-switch
```

**Solution**: Invest in CI/CD and build tooling

```bash
# Same code, with Pants + remote caching:
pants test packages/ --remote-cache-read --remote-cache-write
# Typical: 5-10 minutes with cache hits
# Developer can review peer code while waiting
# 3-4x faster feedback loop improves quality

# ROI: 35 min saved × 50 devs × 250 days = 145,000 minutes/year
# = $72,500 in developer time (at $30/hr)
```

### 3. Full Test Suite on Every Commit

**Problem**: CI times grow linearly with repo size; becomes unmanageable at scale.

```bash
# Every commit runs 1000 tests (takes 45 min)
pytest packages/ apps/ -v

# 50 developers, 3 commits/day each = 450 test runs
# 450 × 45 min = 20,250 machine-hours per day
# Cost: ~$8,000/day on CI infrastructure alone
```

**Solution**: Implement affected-only testing

```bash
# Only run tests for changed packages
pants --changed-since=origin/main --changed-dependents=transitive test

# Most commits: 50-200 affected tests (5-10 min)
# Large refactors: 500-1000 tests (20-30 min)
# Rare incidents: full suite (40 min)

# Average: 8 minutes × 450 = 3,600 minutes/day
# Cost: ~$1,400/day (82% savings)
```

### 4. Inconsistent Dependency Versions

**Problem**: Works locally but fails in CI (different versions).

```bash
# Local environment:
pip install pydantic  # Installs latest: 2.5

# CI environment (old requirements.txt):
pip install -r requirements.txt  # Pins pydantic==2.3

# Code written for pydantic 2.5 features
# Fails in CI with mysterious errors

# Worse: Different developers have different versions
```

**Solution**: Use lock files + single version policy

```bash
# uv.lock is checked into git
uv sync --frozen  # Guaranteed identical versions everywhere

# pyproject.toml declares constraints
[project]
dependencies = ["pydantic>=2.5,<3.0"]

# uv.lock records exact version
# pydantic==2.5.1

# Every developer, every CI run: same version
```

### 5. Poor Documentation

**Problem**: New team members can't onboard; shared knowledge lost when people leave.

```bash
# Developer onboarding:
# Q: How do I run tests?
# A: "You know, uv sync... then... pytest? something like that"
# After 3 hours, finally figures it out
```

**Solution**: Document in CLAUDE.md or wiki

```markdown
# Project Structure

## Commands

### Development Setup
```bash
uv sync --all-packages
```

### Running Tests
```bash
# All tests
pytest packages/

# Specific package
pytest packages/auth/

# With coverage
pytest --cov=packages packages/
```

### Build and Deploy
```bash
# Build package
uv build -p packages/auth

# Deploy to staging
./scripts/deploy.sh staging packages/auth
```

## Adding a New Package

1. Create `packages/newpkg/pyproject.toml`
2. Run `pants tailor ::` (if using Pants)
3. Add to `pyproject.toml` workspace members
4. Update CODEOWNERS with team ownership
```

---

## Large-Scale Implementations

### Google (Piper Monorepo)

**Scale**:
- 86+ TB of source code
- Billions of lines (estimated 5-10 billion)
- 100,000+ developers
- 150,000+ daily commits
- All languages: C++, Python, JavaScript, Go, Java, etc.

**Key principles implemented**:
- **Atomic commits**: Every change tested before committing to trunk
- **Single version policy**: No version numbers for internal deps
- **Trunk-based development**: ~95% of changes bypass review (automatable)
- **File-level build system**: Bazel-based Blaze (custom build system)
- **Expansible checkouts (CitC)**: Developers work on virtual views of monorepo (don't need full copy)

**Technology stack**:
- VCS: Piper (custom, based on Perforce concepts)
- Build: Blaze/Bazel
- CI/CD: Integrated with VCS
- Code review: Integrated review + tests before merge
- Deployment: Per-package, continuous

### Meta (Sapling + Buck)

**Scale**:
- 10+ million files
- 100,000+ developers
- Petabytes of storage (including history)
- Multiple languages: Python, C++, JavaScript, Hack (PHP variant)

**Key principles**:
- **Trunk-based development**: 100,000+ commits daily to shared main
- **Sapling VCS**: Mercurial-based, optimized for large monorepos
- **Buck build system**: Similar to Bazel but JavaScript-focused
- **Continuous deployment**: Can release new code to production within minutes

**Unique aspect**: High-trust culture where most code changes don't require human review (automated checks sufficient).

### Microsoft (VFS for Git)

**Scale**:
- Windows repository: 3.5+ TB on disk
- 4+ million files
- 300+ GB of source code
- 50+ years of Git history

**Problem**: Standard Git scales poorly on Windows with large repos

**Solution**: VFS for Git (Virtual File System for Git)
- Only required files downloaded/available at working directory
- Massive speedup for clone (hours → minutes)
- Supports monorepo patterns despite Git limitations

**Pattern**: Still recommends polyrepo for independent projects, monorepo for tightly-coupled codebases.

---

## Implementing Atomic Commits in Your Organization

**1. Add pre-commit hook**:

```bash
# .githooks/pre-commit
#!/bin/bash
# Prevents commits with obvious issues

# Check for test failures
pytest --co -q > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Syntax error in test file"
  exit 1
fi

# Check for debug code
if git diff --cached | grep -q "breakpoint()\|pdb.set_trace()"; then
  echo "❌ Debug code detected. Remove before committing"
  exit 1
fi

# Check for type errors
mypy --strict . 2>/dev/null
if [ $? -ne 0 ]; then
  echo "⚠️  Type errors detected. Consider fixing before committing"
fi
```

**2. Enforce in CI**:

```yaml
# .github/workflows/atomic-check.yml
name: Atomic Commit Check

on: [pull_request]

jobs:
  atomic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Test each commit independently
      - name: Verify each commit passes tests
        run: |
          git rebase origin/main --exec pytest packages/ || exit 1
```

**3. Document in guidelines**:

```markdown
# Commit Guidelines

## Atomic Commits

Every commit should:
- [x] Compile without errors
- [x] Pass all affected tests
- [x] Not break any dependent code
- [x] Be reversible with `git revert`
- [x] Have clear, descriptive message

## Examples

### ✓ Good atomic commit
```
refactor: unify authentication across services

- Extract common JWT logic to shared-auth package
- Update auth-service to use shared-auth
- Update api-gateway to use shared-auth
- All tests passing
- Only these 2 services affected
```

### ✗ Bad (non-atomic)
```
auth refactoring
# Vague message; unclear what changed
# No indication if tests pass
# Doesn't explain impact on other services
```
```

