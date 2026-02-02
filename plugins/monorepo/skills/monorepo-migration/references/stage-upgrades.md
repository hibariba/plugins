# Stage-to-Stage Migration: Progressive Tool Adoption

Detailed migration paths for upgrading between monorepo tooling stages as complexity and scale demands increase.

## Architecture: The Three Stages

**Stage 1: Lightweight Workspace (uv, pnpm)**
- Suitable for: <50 developers, <20 packages, CI times <15 minutes
- No affected-only testing; all packages built/tested on every change
- Single lockfile ensures consistency
- Minimal configuration overhead

**Stage 2: Task Orchestration (Turborepo, Nx)**
- Suitable for: 50-150 developers, 20-100 packages, CI times 15-45 minutes
- Affected-only testing reduces CI time by 3-8x
- Remote caching optional but recommended
- Parallel task execution with dependency awareness

**Stage 3: Build System (Pants, Bazel)**
- Suitable for: 150+ developers, 100+ packages, polyglot codebases
- File-level dependency inference
- Remote caching + remote execution dramatically reduces CI time
- Multi-language support (Python + TypeScript + Go, etc.)

---

## Stage 1 → Stage 2: uv → uv + Turborepo/Nx

**Trigger conditions**:
- Full test suite exceeds 30 minutes
- Team size > 50 developers
- More than 2 independent service streams

**No need to migrate if**:
- CI times acceptable (< 15 min)
- Team size < 30
- Changes rarely span multiple packages

### Migration Path: uv → Turborepo

**Current state**:

```toml
# pyproject.toml
[tool.uv.workspace]
members = ["packages/*", "apps/*"]
```

**Target state**:

```toml
# pyproject.toml (uv unchanged)
[tool.uv.workspace]
members = ["packages/*", "apps/*"]
```

```json
// turbo.json (new)
{
  "tasks": {
    "test": {
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "cache": true
    },
    "build": {
      "outputs": ["dist/**"],
      "cache": true,
      "dependsOn": ["^build"]
    }
  },
  "globalDependencies": ["package.json", "turbo.json"]
}
```

**Step 1: Install Turborepo**

```bash
npm install -g turbo@latest
# or
pnpm install -D turbo@latest
```

**Step 2: Add turbo.json to root**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "test": {
      "outputs": ["coverage/**"],
      "cache": true,
      "inputs": ["src/**/*.py", "tests/**/*.py", "pyproject.toml"]
    },
    "lint": {
      "cache": true,
      "outputs": []
    },
    "typecheck": {
      "cache": true,
      "outputs": []
    },
    "build": {
      "outputs": ["dist/**", "build/**"],
      "cache": true,
      "dependsOn": ["^build"]
    }
  },
  "globalDependencies": [
    "pyproject.toml",
    "turbo.json"
  ]
}
```

**Step 3: Add turbo tasks to each package**

```toml
# packages/auth/pyproject.toml
[project]
name = "auth"
version = "0.1.0"

[tool.turbo]
# Reference tasks defined in root turbo.json
# Tasks inherit from root configuration
```

**Step 4: Update CI/CD to use Turborepo**

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: astral-sh/setup-uv@v2

      - run: uv sync --all-packages --frozen

      - uses: napi-rs/setup-node@v1  # For Turborepo CLI
        with:
          version: 20

      - run: npx turbo run test \
          --filter='...[origin/main]' \
          --no-cache  # Or with cache if configured

      # Alternative: without Turborepo for pure Python
      - run: pytest packages/ apps/ -v
```

**Step 5: Validation**

```bash
# Verify Turborepo understands task graph
turbo run test --dry-run

# Test a single package
turbo run test --filter=packages/auth

# Test affected packages only
turbo run test --filter='...[origin/main]'

# Performance comparison
time turbo run test # Should be faster than pytest packages/
```

**Pros**:
- Minimal migration effort (1-2 days)
- Kept uv for dependency management
- Turborepo adds affected-only testing for Python via npm wrapper
- Can incrementally enable caching

