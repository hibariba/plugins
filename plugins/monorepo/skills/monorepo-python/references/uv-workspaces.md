# Stage 1: Python-Only Monorepo with uv Workspaces

## Overview

uv workspaces provide the simplest Python monorepo foundation with Cargo-inspired design and single lockfile.

**Use when:**
- Python-only codebase
- < 10 packages
- CI < 5 minutes
- Team < 20 developers

## Setup

### 1. Initialize Root Workspace

```bash
cd monorepo
uv init --name my-workspace
```

### 2. Configure pyproject.toml

```toml
[project]
name = "my-workspace"
version = "0.1.0"
requires-python = ">=3.12"

[tool.uv.workspace]
members = ["packages/*", "services/*", "libs/*"]
exclude = ["packages/legacy"]

[tool.uv.sources]
# Internal dependencies use workspace = true
shared-core = { workspace = true }
shared-utils = { workspace = true }

[build-system]
requires = ["uv_build>=0.9.28,<0.10.0"]
build-backend = "uv_build"
```

### 3. Create Package Structure

```bash
mkdir -p libs/shared-core/src/shared_core
mkdir -p services/api/src/api
mkdir -p packages/cli/src/cli
```

### 4. Add Package pyproject.toml

**libs/shared-core/pyproject.toml:**

## Workspace-Wide Settings

Root `[tool.uv]` configuration is inherited by all workspace members, providing centralized dependency management and Python version constraints.

### Inheritance Pattern

**Root pyproject.toml [tool.uv] section:**

```toml
[tool.uv]
# Shared Python version constraint
python-version = "3.12"

# Package index priority (inherited by all members)
index = [
    { name = "private", url = "https://pypi.example.com/simple/", priority = "primary" },
    { name = "pypi", url = "https://pypi.org/simple/" }
]

# Shared constraints (all packages respect these)
constraint-dependencies = [
    "numpy<2.0",  # Pin major version across monorepo
]

# Dependency overrides (enforce specific versions monorepo-wide)
override-dependencies = [
    "pydantic==2.7.0",  # Critical bug fix for all packages
]

# Environment variable limits
environments = [
    { name = "dev", python = "3.12" },
    { name = "test", python = "3.12" },
    { name = "prod", python = "3.12" },
]

[tool.uv.workspace]
members = ["packages/*", "services/*", "libs/*"]
exclude = ["packages/legacy"]
```

**Member package inheritance:**

Members automatically inherit:
- `python-version` and index configuration
- Constraint and override dependencies apply to entire resolution
- All members resolved as single dependency graph

Members can override `requires-python` but must remain compatible with root `python-version`:

```toml
# services/api/pyproject.toml
[project]
requires-python = ">=3.12"  # Must be compatible with root 3.12
```

### Shared Dependencies vs Package Dependencies

```bash
# Root uv.lock contains all transitive dependencies for entire workspace
# Each package sees all workspace members + shared external deps

# Example: If root defines
# constraint-dependencies = ["numpy<2.0"]
# All packages are constrained, regardless of explicit dependency

uv sync --all-packages  # Respects all root constraints
```


```toml
[project]
name = "shared-core"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "pydantic>=2.0",
    "sqlalchemy>=2.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**services/api/pyproject.toml:**
```toml
[project]
name = "api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.104",
    "uvicorn>=0.24",
    "shared-core",  # Workspace dependency
]

[tool.uv.sources]
shared-core = { workspace = true }

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

## Essential Commands

```bash
# Install all workspace packages
uv sync --all-packages

# Install specific package
uv sync --package api

# Run command in package context
uv run --package api python -m api.main
uv run --package api pytest

# Add dependency to package
cd services/api
uv add httpx

# Add workspace dependency
uv add shared-core --editable

# Upgrade dependencies
uv lock --upgrade
uv lock --upgrade-package fastapi

# Build package
uv build --package api

# List workspace packages
uv tree --package api
```

## Configuration Reference

### Complete [tool.uv] Structure

**Root workspace configuration:**

