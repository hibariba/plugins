# Advanced Resolution Strategies

Expert-level guide to uv's dependency resolution in monorepos. Master lockfile strategies, reproducible builds, and environment-specific resolution for complex monorepo setups.

## Table of Contents

- [Overview](#overview)
- [Universal vs Platform-Specific Resolution](#universal-vs-platform-specific-resolution)
- [Resolution Strategies](#resolution-strategies)
- [Fork Strategies](#fork-strategies)
- [Pre-release Handling](#pre-release-handling)
- [Reproducible Builds](#reproducible-builds)
- [Environment Limits](#environment-limits)
- [Dependency Tree Analysis](#dependency-tree-analysis)
- [Testing Against Lowest Bounds](#testing-against-lowest-bounds)
- [Workspace Resolution](#workspace-resolution)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

## Overview

Resolution converts abstract dependency requirements into concrete, reproducible package selections. In monorepos, this becomes critical:

- **Consistency**: All workspace members use same dependency versions
- **Reproducibility**: Exact versions lockfile survives across platforms and machines
- **Control**: Fine-grained strategies for different testing/deployment scenarios
- **Efficiency**: Shared resolution across multiple packages saves time and disk space

Choose resolution strategies based on your needs:
- **Development**: `highest` (latest features)
- **Testing**: `lowest` (compatibility bounds)
- **Production**: `exclude-newer` + universal lockfile (reproducibility)

## Universal vs Platform-Specific Resolution

### Universal Lockfile (Recommended for Monorepos)

Universal lockfile works identically across all platforms and Python versions. All workspace members share one `uv.lock`:

```bash
# Default behavior - creates universal lockfile
uv lock

# Explicitly set (not needed, but clear)
uv lock --universal
```

**What "universal" means:**
- Same package versions on Linux, macOS, Windows
- Same versions for Python 3.10, 3.11, 3.12
- Uses PEP 508 markers to specify platform-specific packages
- May include multiple wheels for same package (different platforms)

**Example lockfile structure:**
```
[[package]]
name = "psutil"
version = "5.9.0"
wheels = [
  "psutil-5.9.0-cp39-cp39-linux_x86_64.whl",
  "psutil-5.9.0-cp39-cp39-macosx_x86_64.whl",
  "psutil-5.9.0-cp39-cp39-win_amd64.whl"
]
```

**Advantages for monorepos:**
- Single lockfile covers all CI platforms
- Developers on different machines see identical versions
- Easier code review (no lockfile diffs between platforms)

### Platform-Specific Resolution (pip Interface Only)

For specific-platform compilation (rarely needed in monorepos):

```bash
# Compile for current platform only (like pip-tools)
uv pip compile requirements.in -o requirements.txt

# Cross-compile: on macOS, generate Linux lockfile
uv pip compile \
  --python-platform linux \
  --python-version 3.10 \
  requirements.in \
  -o requirements.txt
```

**When to use:** Building Docker images, platform-specific distributions, or legacy pip-tools workflows.

**In pyproject.toml, force universal resolution:**
```toml
[tool.uv]
# Project uses universal (default), but pip interface defaults platform-specific
# No flag needed - projects default to universal
```

## Resolution Strategies

Resolution strategies determine which compatible version of each package gets selected.

### Highest (Default)

Prefers latest compatible version. Best for active development:

```bash
uv lock  # Implicit --resolution highest
uv lock --resolution highest
```

**Use cases:**
- Local development (get latest features)
- Testing with current ecosystem
- New projects starting fresh

**Example output:**
```
numpy==2.2.0        # Latest compatible
scipy==1.15.0       # Latest compatible
pandas==2.2.0       # Latest compatible
```

### Lowest

Uses lowest compatible version satisfying constraints. Essential for testing library compatibility:

```bash
# Lock with lowest versions
uv lock --resolution lowest

# Run tests with lowest compatible versions
uv run --resolution lowest pytest

# Single command test with lowest
uv run --resolution lowest python -m pytest tests/
```

**Use cases:**
- Test library supports declared minimum versions
- Verify backward compatibility
- Find undeclared minimum version requirements

**Workflow for libraries:**

1. Declare realistic minimum versions in `pyproject.toml`:
```toml
[project]
dependencies = [
  "requests>=2.28.0",
  "pydantic>=2.0.0",
  "numpy>=1.20.0",  # Library genuinely works with these minimums
]
```

2. Test against lowest:
```bash
# In CI, test with lowest compatible versions
uv run --resolution lowest pytest

# If this fails, your declared minimum is wrong
# Either raise minimum requirement or fix code
```

**Example output with lowest:**
```
numpy==1.20.0       # Declared minimum, not latest
scipy==1.5.4        # Very old version
pandas==1.1.0       # Ancient version
```

### Lowest-Direct

Lowest for direct dependencies only; highest for transitive (indirect) dependencies:

```bash
uv lock --resolution lowest-direct
uv run --resolution lowest-direct pytest
```

**Use cases:**
- Test your code works with minimum declared versions
- But allow transitive dependencies to be recent (for security)
- Middle ground between `lowest` and `highest`

**Dependency tree example:**

```
Project
├── requests>=2.28.0          (lowest: 2.28.0)
│   └── urllib3>=2.0          (highest: 2.1.0)
├── pydantic>=2.0.0           (lowest: 2.0.0)
│   └── typing-extensions     (highest: 4.12.0)
```

With `--resolution lowest-direct`:
- `requests==2.28.0` and `pydantic==2.0.0` (your declared minimums)
- But `urllib3==2.1.0` and `typing-extensions==4.12.0` (latest transitive)

## Fork Strategies

Fork strategies control how versions are selected across different Python versions in a universal lockfile.

### Default: Requires-Python

Selects different versions based on Python version compatibility:

```bash
uv lock --fork-strategy requires-python  # Default
```

**Behavior:**
- `numpy` declares `python_requires = ">=1.20.0, <3.13"` differently per version
- `numpy==1.24` supports Python 3.8-3.10
- `numpy==2.0` requires Python 3.9+
- `numpy==2.2` requires Python 3.10+

**Resulting lockfile:**
```
[[package]]
name = "numpy"

[[package.version]]
version = "1.24.4"
requires = ["python_version < '3.9'"]

[[package.version]]
version = "2.0.2"
requires = ["python_version >= '3.9'"]

[[package.version]]
version = "2.2.0"
requires = ["python_version >= '3.10'"]
```

**Advantages:**
- Respects each Python version's best available package
- Each Python 3.x gets appropriate feature level
- No artifically restricting newer Python to old packages

### Fewest-Forks

Single version across all Python versions. Maximizes consistency:

```bash
uv lock --fork-strategy fewest
```

**Behavior:**
- Finds ONE version compatible with all declared Python versions
- Ignores which version is "best" for each Python
- All Python versions get same package version

**Resulting lockfile (same strategy):**
```
[[package]]
name = "numpy"
version = "1.24.4"  # Single version for all Python versions
```

**Use cases:**
- Monorepos where consistency matters more than latest features
- Teams wanting to test everything with same dependency set
- Simpler lockfile with less conditional logic

**Workspace example:**

```toml
# Root pyproject.toml declares multiple Python versions
[project]
requires-python = ">=3.9,<3.13"

[tool.uv]
fork-strategy = "fewest"
```

With `fewest-forks`: All Python 3.9-3.12 get `numpy==1.24.4`
With `requires-python`: Python 3.9-3.10 get 1.24.4, Python 3.11+ get 2.2.0

**When to choose:**

| Strategy | Best For |
|----------|----------|
| `requires-python` | Projects supporting multiple Python versions with different features |
| `fewest` | Monorepos needing identical testing across all supported Python versions |

## Pre-release Handling

Control whether pre-release versions (1.0.0rc1, 2.0.0a2) are considered.

### Default Behavior

Pre-releases only included when:
1. Direct dependency explicitly requires it: `flask>=2.0.0rc1`
2. All published versions are pre-releases (no stable version exists)

```bash
uv lock  # Pre-releases excluded unless explicitly requested
```

**Example:** `flask==2.1.0rc1` won't be selected even if specified, unless you explicitly request it.

### Allow Pre-releases Globally

Include pre-releases for all packages:

```bash
uv lock --prerelease allow
uv run --prerelease allow pytest
```

**In pyproject.toml:**
```toml
[tool.uv]
prerelease = "allow"
```

**Use cases:**
- Testing against upcoming releases
- Projects depending on alpha/beta versions
- Frameworks with pre-release features needed now

### Disallow Pre-releases (Explicit)

```bash
uv lock --prerelease disallow  # Strict (useful with --prerelease allow in some deps)
```

**In pyproject.toml:**
```toml
[tool.uv]
prerelease = "disallow"
```

### If-Necessary Strategy

Pre-releases only if no stable version satisfies constraints:

```bash
uv lock --prerelease if-necessary  # Default in most scenarios
```

**Behavior:**
- Package has no stable version matching constraints → use pre-release
- Package has stable version → use stable
- Good for dependencies where you're not cutting edge

**In pyproject.toml:**
```toml
[tool.uv]
prerelease = "if-necessary"  # This is the default
```

**Per-package pre-release control (advanced):**

```toml
# Direct dependency with pre-release version specifier
[project]
dependencies = [
  "django>=5.0a1",  # Explicitly request pre-release
  "requests>=2.28",  # Stable only
]
```

## Reproducible Builds

Generate identical lockfiles at specific points in time, crucial for production deployments.

### Exclude-Newer: Fixed Timestamp

Lock using only packages published before a specific date:

```bash
# Absolute ISO timestamp
uv lock --exclude-newer "2025-01-15T00:00:00Z"

# Local date (uses current time as cutoff)
uv lock --exclude-newer "2025-01-15"
```

**In pyproject.toml:**
```toml
[tool.uv]
exclude-newer = "2025-01-15T00:00:00Z"
```

**Use case: Time capsule release**

```bash
# Release v1.0.0 of monorepo with exact date snapshot
$ uv lock --exclude-newer "2025-01-10"
# All dependencies published before Jan 10, 2025
# Lockfile is committed to git with version tag
git tag v1.0.0
```

Months later, `uv sync` in that tagged commit always gets same versions.

### Exclude-Newer: Cooldown Period

Only packages older than N days. Provides security vetting delay:

```bash
# Only packages published more than 7 days ago
uv lock --exclude-newer "7 days"

# 30-day security review window
uv lock --exclude-newer "30 days"

# Also supports: "1 week", "2 weeks", "1 month"
uv lock --exclude-newer "2 weeks"
```

**In pyproject.toml:**
```toml
[tool.uv]
exclude-newer = "1 week"  # Only packages >7 days old
```

**Workflow: Weekly updates with security delay**

```bash
# Monday: lock with 1-week delay (already-tested packages)
uv lock --exclude-newer "7 days"
uv sync
python -m pytest

# Wednesday: review any new packages that entered 1-week window
# Friday: if tests still pass, merge to main
git commit -m "security: weekly update"
```

### Per-Package Exclude-Newer

Different cutoff for specific packages:

```toml
[tool.uv]
exclude-newer = "1 week"

# Critical security packages get shorter delay
exclude-newer-package = {
  setuptools = "3 days",
  urllib3 = "2 days",
  cryptography = "same",  # Must use security update immediately
}
```

**Use case:** Most deps need vetting, but security-critical packages need faster updates.

### Exclude-Newer in CI/CD

**Production deployment:**
```bash
#!/bin/bash
# Deploy uses timestamp from 1 week ago
CUTOFF=$(date -d "7 days ago" -I)
uv lock --exclude-newer "$CUTOFF"
uv sync
python -m pytest
# Deploy only if tests pass
```

**Version release process:**
```bash
# Tag release with specific timestamp for reproducibility
# In pyproject.toml at commit time:
exclude-newer = "2025-01-20T10:00:00Z"

git tag release/v2.1.0
# Anyone checking out this tag always gets same versions
```

## Environment Limits

Restrict resolution to specific platforms and Python versions.

### Limit Resolution Platforms

Only generate lockfile entries for specified platforms:

```toml
[tool.uv]
environments = [
  "sys_platform == 'darwin'",      # macOS only
  "sys_platform == 'linux'",       # Linux only
  # Windows not included
]
```

**Effect:**
- Lockfile excludes Windows-specific packages
- `uv sync` on Windows fails (by design)
- Smaller lockfile, faster resolution

**When useful:**
- macOS-only tool (e.g., Swift-interop library)
- Linux-only deployment (e.g., containerized service)

**Full environment markers:**
```toml
[tool.uv]
environments = [
  "sys_platform == 'linux' and platform_machine == 'x86_64'",
  "sys_platform == 'darwin' and platform_machine == 'arm64'",
]
# No Intel macOS, no other architectures
```

### Required Environments

Ensure wheels exist for specific platforms. Fails resolution if any package lacks a wheel:

```toml
[tool.uv]
required-environments = [
  "sys_platform == 'linux' and platform_machine == 'x86_64'",
  "sys_platform == 'darwin' and platform_machine == 'arm64'",
]
```

**Behavior:**
- Every package in lockfile must have prebuilt wheel for these platforms
- Resolution fails if source-only package required
- Prevents `pip install --no-binary` scenarios

**Use case:** Container builds requiring prebuilt wheels only.

```bash
# In Docker build
FROM python:3.11-slim
# uv sync will fail if any package requires compilation
# Forces all packages to be available as wheels
```

## Dependency Tree Analysis

Understand why packages are included and find conflicts.

### View Full Dependency Tree

```bash
# Tree of all dependencies
uv tree

# Tree starting from specific package
uv tree --package requests

# Tree in reverse (show what depends on this)
uv tree --invert --package urllib3

# Show exact versions
uv tree --depth 10  # Limit recursion depth
```

**Example output:**
```
project
├── requests [2.31.0]
│   ├── certifi [>=2017.4.17]
│   ├── charset-normalizer [>=2, <4]
│   │   ├── charset [...]
│   │   └── unicodedata2 [...]
│   └── urllib3 [>=1.21.1, <3]
└── pytest [7.4.0]
    ├── pluggy [<2, >=0.12]
    ├── packaging [...]
    └── ...
```

### Find Why Package Included

```bash
# Reverse dependency tree
uv tree --invert --package urllib3

# Output: shows all packages depending on urllib3
urllib3
├── requests
│   └── project
└── pip
    └── ...
```

**Use case:** Package causing conflict? See who depends on it:

```bash
uv tree --invert --package numpy
# If multiple packages depend on different numpy versions,
# resolve strategy or overrides needed
```

### Identify Duplicate Dependencies

Large monorepos may have multiple versions of same package:

```bash
uv tree | grep "requests"  # Find all requests versions
# If you see multiple versions, dependency conflict exists
```

## Testing Against Lowest Bounds

Essential for libraries. Verify minimum declared versions are actually minimum.

### Single Test Command

```bash
# One-off test with lowest versions
uv run --resolution lowest pytest tests/
```

### Dedicated CI Job

In `.github/workflows/test.yml`:

```yaml
jobs:
  test-lowest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3

      - name: Test against lowest compatible versions
        run: uv run --resolution lowest pytest

  test-highest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3

      - name: Test against latest versions
        run: uv run --resolution highest pytest
```

### Workspace-Wide Lowest Testing

Test all members against lowest in one command:

```bash
# Lock with lowest, test all members
uv lock --resolution lowest

# Run all tests with lowest versions
uv run --package core pytest
uv run --package api pytest
uv run --package cli pytest

# Or in a script
uv lock --resolution lowest
for package in packages/*/; do
  uv run --package "$(basename "$package")" pytest
done
```

### Common Issues When Testing Lowest

**Issue: Test fails with lowest versions**

1. **Option A: Raise your minimum version**
   ```toml
   # Previously: numpy>=1.20.0 (but code requires 1.22+)
   # Now:
   dependencies = ["numpy>=1.22.0"]
   ```

2. **Option B: Fix code to work with older versions**
   ```python
   import numpy as np
   # Old numpy API compatibility
   try:
       arr = np.array([1, 2, 3], dtype=np.int32)
   except TypeError:
       arr = np.array([1, 2, 3], dtype=np.int32)
   ```

3. **Option C: Constrain for development only**
   ```toml
   [project]
   dependencies = ["numpy>=1.20.0"]  # Honest minimum

   [project.optional-dependencies]
   dev = ["numpy>=1.22.0"]  # Development convenience
   ```

### Bounds Matrix Testing

Test multiple strategy combinations:

```yaml
jobs:
  test-matrix:
    strategy:
      matrix:
        resolution: [lowest, lowest-direct, highest]
        python: ["3.10", "3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python }}

      - run: uv lock --resolution ${{ matrix.resolution }}
      - run: uv run pytest
```

## Workspace Resolution

Multi-package resolution with shared lockfile.

### Single Lockfile, Multiple Packages

```bash
# Lock entire workspace (all members)
uv lock
# Produces single uv.lock covering all packages
```

**Workspace structure:**
```
myworkspace/
├── pyproject.toml           # Root
├── uv.lock                  # Shared lockfile
├── packages/
│   ├── core/
│   │   ├── pyproject.toml
│   │   └── src/core/
│   └── api/
│       ├── pyproject.toml
│       └── src/api/
```

### Shared Dependency Resolution

```toml
# packages/core/pyproject.toml
[project]
name = "core"
dependencies = ["pydantic>=2.0"]

# packages/api/pyproject.toml
[project]
name = "api"
dependencies = ["core", "fastapi>=0.100", "pydantic>=2.0"]
```

Both declare `pydantic>=2.0`. Single lockfile ensures **same pydantic version**:

```bash
uv lock
# Result: pydantic==2.8.1 (single version for all members)
```

### Member-Specific Resolution Options

```bash
# Lock entire workspace
uv lock

# Test specific member with lowest
uv lock --resolution lowest --package core

# Run tests for specific member
uv run --package core pytest

# Different members, different commands
uv run --package core pytest
uv run --package api python -m pytest --integration
```

### Conflicting Extras in Workspaces

Declare incompatible optional dependencies:

```toml
# Root pyproject.toml
[tool.uv]
conflicts = [
  [
    { package = "torch_cpu", extra = "cuda11" },
    { package = "torch_gpu", extra = "cuda12" },
  ],
]
```

Now `uv lock` resolves both, but:

```bash
# This fails (conflicting extras)
uv sync --package torch_cpu --extra cuda11 --package torch_gpu --extra cuda12

# This works (no conflicts)
uv sync --package torch_cpu --extra cuda11
```

## Troubleshooting

### Force Re-resolution

Ignore cached resolution, re-resolve from scratch:

```bash
uv lock --refresh
uv sync --refresh
```

**When needed:**
- Package index updated with new versions
- Package metadata corrected
- Previous resolution contained bugs

### Understand Resolution Failures

**Error: Unresolvable dependencies**

```bash
$ uv lock
error: Unresolvable dependency requirements:
  - foo: >=1.0,<2.0
  - bar: >=2.0,<2.5
  - foo-bar: foo>=2.0

Cannot satisfy all constraints simultaneously.
```

**Debug steps:**

```bash
# 1. View dependency tree
uv tree --package foo
uv tree --package bar

# 2. Try less restrictive strategy
uv lock --resolution highest  # See if any version works

# 3. Check for transitive conflicts
uv tree --invert --package foo
# See all packages depending on foo
```

**Solutions:**

1. Raise/lower version constraints
2. Add constraints to limit conflicting versions
3. Use overrides to replace incorrect metadata

### Inspect Lockfile Entry

View exactly what got resolved:

```bash
# Extract specific package from lockfile (requires jq)
uv export --format json | jq '.[] | select(.name=="numpy")'

# Or search lockfile directly
grep -A 10 "name = \"numpy\"" uv.lock
```

## CI/CD Integration

### Pre-commit Hook: Lock Freshness

Ensure `uv.lock` is up-to-date:

```bash
#!/bin/bash
# .githooks/pre-commit
uv lock --check
if [ $? -ne 0 ]; then
  echo "uv.lock is stale. Run 'uv lock' and commit changes."
  exit 1
fi
```

Install:
```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

### GitHub Actions: Test Multiple Scenarios

```yaml
name: Test
on: [push, pull_request]

jobs:
  test-highest:
    name: Test with highest versions
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv run --resolution highest pytest

  test-lowest:
    name: Test with lowest versions
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv run --resolution lowest pytest

  test-reproducible:
    name: Test reproducible build (1-week-old deps)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv lock --exclude-newer "7 days"
      - run: uv run pytest

  release:
    name: Release build (specific date)
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv lock --exclude-newer "2025-01-15T00:00:00Z"
      - run: uv build
```

### Workspace CI/CD

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3

      - name: Lock workspace
        run: uv lock

      - name: Test all workspace members
        run: |
          uv run --package core pytest
          uv run --package api pytest
          uv run --package cli pytest

      - name: Build all members
        run: |
          uv build --package core
          uv build --package api
          uv build --package cli
```

### Reproducible Release Workflow

```bash
#!/bin/bash
# scripts/release.sh
set -e

VERSION="$1"
if [ -z "$VERSION" ]; then
  echo "Usage: ./release.sh <version>"
  exit 1
fi

# Lock with current date snapshot
uv lock --exclude-newer "$(date -I)"

# Test
uv run pytest

# Build all packages
uv build

# Tag for reproducibility
git tag -a "v$VERSION" -m "Release $VERSION"
git push origin "v$VERSION"

# Anyone checking out this tag gets same dependencies
```

Checkout and use later:
```bash
git checkout v1.0.0
uv sync  # Exact same versions as when released
uv run pytest  # Reproduces original test results
```

## Resources

- [uv resolution documentation](https://docs.astral.sh/uv/concepts/resolution/)
- [uv workspace documentation](https://docs.astral.sh/uv/concepts/workspaces/)
- [PEP 508 environment markers](https://peps.python.org/pep-0508/)
- [Semantic versioning guide](https://semver.org/)
# Dependency Constraints & Overrides

Advanced dependency management patterns for monorepos with complex, conflicting, or non-standard dependencies.

## Table of Contents

- [Overview](#overview)
- [Constraints](#constraints)
- [Overrides](#overrides)
- [Build Constraints](#build-constraints)
- [Conflict Declarations](#conflict-declarations)
- [Dependency Metadata Override](#dependency-metadata-override)
- [Decision Framework](#decision-framework)
- [Workspace-Wide vs Package-Specific](#workspace-wide-vs-package-specific)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

---

## Overview

### Use Cases

Constraints and overrides solve advanced dependency problems:

1. **Constraints** — narrow acceptable versions without adding dependencies
2. **Overrides** — replace declared requirements (escape hatch for broken metadata)
3. **Build constraints** — control build-time dependencies separately
4. **Conflict declarations** — incompatible extras/groups (cuda11 vs cuda12)
5. **Metadata override** — provide metadata for packages without static declarations

### When You Need These

- Monorepos with transitive dependency conflicts
- Packages with incorrect or missing metadata
- Extras/groups with incompatible requirements
- Build-time vs runtime dependency separation
- Git dependencies or complex build environments

---

## Constraints

Constraints **narrow acceptable versions** without adding dependencies. They are purely restrictive.

### Constraints File (pip interface)

```bash
# constraints.txt
requests>=2.28,<3.0
urllib3<2.0
setuptools>=60,<70
```

Apply constraints during resolution:

```bash
# Compile with constraints
uv pip compile --constraint constraints.txt requirements.in

# Install with constraints
uv pip install --constraint constraints.txt -r requirements.txt
```

### In pyproject.toml

```toml
[tool.uv]
constraint-dependencies = [
  "requests>=2.28,<3.0",
  "urllib3<2.0",
  "setuptools>=60,<70",
]
```

### Example: Narrow Transitive Versions

A dependency chain pulls in an incompatible transitive version:

```
myapp → requests → urllib3>=2.0
```

But your code requires `urllib3<2.0`:

```toml
[tool.uv]
constraint-dependencies = ["urllib3<2.0"]

[project]
dependencies = ["requests"]  # Still works, constraint narrows urllib3
```

Resolution respects both:
- `requests` is satisfied
- `urllib3<2.0` constraint is honored

### Key Characteristics

✅ **Constraints only restrict** — can't expand allowed versions
✅ **Combined with package requirements** — additive filtering
✅ **Work on transitive deps** — entire dependency tree
✅ **No extras or markers** — simple version specs only
✅ **Build-time independent** — use build constraints for build deps

❌ **Can't add dependencies** — only narrow existing ones
❌ **Require existing requirement** — "urllib3<2.0" only works if urllib3 is already required

---

## Overrides

Overrides **replace declared dependencies** — the escape hatch for incorrect package metadata.

### Use Case: Remove Incorrect Upper Bounds

Package declares `pydantic>=1.0,<2.0` but actually works with 2.x and 3.x:

```toml
[tool.uv]
override-dependencies = [
  "pydantic>=1.0,<4.0",  # Replaces package's <2.0 constraint
]
```

Now the resolver uses `pydantic>=1.0,<4.0` instead of the package's broken constraint.

### Override File (pip interface)

```bash
# overrides.txt
pydantic>=1.0,<4.0
sqlalchemy>=1.4,<3.0

uv pip compile --override overrides.txt requirements.in
```

### Example: Multiple Overrides

Library declares incompatible versions but works fine:

```toml
[tool.uv]
override-dependencies = [
  "pydantic>=1.0,<5.0",        # Was <2.0, actually <5.0
  "sqlalchemy>=1.4,<3.0",      # Was <1.5, actually <3.0
  "numpy>=1.20,<3.0",          # Was <1.24, allow 2.x
]
```

### Constraints vs Overrides

| Aspect | Constraints | Overrides |
|--------|------------|-----------|
| **Purpose** | Narrow versions | Replace declared versions |
| **Combining** | AND with package requirement | REPLACES package requirement |
| **Can expand?** | No | Yes |
| **Typical use** | Restrict transitive deps | Fix broken metadata |
| **Flexibility** | Very restrictive | Full replacement |

**Example difference:**

Package declares: `pydantic>=1.0,<2.0`

```toml
# Constraint: narrow further
[tool.uv]
constraint-dependencies = ["pydantic>=1.5,<2.0"]  # More restrictive

# Override: replace completely
[tool.uv]
override-dependencies = ["pydantic>=1.0,<4.0"]   # Allows 3.x
```

### When to Override vs Constrain

Use **constraints** when:
- Package requirement is reasonable but too loose
- You want to restrict a version further
- The declared requirement is acceptable as a lower bound

Use **overrides** when:
- Package metadata is wrong (upper bound too low)
- Package works fine but declares incompatibility
- You need to expand, not restrict

---

## Build Constraints

Control build-time dependencies separately from runtime dependencies.

### Build Constraints File

```bash
# build-constraints.txt
setuptools>=60,<70
wheel>=0.37
```

Apply during compilation:

```bash
uv pip compile --build-constraint build-constraints.txt requirements.in
```

### In pyproject.toml

```toml
[tool.uv]
build-constraint-dependencies = [
  "setuptools>=60,<70",
  "wheel>=0.37",
]
```

### Example: Isolate Build Deps

Different build tools than runtime:

```toml
[tool.uv]
# Build-time: strict versions, minimal
build-constraint-dependencies = [
  "setuptools==65.5.0",
  "wheel==0.38.4",
]

# Runtime: flexible (defined in project.dependencies)
[project]
dependencies = [
  "pydantic>=2.0",
  "sqlalchemy>=2.0",
]

# Constraints for runtime transitive deps
constraint-dependencies = [
  "numpy<2.0",  # runtime only
]
```

Now:
- Build uses setuptools 65.5.0 (pinned)
- Runtime allows numpy 1.x
- Different constraints applied per phase

### Key Points

✅ **Separate concern** — build != runtime
✅ **Tighter control** — pin build tools precisely
✅ **Avoids conflicts** — build deps don't interfere with runtime

❌ **Limited to build phase** — only used when building packages
❌ **Not in runtime lockfile** — unless also runtime deps

---

## Conflict Declarations

Declare explicitly incompatible extras, groups, or packages. Prevents invalid combinations.

### Extras with Conflicts

CUDA 11 and CUDA 12 versions are incompatible:

```toml
[project.optional-dependencies]
cuda11 = ["torch==2.0.0+cu118"]
cuda12 = ["torch==2.0.0+cu121"]

[tool.uv]
conflicts = [
  [
    { extra = "cuda11" },
    { extra = "cuda12" },
  ],
]
```

**Behavior:**
```bash
# OK: single CUDA version
uv sync --extra cuda11

# ERROR: conflicting extras
uv sync --extra cuda11 --extra cuda12
```

### Dependency Groups with Conflicts

Test with old or new pytest versions (mutually exclusive):

```toml
[dependency-groups]
test-old = ["pytest<7"]
test-new = ["pytest>=8"]

[tool.uv]
conflicts = [
  [
    { group = "test-old" },
    { group = "test-new" },
  ],
]
```

```bash
# OK
uv sync --group test-old

# ERROR: incompatible test versions
uv sync --group test-old --group test-new
```

### Workspace Member Conflicts

Members with incompatible requirements:

```toml
# workspace root
[tool.uv]
conflicts = [
  [
    { package = "legacy-api", extra = "oldlibs" },
    { package = "modern-api", extra = "newlibs" },
  ],
]
```

```bash
# OK: build either legacy or modern
uv sync --package legacy-api
uv sync --package modern-api

# ERROR: incompatible member extras
uv sync --package legacy-api --extra oldlibs --package modern-api --extra newlibs
```

### Multiple Conflicts

Declare multiple conflict groups:

```toml
[tool.uv]
conflicts = [
  # CUDA versions
  [
    { extra = "cuda11" },
    { extra = "cuda12" },
  ],
  # Test frameworks
  [
    { extra = "pytest" },
    { extra = "unittest" },
  ],
  # API versions
  [
    { group = "api-v1" },
    { group = "api-v2" },
  ],
]
```

### When to Declare Conflicts

✅ Extras are truly incompatible (can't both be installed)
✅ Groups require different versions of same package
✅ Workspace members have conflicting requirements

❌ Dependencies that just don't play well (use constraints instead)
❌ Performance conflicts (use constraints or overrides)

---

## Dependency Metadata Override

Provide package metadata when it's not available statically. Avoids building from source.

### Define Metadata

```toml
[[tool.uv.dependency-metadata]]
name = "chumpy"
version = "0.70"
requires-dist = ["numpy>=1.8.1", "scipy>=0.13.0"]

[[tool.uv.dependency-metadata]]
name = "flash-attn"
version = "2.6.3"
requires-dist = ["torch", "einops"]
```

### Use Cases

1. **No static metadata** — package doesn't declare dependencies in wheel
2. **Wheel-building delays** — Git dependencies, local builds
3. **Platform-specific builds** — binary packages with complex requirements
4. **Avoiding source builds** — prevent compilation on incompatible platforms

### Example: Git Dependency

Git dependency without proper metadata:

```toml
[tool.uv.sources]
mylib = { git = "https://github.com/org/mylib.git", rev = "main" }

[[tool.uv.dependency-metadata]]
name = "mylib"
version = "0.1.0+git"
requires-dist = [
  "pydantic>=2.0",
  "sqlalchemy>=2.0",
  "click>=8.0",
]
```

Resolver now knows dependencies without building source.

### Complex Example: Multiple Versions

Different versions have different requirements:

```toml
[[tool.uv.dependency-metadata]]
name = "mylib"
version = "1.0.0"
requires-dist = ["pydantic>=1.0,<2.0"]

[[tool.uv.dependency-metadata]]
name = "mylib"
version = "2.0.0"
requires-dist = ["pydantic>=2.0,<3.0"]
```

---

## Decision Framework

### When to Use Each Pattern

```
Does the issue involve wrong package metadata?
├─ YES → Use Overrides
│        (Override broken version constraint)
│
└─ NO → Does it involve build-time deps?
         ├─ YES → Use Build Constraints
         │        (Separate build from runtime)
         │
         └─ NO → Does it involve incompatible extras/groups?
                  ├─ YES → Use Conflict Declarations
                  │        (Prevent invalid combinations)
                  │
                  └─ NO → Does it involve missing metadata?
                           ├─ YES → Use Dependency Metadata Override
                           │        (Provide metadata explicitly)
                           │
                           └─ NO → Use Constraints
                                   (Narrow acceptable versions)
```

### Quick Decision Table

| Problem | Solution | Example |
|---------|----------|---------|
| Transitive dep too new | Constraints | `urllib3<2.0` too loose? Constrain to `<1.26` |
| Package metadata wrong | Overrides | Declared `<2.0` but works up to `<4.0` |
| Build needs pinned version | Build Constraints | Pin setuptools to 65.5.0 |
| Extras mutually exclusive | Conflicts | `cuda11` and `cuda12` both defined |
| Git dep has no metadata | Metadata Override | Unknown dependencies on Git revision |
| Group versions conflict | Conflicts | `test-old` requires `pytest<7`, `test-new` requires `>=8` |

---

## Workspace-Wide vs Package-Specific

### Workspace-Wide (Root pyproject.toml)

Settings apply to all members:

```toml
# Root workspace pyproject.toml
[tool.uv]
# All members inherit these
override-dependencies = ["numpy>=1.24"]
constraint-dependencies = ["urllib3<2.0"]
build-constraint-dependencies = ["setuptools>=60"]

[tool.uv.workspace]
members = ["packages/*"]
```

**Effect:** Every package resolves with these constraints/overrides.

### Per-Member (Package pyproject.toml)

Members can override or add their own:

```toml
# packages/core/pyproject.toml
[tool.uv]
# Workspace-wide constraints still apply
# Plus member-specific constraints
constraint-dependencies = ["torch<2.0"]  # Core specific
```

**Effect:** Member uses workspace constraints + own constraints.

### Inheritance Rules

1. Root `[tool.uv]` settings apply to all members by default
2. Members can add to or override with their own settings
3. Member settings combine with root settings (not replace)
4. Conflicts declarations must be at root level (workspace scope)

### Example: Workspace with Multiple Members

```toml
# pyproject.toml (root)
[tool.uv]
override-dependencies = ["pydantic>=2.0"]  # All members

[tool.uv.workspace]
members = ["packages/*"]

conflicts = [
  [
    { package = "gpu-pkg", extra = "cuda11" },
    { package = "gpu-pkg", extra = "cuda12" },
  ],
]

# packages/core/pyproject.toml
[project]
name = "core"
dependencies = ["pydantic"]

[tool.uv]
# Inherits: override pydantic>=2.0
# Plus adds:
constraint-dependencies = ["sqlalchemy<2.0"]

# packages/ml/pyproject.toml
[project]
name = "ml"
dependencies = ["torch", "numpy"]

[tool.uv]
# Inherits: override pydantic>=2.0
# Plus adds:
constraint-dependencies = ["torch>=1.13,<3.0"]
```

---

## Common Patterns

### Pattern 1: Monorepo with Shared Dependencies

Multiple packages share a dependency tree:

```toml
# Root: enforce consistent versions
[tool.uv]
constraint-dependencies = [
  "pydantic>=2.0,<3.0",
  "sqlalchemy>=2.0,<3.0",
  "fastapi>=0.100,<1.0",
]

# All packages use these constraints
# No need to declare per-package
```

### Pattern 2: GPU-Accelerated Packages

CUDA 11 and CUDA 12 are incompatible:

```toml
[project.optional-dependencies]
gpu-cuda11 = ["torch==2.0.0+cu118"]
gpu-cuda12 = ["torch==2.0.0+cu121"]

[tool.uv]
conflicts = [
  [
    { extra = "gpu-cuda11" },
    { extra = "gpu-cuda12" },
  ],
]
```

### Pattern 3: Testing Matrix

Multiple test environments with conflicting tools:

```toml
[dependency-groups]
test-pytest = ["pytest>=7"]
test-nose2 = ["nose2>=0.12"]
test-legacy = ["unittest2>=1.1"]

[tool.uv]
conflicts = [
  [
    { group = "test-pytest" },
    { group = "test-nose2" },
  ],
  [
    { group = "test-pytest" },
    { group = "test-legacy" },
  ],
]
```

### Pattern 4: Loose Transitive Dependency

Dependency pulls in too-new version:

```
myapp
├── requests → urllib3>=2.0   (too new)
└── legacy-pkg → urllib3<1.26  (requirement)
```

Solution:

```toml
[project]
dependencies = ["requests", "legacy-pkg"]

[tool.uv]
constraint-dependencies = ["urllib3<1.26"]  # Narrow urllib3
```

### Pattern 5: Broken Metadata Override

Library metadata is wrong:

```toml
# Package declares: sqlalchemy>=1.4,<1.5
# Actual requirement: sqlalchemy>=1.4,<3.0

[tool.uv]
override-dependencies = ["sqlalchemy>=1.4,<3.0"]
```

### Pattern 6: Hybrid Build/Runtime

Different tooling for build vs runtime:

```toml
[tool.uv]
# Precise build tooling
build-constraint-dependencies = [
  "setuptools==65.5.0",
  "wheel==0.38.4",
  "hatchling==1.20",
]

# Flexible runtime
constraint-dependencies = [
  "pydantic>=2.0,<5.0",
  "numpy>=1.20",
]

[project]
dependencies = [
  "pydantic>=2.0",
  "numpy>=1.20",
]
```

---

## Troubleshooting

### Problem: Constraint Not Applied

```bash
# Constraint on unused package
[tool.uv]
constraint-dependencies = ["urllib3<2.0"]

# But nothing requires urllib3!
[project]
dependencies = ["requests"]  # urllib3 is transitive
```

**Solution:** Constraints only work on packages already in the dependency tree. Verify urllib3 is actually required:

```bash
uv tree | grep urllib3
```

### Problem: Conflicting Overrides

```bash
# Two packages declare conflicting overrides
# Package A: override numpy<2.0
# Package B: override numpy>=2.0
```

**Solution:** Centralize overrides in workspace root:

```toml
# Root pyproject.toml
[tool.uv]
override-dependencies = ["numpy>=1.20,<3.0"]  # Single source of truth
```

### Problem: Conflicts Not Preventing Installation

```bash
[tool.uv]
conflicts = [
  [
    { extra = "cuda11" },
    { extra = "cuda12" },
  ],
]

# But: uv sync --extra cuda11 --extra cuda12 still works?
```

**Solution:** Conflicts are declarative intent. The resolver respects them, but you must respect them when syncing:

```bash
# Correct: one extra
uv sync --extra cuda11

# Violates conflict: resolver rejects this
uv sync --extra cuda11 --extra cuda12
```

### Problem: Metadata Override Not Used

```toml
[[tool.uv.dependency-metadata]]
name = "mylib"
version = "0.1.0"
requires-dist = ["numpy"]
```

**Issue:** Version must match exactly.

```bash
# If mylib==0.2.0 installed but metadata is for 0.1.0:
# Metadata ignored!

# Solution: provide metadata for all versions
[[tool.uv.dependency-metadata]]
name = "mylib"
version = "0.1.0"
requires-dist = ["numpy"]

[[tool.uv.dependency-metadata]]
name = "mylib"
version = "0.2.0"
requires-dist = ["numpy>=1.20"]
```

### Debug Commands

View full dependency tree:

```bash
uv tree
uv tree --package requests  # Focus on one package
uv tree --invert            # Reverse dependencies (why is X included?)
```

Check resolution without syncing:

```bash
uv lock --dry-run
```

Explain why a version was selected:

```bash
uv tree --package urllib3
# Shows entire chain to that package
```

---

## Resources

### Official Documentation

- [uv Constraints](https://docs.astral.sh/uv/reference/settings/#constraint-dependencies)
- [uv Overrides](https://docs.astral.sh/uv/reference/settings/#override-dependencies)
- [uv Workspaces](https://docs.astral.sh/uv/concepts/workspaces/)
- [uv Dependency Metadata](https://docs.astral.sh/uv/reference/settings/#dependency-metadata)
- [uv Conflicts](https://docs.astral.sh/uv/reference/settings/#conflicts)

### Related Topics

- [Resolution Strategies](./resolution.md) — universal vs platform-specific, fork strategies
- [Workspaces](./workspaces.md) — organizing monorepos with shared lockfiles
- [Dependency Groups](./dependency-groups.md) — optional dependencies and test groups