**Cons**:
- Requires npm/node in Python environment
- Turborepo primary use case is JavaScript; less optimal for pure Python
- Does not provide file-level dependency inference

### Migration Path: uv → Nx

**Current state**: Same uv workspace as above

**Target state**:

```bash
# Initialize Nx
npx create-nx-workspace monorepo --preset=empty --packageManager=pnpm
```

**Step 1: Install Nx**

```bash
npm install -D nx@latest
npx nx init
```

**Step 2: Create workspace.json or nx.json**

```json
// nx.json
{
  "version": 2,
  "extends": "nx/presets/npm.json",
  "nxCloudId": "...",  // Optional: for Nx Cloud
  "plugins": [
    {
      "plugin": "@nx/python/plugin",
      "options": {
        "targetDir": "."
      }
    }
  ],
  "targetDefaults": {
    "test": {
      "dependsOn": ["build"],
      "cache": true,
      "inputs": ["{projectRoot}/**/*.py"],
      "outputs": ["{projectRoot}/coverage"]
    },
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

**Step 3: Create project.json for each package**

```json
// packages/auth/project.json
{
  "name": "auth",
  "projectType": "library",
  "targets": {
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pytest packages/auth/tests -v"
      }
    },
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "uv build -C packages/auth"
      }
    }
  }
}
```

**Step 4: Validate dependency graph**

```bash
npx nx graph