```toml
[tool.uv]
# Python version for all workspace members
python-version = "3.12"

# Global index configuration (all members inherit)
index = [
    { name = "private", url = "https://pypi.example.com/simple/", priority = "primary" },
    { name = "pypi", url = "https://pypi.org/simple/" }
]

# Fallback indexes for packages unavailable in primary
indexes = [
    { name = "backup", url = "https://backup-pypi.example.com/simple/" }
]

# Dependencies that apply to entire workspace
# Useful for pinning critical versions
constraint-dependencies = [
    "openssl<4.0",
    "cryptography>=42.0.0",
]

# Force specific versions (highest priority)
override-dependencies = [
    "pydantic==2.7.0",
]

# Environment configuration
environments = [
    { name = "dev", python = "3.12" },
    { name = "test", python = "3.12" },
    { name = "prod", python = "3.12" },
]

# Pre-release handling
prerelease = "if-necessary"

# Comment: workspaces defined in [tool.uv.workspace]

[tool.uv.workspace]
members = ["packages/*", "services/*", "libs/*"]
exclude = ["packages/legacy", "packages/deprecated"]

[tool.uv.sources]
# Workspace member sources
shared-core = { workspace = true }
shared-utils = { workspace = true }

# Path dependencies (for single-location packages)
# local-lib = { path = "../sibling-repo/local-lib" }

# Git dependencies
# dev-tools = { git = "https://github.com/org/dev-tools", branch = "main" }

# URL dependencies
# legacy-lib = { url = "file:///opt/legacy/legacy-lib" }
```

### Common Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `UV_FROZEN` | `false` | Prevent uv.lock updates during sync/install |
| `UV_OFFLINE` | `false` | Use only cached packages, fail if not cached |
| `UV_COMPILE_BYTECODE` | `0` | Pre-compile Python to .pyc bytecode |
| `UV_LINK_MODE` | `symlink` | `copy`, `symlink`, or `clone` for venv linking |
| `UV_SHOW_SETTINGS` | `false` | Display resolved configuration before running |
| `UV_PYTHON` | Auto-detect | Override Python interpreter path |
| `UV_PYTHON_DOWNLOADS` | `automatic` | `automatic` or `never` for Python downloads |
| `UV_CACHE_DIR` | `~/.cache/uv` | Override cache location |
| `UV_PROJECT_ENVIRONMENT` | `.venv` | Override venv location |

### Index Configuration Patterns

**Multiple indexes with fallback:**

```toml
[tool.uv]
index = [
    { name = "private", url = "https://pypi.example.com/simple/", priority = "primary" },
    { name = "pypi", url = "https://pypi.org/simple/" }
]

# First index checked is primary; others are fallbacks
```

**Package-specific index:**

```toml
[tool.uv.sources]
# Use private index for specific package
proprietary-lib = { index = "private" }

# Workspace member always has implicit priority
internal-sdk = { workspace = true }
```

### Configuration Priority Order

Lower number = higher priority

1. `[tool.uv.sources]` package-specific overrides
2. `[tool.uv]` workspace-wide overrides
3. `[tool.uv]` constraint-dependencies
4. pyproject.toml `[project]` dependencies
5. Inherited from parent (in nested projects)
6. uv defaults

### Related Documentation

- See [advanced-resolution.md](advanced-resolution.md) for complex dependency resolution strategies
- See [dependency-constraints.md](dependency-constraints.md) for constraint vs override patterns
- See [docker-and-ci.md](docker-and-ci.md) for production configuration patterns

## Docker Integration

### Multi-Stage Build with Bytecode Compilation

**Production-optimized Dockerfile for services/api:**

```dockerfile
FROM python:3.12-slim AS builder

WORKDIR /workspace

# Copy workspace config
COPY pyproject.toml uv.lock ./

# Copy all required packages (dependency layer)
COPY libs/shared-core/ ./libs/shared-core/
COPY services/api/ ./services/api/

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies (cached layer)
RUN uv sync --frozen --no-install-workspace

# Install workspace packages
RUN uv sync --frozen

FROM python:3.12-slim

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /workspace/.venv /app/.venv

# Copy application code
COPY --from=builder /workspace/services/api/src /app/src

ENV PATH="/app/.venv/bin:$PATH"
ENV UV_LINK_MODE=copy

CMD ["python", "-m", "api.main"]
```

