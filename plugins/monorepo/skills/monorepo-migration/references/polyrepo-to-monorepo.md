# Polyrepo to Monorepo Migration: Legacy Systems

Comprehensive guide for migrating existing polyrepos to monorepo architecture while preserving Git history and team workflows.

## Git History Preservation Using git-filter-repo

The most critical aspect of legacy migration is preserving full Git history without losing attribution, commits, or branches.

### Prerequisites

```bash
# Install git-filter-repo
pip install git-filter-repo

# Verify installation
git filter-repo --version

# Ensure all repositories have all branches fetched
git fetch --all
```

### Single Repository Migration Pattern

**Scenario**: Migrating `github.com/org/service-api` → `monorepo/packages/api`

```bash
# 1. Create temporary clone to work with
mkdir migration-work && cd migration-work
git clone --mirror https://github.com/org/service-api service-api.git

# 2. Filter repository to new subdirectory
git clone service-api.git service-api-filtered
cd service-api-filtered

# CRITICAL: Replace all paths in the repository
git filter-repo --to-subdirectory-filter packages/api

# 3. Verify the migration (inspect commit history)
git log --oneline | head -20
git ls-tree -r HEAD | head -20
# Should see all files under packages/api/

cd ..

# 4. Back in monorepo directory
cd /path/to/monorepo

# 5. Add migrated repository as remote and merge
git remote add -f service-api /path/to/migration-work/service-api-filtered

# 6. Merge with unrelated history flag
# First, ensure clean working directory
git status  # Should be clean

# Create merge commit
git merge service-api/main \
  --allow-unrelated-histories \
  -m "Migrate service-api to monorepo packages/api"

# If conflicts occur:
# - Resolve conflicts in packages/api/
# - git add packages/api/
# - git commit
```

**Verification after merge**:

```bash
# Confirm all history is present
git log --all --oneline packages/api/ | wc -l
# Should match original repo commit count

# Check for any merge conflicts markers
grep -r "<<<<<<" packages/api/ || echo "No conflicts"

# Verify tags are preserved
git tag | grep api
# Should see all service-api tags prefixed appropriately
```

### Multi-Repository Sequential Migration

**Scenario**: Migrating 5 services one-by-one with tag namespace handling

```bash
#!/bin/bash
# migration-script.sh

SERVICES=("auth-service" "api-gateway" "data-processor" "notification-svc" "cache-layer")
MONOREPO_PATH="/path/to/monorepo"
WORK_DIR="/tmp/monorepo-migration-work"

mkdir -p $WORK_DIR
cd $WORK_DIR

for SERVICE in "${SERVICES[@]}"; do
  echo "Migrating $SERVICE..."

  # 1. Clone and filter
  git clone --mirror "https://github.com/org/$SERVICE" "$SERVICE.git"
  git clone "$SERVICE.git" "$SERVICE-filtered"
  cd "$SERVICE-filtered"

  # 2. Filter to subdirectory
  git filter-repo --to-subdirectory-filter "packages/$SERVICE"

  # 3. Rename tags to avoid conflicts
  for tag in $(git tag); do
    git tag "$SERVICE/$tag" "$tag"
    git tag -d "$tag"
  done

  cd "$WORK_DIR"

  # 4. Merge into monorepo
  cd "$MONOREPO_PATH"
  git remote add -f "$SERVICE" "$WORK_DIR/$SERVICE-filtered"

  # Safety checkpoint
  git status
  read -p "Review merge point, press Enter to continue..."

  git merge "$SERVICE/main" \
    --allow-unrelated-histories \
    -m "Migrate $SERVICE to monorepo"

  if [ $? -ne 0 ]; then
    echo "Merge failed for $SERVICE. Resolve conflicts and run: git merge --continue"
    exit 1
  fi

  git remote remove "$SERVICE"

  echo "$SERVICE migration complete"
done

echo "All services migrated successfully"
```

**Run with safety checks**:

```bash
chmod +x migration-script.sh
./migration-script.sh
```

### Handling Edge Cases

**Large binary files or LFS-tracked content**:

```bash
# If original repo used git-lfs
cd service-api-filtered

# Migrate LFS pointers to monorepo
git lfs migrate import --include="*.pdf,*.bin,*.jpg"

# Or convert to git-lfs in monorepo
git filter-repo --to-subdirectory-filter packages/api
git lfs install
git lfs track "*.pdf" "*.bin"
git add .gitattributes
git commit -m "Convert assets to LFS"
```

**Preserving branch history**:

```bash
# In filtered repository, BEFORE final migration
# Rename branches to preserve develop, staging, etc.
git branch -m develop packages-api/develop
git branch -m staging packages-api/staging

# On monorepo side, after merge:
git checkout packages-api/develop
git checkout -b develop  # Create local branch
git push origin develop
```

**Handling multi-default-branch repositories**:

```bash
# If service uses 'master' and monorepo uses 'main'
git clone service-api-filtered

# Rename branch before merge
git branch -m master main
git filter-repo --to-subdirectory-filter packages/api
```

---

## Step-by-Step Migration Process

### Phase 1: Planning (1-2 weeks)

**1. Dependency Inventory**

```bash
# For each service repo:
find . -name "requirements.txt" -o -name "pyproject.toml" \
  -o -name "package.json" | xargs cat > /tmp/service-deps.txt

# Identify shared dependencies
cat /tmp/service-*/deps.txt | sort | uniq -c | sort -rn
# High-count items should become workspace dependencies
```

**2. Conflict Identification**

```python
# identify_conflicts.py
import json
from collections import defaultdict

dependencies = defaultdict(list)

# Parse requirements from each service
services = ["auth", "api", "processor"]
for svc in services:
    with open(f"{svc}/requirements.txt") as f:
        for line in f:
            pkg, version = parse_requirement(line)
            dependencies[pkg].append((svc, version))

# Find conflicts
conflicts = {pkg: vers for pkg, vers in dependencies.items() if len(set(v[1] for v in vers)) > 1}

for pkg, versions in conflicts.items():
    print(f"{pkg}: {versions}")
    # Decision: use most recent, most common, or negotiate
```

**3. Restructuring Plan**

```
Current Polyrepo:
├── auth-service/
│   ├── src/
│   └── requirements.txt
├── api-gateway/
│   └── ...
└── data-processor/
    └── ...

Target Monorepo Structure:
├── pyproject.toml (root workspace)
├── packages/
│   ├── auth/
│   │   ├── src/
│   │   ├── pyproject.toml (package-level)
│   │   └── tests/
│   ├── api/
│   ├── processor/
│   └── shared/  # Extract common code
├── apps/
│   ├── api-gateway/
│   └── cli-tool/
├── docs/
└── infrastructure/
```

### Phase 2: Preparation (1 week)

**1. Create Root Workspace Configuration**

```toml
# pyproject.toml
[project]
name = "org-monorepo"
version = "0.1.0"
description = "Unified platform monorepo"
requires-python = ">=3.11"

[tool.uv.workspace]
members = [
    "packages/*",
    "apps/*",
    "infrastructure/scripts",
]

[tool.uv.sources]
# Shared libraries available to all packages
shared = { workspace = true }
common-auth = { workspace = true }

[build-system]
requires = ["uv>=0.4.0"]
build-backend = "hatchling.build"
```

**2. Extract Shared Code**

```bash
# Identify common modules used across services
cd current-polyrepo

# Example: common authentication logic
mkdir -p ../monorepo/packages/common-auth/src/common_auth
find auth-service/src -name "auth.py" -o -name "jwt*.py" \
  | xargs cp --parents -t ../monorepo/packages/common-auth/src/common_auth

# Create package definition
cat > ../monorepo/packages/common-auth/pyproject.toml << 'EOF'
[project]
name = "common-auth"
version = "0.1.0"
dependencies = ["pyjwt>=2.8.0", "cryptography>=41.0.0"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
EOF
```