# Shows:
# - All packages (nodes)
# - Dependencies between packages (edges)
# - Interactive visualization in browser
```

**Pros**:
- Superior IDE integration and autocomplete
- Built-in visualization and code generation
- Nx Cloud provides remote caching SaaS option
- Excellent documentation and community

**Cons**:
- More heavyweight than Turborepo for Python-only projects
- Still requires JavaScript toolchain
- Learning curve steeper than Turborepo

---

## Stage 2 → Stage 3: Nx/Turborepo → Pants

**Trigger conditions**:
- CI times still > 30 minutes even with affected-only testing
- Multi-language codebase (Python + TypeScript + Go)
- 100+ packages with complex dependency graphs
- Team has dedicated build engineers
- Need for file-level dependency tracking

**Specific paths**:

### Path A: uv → Pants (Pure Python)

**Current state**:
```
monorepo/
├── pyproject.toml (uv workspace)
├── uv.lock
└── packages/*/pyproject.toml
```

**Target state**:
```
monorepo/
├── pants.toml  (Pants config)
├── 3rdparty/python/requirements.txt
├── 3rdparty/python/BUILD
└── packages/
    └── {package}/BUILD  (auto-generated by pants tailor)
```

**Step 1: Install Pants**

```bash
# Via scie (recommended, single-file binary)
bash <(curl --proto '=https' --tlsv1.2 -fsSL https://static.pantsbuild.org/setup/install-pants.sh)

# Via pip
pip install pantsbuild.pants
```

**Step 2: Create pants.toml**

```toml
[GLOBAL]
pants_version = "2.30.0"
backend_packages = [
    "pants.backend.python",
    "pants.backend.python.lint.black",
    "pants.backend.python.lint.isort",
    "pants.backend.python.linter.flake8",
    "pants.backend.python.typecheck.mypy",
    "pants.backend.python.testing.pytest",
    "pants.backend.docker",
    "pants.backend.shell",
]

[python]
interpreter_constraints = [">=3.11,<3.13"]
enable_resolves = true
default_resolve = "python-default"

[python.resolves]
python-default = "3rdparty/python/default.lock"

[source]
# Sync with pyproject.toml workspace members
root_patterns = ["/packages/*", "/apps/*", "/infrastructure/*"]

[pytest]
args = ["-v", "--tb=short"]
pytest_plugins = ["pytest_cov"]
```

**Step 3: Migrate dependencies**

```bash
# Convert uv.lock → requirements.txt for Pants
python << 'EOF'
import tomllib
import json

with open("uv.lock", "rb") as f:
    lock_data = tomllib.load(f)

# Generate requirements.txt from lock
reqs = []
for package in lock_data.get("packages", []):
    name = package["name"]
    version = package["version"]
    reqs.append(f"{name}=={version}")

with open("3rdparty/python/requirements.txt", "w") as f:
    f.write("\n".join(sorted(set(reqs))))
EOF

mkdir -p 3rdparty/python
# Place converted requirements.txt there
```

**Step 4: Auto-generate BUILD files**

```bash
pants tailor ::

# Output will show:
# Created packages/auth/BUILD
# Created packages/api/BUILD
# etc.
```

**Step 5: Validate BUILD files**

```bash
# Show dependency graph
pants peek packages/::

# Example output:
# packages/api:lib:
#   dependencies:
#     - packages/shared:lib
#     - 3rdparty/python#requests

# Lint BUILD file syntax
pants lint packages/::

# Validate all imports match declared dependencies
pants check packages/::
```

**Step 6: Test execution**

```bash
# Run all tests
pants test packages/::

# Run affected tests only (huge time savings)
pants --changed-since=origin/main --changed-dependents=transitive test

# Run specific package tests
pants test packages/auth::
```

**Step 7: Update CI/CD**

```yaml
# .github/workflows/pants-test.yml
name: Pants Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pantsbuild/actions/init-pants@v5

      - name: Run tests
        run: |
          pants --changed-since=origin/main \
                 --changed-dependents=transitive \
                 test

      - name: Type check
        run: pants typecheck packages/::
```

**Step 8: Enable remote caching (optional but recommended)**

```toml
# pants.toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "grpcs://cache.depot.dev"
remote_store_headers = { "Authorization" = "Bearer ${DEPOT_TOKEN}" }
```

**Validation**:

```bash
# Compare performance
time pants test packages/::  # New
# vs
time pytest packages/ -v  # Old

# Expected: 3-5x faster with remote cache hit
```

**Pros**:
- Dramatic CI time reduction (45 min → 10 min typical)
- File-level dependency inference eliminates manual BUILD maintenance
- Superior performance with remote caching
- Python-native design

**Cons**:
- Learning curve for BUILD files (though pants tailor generates them)
- Requires commitment to build system discipline
- Build engineer expertise needed

### Path B: pnpm → Nx (TypeScript-focused)

Already at Nx level; this is lateral move for performance only. Skip to Pants path if truly struggling.

### Path C: Turborepo → Nx (JavaScript optimization)

```bash
# Turborepo doesn't need migration to Nx necessarily
# But if doing so:

# 1. Install Nx
npm install -D nx@latest

# 2. Use Nx's migration tool
npx nx g @nx/workspace:preset

# 3. Copy turbo.json structure to nx.json
# Most tasks will transfer directly
```

### Path D: pnpm Workspaces → Pants (Multi-language)

For JavaScript + Python polyglot monorepos:

```bash
# Pants supports both languages
[GLOBAL]
backend_packages = [
    "pants.backend.python",
    "pants.backend.experimental.javascript",
]

[javascript]
# Configures Node.js + npm/pnpm integration
```

---

## Stage 3: Pants → Bazel (Hyperscale)

**Trigger conditions**:
- Organization > 500 engineers
- Codebases > 100 million lines
- Need for strict hermeticity and reproducibility
- Very large build artifacts requiring distributed execution

**Reality**: 99% of organizations never reach this scale. Pants is sufficient.

**If forced to migrate**:

```bash
# 1. Preserve Pants artifacts (lock files, caches)
cp pants.lock bazel.build.backup

# 2. Use rules_python to interpret existing setup
# MODULE.bazel
bazel_dep(name = "rules_python", version = "0.30.0")

# 3. Generate BUILD files using buildifier
buildifier -r packages/

# 4. Migrate gradually: test one package at a time with Bazel
bazel test //packages/auth:tests
```

**Minimal Bazel adoption for Pants users**:

```python
# Instead of full Bazel, use Bazel for hermetic testing only
# packages/auth/BUILD (Bazel BUILD file)

load("@rules_python//python:defs.bzl", "py_test", "py_library")

py_library(
    name = "auth_lib",
    srcs = ["src/auth.py"],
    deps = ["//packages/shared:shared_lib"],
)

py_test(
    name = "tests",
    srcs = glob(["tests/**/*.py"]),
    deps = [":auth_lib"],
)
```

Not recommended unless absolutely necessary.

---

## Rollback Procedures

### Stage 1 Rollback: Disable Turborepo/Nx

```bash
# Remove turbo.json or nx.json
rm turbo.json  # or nx.json