### Optimized Layer Caching

```dockerfile
# Dependency-only layer (rarely changes)
RUN uv sync --frozen --no-install-workspace

# Copy source after dependencies installed
COPY libs/shared-core/src ./libs/shared-core/src
COPY services/api/src ./services/api/src

# Install workspace packages (code changes frequently)
RUN uv sync --frozen
```

### BuildKit Cache Mount for Faster Rebuilds

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

WORKDIR /workspace

COPY pyproject.toml uv.lock ./
COPY libs/shared-core/ ./libs/shared-core/
COPY services/api/ ./services/api/

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Cache uv's HTTP cache across builds
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-workspace

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /workspace/.venv /app/.venv
COPY --from=builder /workspace/services/api/src /app/src

ENV PATH="/app/.venv/bin:$PATH"
ENV UV_LINK_MODE=copy
ENV UV_COMPILE_BYTECODE=1

CMD ["python", "-m", "api.main"]
```

Build with BuildKit:
```bash
DOCKER_BUILDKIT=1 docker build -t api:latest .
```

### Performance Improvements

**Before optimization:**
- Cold build: 120s (every dependency downloaded and resolved)
- Warm build with code change: 90s (dependencies recached, workspace rebuilt)

**After bytecode + BuildKit cache:**
- Cold build: 85s (dependencies still downloaded, but .pyc cached)
- Warm build with code change: 15s (HTTP cache and .pyc reused)
- Warm build with dep change: 45s (HTTP cache reused, resolution cached)

### UV_LINK_MODE and UV_COMPILE_BYTECODE

| Variable | Value | Effect |
|----------|-------|--------|
| `UV_LINK_MODE` | `copy` | Copy packages to venv instead of symlinking (required in Docker) |
| `UV_COMPILE_BYTECODE` | `1` | Pre-compile Python to .pyc for faster imports on container startup |

See [docker-and-ci.md](docker-and-ci.md) for complete Docker patterns, multi-registry configuration, and security hardening.

## CI/CD Configuration

**GitHub Actions:**

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [shared-core, api, cli]

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3
        with:
          version: "latest"

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: uv sync --all-packages

      - name: Run tests
        run: uv run --package ${{ matrix.package }} pytest

      - name: Run linting
        run: |
          uv run --package ${{ matrix.package }} ruff check
          uv run --package ${{ matrix.package }} mypy src
```

## Directory Structure

```
monorepo/
├── pyproject.toml                # Root workspace config
├── uv.lock                       # Single lockfile
├── .python-version               # Python version
├── libs/                         # Shared libraries
│   ├── shared-core/
│   │   ├── pyproject.toml
│   │   ├── src/shared_core/
│   │   │   ├── __init__.py
│   │   │   ├── models.py
│   │   │   └── utils.py
│   │   └── tests/
│   └── shared-utils/
│       ├── pyproject.toml
│       └── src/shared_utils/
├── services/                     # Backend services
│   ├── api/
│   │   ├── pyproject.toml
│   │   ├── Dockerfile
│   │   ├── src/api/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   └── routes/
│   │   └── tests/
│   └── worker/
│       ├── pyproject.toml
│       └── src/worker/
└── packages/                     # CLI tools, utilities
    └── cli/
        ├── pyproject.toml
        └── src/cli/
```

## Common Patterns

### Adding New Library

```bash
mkdir -p libs/new-lib/src/new_lib
cd libs/new-lib

cat > pyproject.toml <<EOF
[project]
name = "new-lib"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
EOF

# Back to root
cd ../..
uv sync --all-packages
```

### Using Workspace Dependency