**3. Dependency Consolidation**

```python
# consolidate-deps.py
from packaging.requirements import Requirement
from packaging.version import Version
import json

def load_all_requirements():
    """Load requirements from all service repos"""
    deps = {}
    services = ["auth", "api", "processor", "cache"]

    for svc in services:
        with open(f"{svc}/requirements.txt") as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    req = Requirement(line.strip())
                    name = req.name.lower()
                    if name not in deps:
                        deps[name] = (line.strip(), svc)

    return deps

def resolve_conflicts(deps):
    """Choose version for conflicting packages"""
    conflicts = {}

    # Group by package
    by_pkg = {}
    for name, (spec, svc) in deps.items():
        if name not in by_pkg:
            by_pkg[name] = []
        by_pkg[name].append((spec, svc))

    # Find conflicts
    for name, specs in by_pkg.items():
        if len(set(s[0] for s in specs)) > 1:
            conflicts[name] = specs

    return conflicts

# Generate consolidated requirements
all_deps = load_all_requirements()
conflicts = resolve_conflicts(all_deps)

print("Dependency Consolidation Report")
print(f"Total unique dependencies: {len(all_deps)}")
print(f"\nConflicts requiring resolution: {len(conflicts)}")
for pkg, specs in conflicts.items():
    print(f"\n  {pkg}:")
    for spec, svc in specs:
        print(f"    {svc}: {spec}")
```

### Phase 3: Execution (2-4 weeks)

**1. Parallel Migration with Safety Branches**

```bash
# Per-service feature branch
git checkout -b migration/service-api

# Execute git-filter-repo migration (see above)
git merge service-api/main --allow-unrelated-histories

# Test integration
uv sync --all-packages
pytest packages/api/tests/ -v
mypy packages/api/

# Code review before main merge
git push origin migration/service-api
# → Create PR for team review
```

**2. Update Internal Dependencies as They Migrate**

**Before migration** (polyrepo state):

```python
# apps/api-gateway/src/gateway.py
import sys
sys.path.insert(0, "../../services/auth-service/src")
from auth import authenticate
```

**After migration** (monorepo state):

```python
# apps/api-gateway/src/gateway.py
from common_auth import authenticate  # Uses workspace=true
```

**Update script**:

```bash
#!/bin/bash
# Find and update imports
find packages apps -name "*.py" -type f -exec sed -i \
  's|from auth import|from common_auth import|g' {} \;

find packages apps -name "*.py" -type f -exec sed -i \
  's|sys.path.insert.*services.*|# Removed sys.path hack|g' {} \;
```

**3. Consolidate Test Configuration**

```bash
# Create root pytest.ini
cat > pytest.ini << 'EOF'
[pytest]
pythonpath = .
testpaths = packages apps
python_files = test_*.py *_test.py
addopts = --cov=packages --cov=apps --cov-report=html
markers =
    integration: Integration tests requiring external services
    slow: Slow tests (deselect with '-m "not slow"')
EOF

# Create root pyproject.toml section
cat >> pyproject.toml << 'EOF'

[tool.pytest.ini_options]
pythonpath = "."
testpaths = ["packages", "apps"]

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

[[tool.mypy.overrides]]
module = "packages.*"
disallow_untyped_defs = false  # Gradually enforce
EOF

# Run consolidated tests
pytest -v --tb=short
```

### Phase 4: CI/CD Migration (1-2 weeks)

**1. Unified Workflow Setup**

```yaml
# .github/workflows/monorepo-test.yml
name: Monorepo Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Preserve history for affected detection

      - uses: astral-sh/setup-uv@v2
        with:
          version: "0.4.0"

      - name: Sync all packages
        run: uv sync --all-packages --frozen

      - name: Lint
        run: uv run black --check packages apps

      - name: Type check
        run: uv run mypy packages apps

      - name: Test
        run: pytest -v packages apps
```