# Continue using raw pytest/pnpm
pytest packages/ apps/ -v
pnpm test  # For JavaScript

# No data loss; just loses affected-only optimization
```

### Stage 2 Rollback: Pants → uv

```bash
# Keep pants.toml but disable in CI
# Revert CI to use pytest directly

# Save Pants lock file as backup
cp 3rdparty/python/default.lock pants-lock.backup

# Generate requirements.txt from lock
python << 'EOF'
import re

with open("pants-lock.backup") as f:
    for line in f:
        match = re.search(r'^# ([a-z-]+)==([0-9.]+)', line)
        if match:
            print(f"{match.group(1)}=={match.group(2)}")
EOF

# Restore uv.lock
git restore uv.lock

# Resume with: uv sync --frozen && pytest packages/
```

### Stage 2-3 Rollback: Remove file-level tracking

If Pants is causing more trouble than benefit:

```bash
# Remove pants.toml, BUILD files
rm pants.toml
find . -name BUILD -type f -delete

# Fall back to pytest + simple import statements
# Loss: affected-only testing, but gain: simplicity
```

---

## Incremental Adoption Strategies

### Adoption Strategy: Gradual Pants Rollout

**Phase 1: Linting only (low risk)**
```bash
# Week 1-2: Only use Pants for formatting
pants fmt packages/::
pants lint packages/::

# Existing test/build pipelines unchanged
```

**Phase 2: Testing (medium risk)**
```bash
# Week 3-4: Pants runs tests alongside pytest
pants test packages/auth::  # Run parallel, compare results

# Verify Pants catches same failures as pytest
# Requires BUILD files but no dependency graph optimization yet
```

**Phase 3: Full integration (high impact)**
```bash
# Week 5+: Replace pytest with Pants in CI/CD
# Enable affected-only testing: 60% CI time reduction
# Add remote caching: additional 30-40% reduction
```

### Adoption Strategy: Monorepo by Package

If organization has N teams:

**Month 1**: Migrate highest-pain package (longest CI time)
- Demonstrate time savings
- Build team expertise
- Identify integration issues

**Month 2-3**: Migrate packages with active development
- Teams see immediate velocity benefit
- Build momentum

**Month 4+**: Migrate remaining packages
- Low-touch maintenance packages can stay simple
- Gradual adoption reduces disruption

---

## Performance Benchmarks

### Expected CI Time Reductions

| Migration | Before | After | Savings | Timeline |
|-----------|--------|-------|---------|----------|
| Polyrepo → uv monorepo | 25m | 25m | 0% | 1-2 weeks |
| uv → Turborepo | 25m | 8m | 68% | 2-3 weeks |
| uv → Nx | 25m | 7m | 72% | 3-4 weeks |
| Turborepo → Pants (with cache) | 8m | 2m | 75% | 4-6 weeks |
| Nx → Pants (with cache) | 7m | 2m | 71% | 4-6 weeks |

### Real-world examples

**Example 1: Mid-size Python team (20 devs, 30 packages)**
- Stage 1 only: 20-min full test, no parallelization
- Add Turborepo: 6-min full test (3.3x speedup)
- ROI: 14 min/dev/day × 20 devs × 250 days = 70,000 min/year saved

**Example 2: Large polyglot team (100 devs, Python + TypeScript)**
- Separate test suites: 45 min combined
- Pants: 12 min (3.75x speedup) + 8 min (cache hit) = 20 min
- Add Bazel for TypeScript: 15 min total
- ROI: 30 min/dev/day × 100 devs × 250 days = 750,000 min/year saved = $375k/year at $30/hr