```bash
cd services/api
uv add new-lib --editable

# Or manually edit pyproject.toml:
# dependencies = ["new-lib"]
# [tool.uv.sources]
# new-lib = { workspace = true }

uv sync
```

### Running Tests Across Workspace

```bash
# All packages
uv run pytest

# Specific package
uv run --package api pytest

# With coverage
uv run --package api pytest --cov=api --cov-report=html
```

### Publishing Packages

```bash
# Build distribution
uv build --package shared-core

# Publish to PyPI
uv publish --package shared-core

# Or use twine
uv run twine upload dist/*
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Package not found | Check `members` glob in root pyproject.toml |
| Wrong version installed | Verify `workspace = true` in [tool.uv.sources] |
| Lockfile conflicts | Run `uv lock --upgrade` to regenerate |
| Editable install not working | Ensure package has src/ layout |
| Docker build slow | Use multi-stage builds with dependency caching |

### Advanced Debugging

**Find reverse dependencies (what depends on a package):**

```bash
# Show all packages that depend on 'pydantic'
uv tree --invert pydantic

# Output shows dependency chains leading to pydantic
# Useful for understanding version conflicts
```

**Refresh lock without cache:**

```bash
# Bypass uv's cache for fresh resolution
uv lock --refresh

# Specific package only
uv lock --refresh-package httpx
```

**Clear cache when resolution stalls:**

```bash
# Full cache clear (last resort)
uv cache clean

# Targeted cache clear
uv cache clean --all-packages
```

**Resolution conflict debugging:**

```bash
# Enable verbose output during lock
uv lock --verbose

# Show why a dependency was selected
uv lock --verbose 2>&1 | grep -A5 "Resolution error"
```

See [dependency-constraints.md](dependency-constraints.md) for strategies to resolve complex conflicts between workspace members and external dependencies.

## When to Use Alternatives

### Workspace vs Path Dependencies

**Use workspaces when:**
- All packages are in the same repository
- Need unified lockfile and version management
- Changing shared-core affects multiple packages simultaneously

**Use path dependencies when:**
- Package is in separate repository but needed locally
- Teams maintain packages independently
- Version pinning varies per consumer

Example path dependency:
```toml
# services/api/pyproject.toml
[tool.uv.sources]
shared-core = { path = "../shared-monorepo/shared-core" }
```

### Virtual Workspaces

For dependency-only root without actual code:

```toml
# Root pyproject.toml (no [project] section - virtual workspace)
[tool.uv.workspace]
members = ["packages/*", "services/*", "libs/*"]

# Still manages unified lockfile but root isn't a package
```

Use virtual workspaces when:
- Root has no code, only dependency constraints
- Cleaner separation of workspace management from actual packages

### Flat Layout for Small Monorepos

For < 3 packages, consider flat layout without workspaces:

```
monorepo/
├── pyproject.toml      # Single root project
├── src/
│   ├── api/
│   ├── shared_core/
│   └── cli/
└── tests/
```

```toml
[project]
dependencies = [
    "fastapi>=0.104",
    "sqlalchemy>=2.0",
]
```

### When NOT to Use Workspaces

Avoid workspaces if:
- Projects need independent versioning and release cycles
- Packages published to PyPI with separate versions
- Teams need complete separation (different CI, dependency policies)

Consider Stage 2 (uv + pnpm) or Stage 3 (Pants) instead.

## Migration to Stage 2

When to migrate:
- Adding TypeScript/JavaScript packages
- Frontend + backend monorepo
- Need Node.js tooling

See [migration-stages.md](migration-stages.md) for uv → uv+pnpm migration.

## Migration to Stage 3

When to migrate:
- CI times > 10 minutes
- > 20 packages
- Need file-level dependency tracking
- Multi-language requirements

See [migration-stages.md](migration-stages.md) for uv → Pants migration.

## Resources

- uv workspaces: https://docs.astral.sh/uv/concepts/projects/workspaces/
- Docker integration: https://docs.astral.sh/uv/guides/integration/docker/
- uv commands: https://docs.astral.sh/uv/reference/cli/