**2. Decommission Old CI/CD**

```bash
# Archive old CI workflows
for repo in auth-service api-gateway processor; do
  mv "$repo/.github/workflows" "$repo/.github/workflows.archive"
done

# Notify teams
echo "CI/CD has migrated to central monorepo. Old workflows archived."
```

---

## Dependency Consolidation

### Unified Dependency Management

**Create dependency audit trail**:

```bash
# Capture version decisions
cat > DEPENDENCY_DECISIONS.md << 'EOF'
# Dependency Consolidation Decisions

## Conflicts Resolved

| Package | Previous Versions | Unified Version | Rationale |
|---------|------------------|-----------------|-----------|
| pydantic | auth: 2.4, api: 2.5 | 2.5 | API required 2.5 features |
| sqlalchemy | processor: 1.4, db: 2.0 | 2.0 | Leverage ORM improvements |
| fastapi | api: 0.104, gateway: 0.103 | 0.104 | Latest stable |

## Future Strategy

- Use poetry/uv version constraints: `package = ">=2.0,<3.0"`
- Annual dependency audit (Q1)
- Security updates: within 48 hours for critical CVEs
EOF
```

### Preventing Divergence

```toml
# pyproject.toml root
[tool.uv.workspace]
members = ["packages/*", "apps/*"]
# Single lock file enforces consistency
```

---

## Team Coordination Strategies

### Communication Plan

**Week 1: Announcement**
- Architecture decision document shared
- Rationale explained: increased velocity, reduced errors
- Timeline and roles clarified

**Week 2: Training**
- Git history preservation explained
- New workspace commands demonstrated (`uv sync`, `uv run`)
- Q&A session with build team

**Week 3-4: Cutover**
- Feature branch reviews on migration PRs
- Parallel test run (old + new) to validate
- Gradual CI migration (opt-in, then mandatory)

### Rollback Procedures

**Keep old repositories accessible**:

```bash
# Archive polyrepo services as read-only
for repo in service-*/; do
  cd "$repo"
  git remote set-url origin "$(git remote get-url origin)" --push-url "no-push"
  cd ..
done

# Document: "Original repositories archived in read-only mode at [date]"
# Restore if needed: git remote set-url origin [original-url]
```

**Partial rollback (single service)**:

```bash
# If a migrated service has critical issues post-migration
git revert <merge-commit-hash>

# Or extract back to polyrepo:
git subtree split -P packages/service -b extract/service
git push ../service-api-backup extract/service:main
```

### Team Capability Building

```bash
# Workshop agenda (2 hours)

## Part 1: Why (20 min)
- Show CI time reduction (45m → 15m example)
- Demonstrate dependency conflict resolution

## Part 2: How (40 min)
- uv workspace tour
- Hands-on: uv sync, uv run, uv lock
- Dependency resolution walkthrough

## Part 3: Common Issues (30 min)
- Git history confusion (HEAD is now monorepo HEAD)
- Circular dependency errors
- Performance tuning

## Part 4: Q&A (30 min)
```

---

## Validation Checklist

### Before Merging to Main

- [ ] All git history present (commit count matches original)
- [ ] No merge conflicts in source files
- [ ] All tests pass: `pytest packages/ apps/`
- [ ] Type checking passes: `mypy packages/ apps/`
- [ ] Linting passes: `black --check .`
- [ ] All internal imports updated (no relative path hacks)
- [ ] Tag references preserved and namespace-aware
- [ ] Branch references updated in CI/CD
- [ ] Documentation updated with new structure
- [ ] Rollback procedure tested on backup

### Post-Merge Validation

- [ ] `uv sync --all-packages` completes in < 30 seconds
- [ ] `uv lock --upgrade` produces consistent lock file
- [ ] CI/CD pipeline runs successfully on monorepo
- [ ] Team can run individual package tests: `uv run -p packages/api pytest`
- [ ] Cross-package dependency resolution validated
- [ ] No circular dependency warnings from build system

