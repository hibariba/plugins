---
name: monorepo-python
description: Python monorepo setup and management with uv workspaces and Pants. Use for "Python monorepo", "uv workspace", "uv workspaces", "Pants build", "Pants Python", "Python workspace", "pyproject.toml workspace", "Python multi-package", "uv sync", "uv lock", "Python dependency management", or "Python CI optimization".
---

# Python Monorepo

Setup and manage Python monorepos using uv workspaces (simple) or Pants (advanced).

## Quick Navigation

- **uv Workspaces** → [references/uv-workspaces.md](references/uv-workspaces.md)
- **Advanced uv** → [references/uv-advanced.md](references/uv-advanced.md)
- **Pants Build System** → [references/pants.md](references/pants.md)
- **Docker Patterns** → [references/docker-python.md](references/docker-python.md)

## Tool Selection

| Scale | Tool | Use When |
|-------|------|----------|
| 1-20 packages | uv workspaces | Simple setup, single lockfile |
| 20-50 packages | uv + Turborepo | Need affected-only testing |
| 50+ packages | Pants | File-level deps, remote cache |

## uv Workspaces (Stage 1)

### Setup

```bash
# Initialize
uv init --name my-workspace
mkdir -p libs/shared services/api
```

**Root pyproject.toml:**

```toml
[project]
name = "my-workspace"
version = "0.1.0"
requires-python = ">=3.12"

[tool.uv.workspace]
members = ["libs/*", "services/*"]

[tool.uv.sources]
shared = { workspace = true }

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Package pyproject.toml (libs/shared):**

```toml
[project]
name = "shared"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pydantic>=2.0"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Service pyproject.toml (services/api):**

```toml
[project]
name = "api"
version = "0.1.0"
dependencies = ["fastapi>=0.104", "shared"]

[tool.uv.sources]
shared = { workspace = true }

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### Essential Commands

```bash
# Install all packages
uv sync --all-packages

# Install specific package
uv sync --package api

# Run in package context
uv run --package api pytest
uv run --package api python -m api.main

# Add dependency to package
cd services/api && uv add httpx

# Add workspace dependency
uv add shared --editable

# Upgrade dependencies
uv lock --upgrade
uv lock --upgrade-package fastapi

# Find reverse dependencies
uv tree --invert pydantic

# Refresh lock (bypass cache)
uv lock --refresh
```

### Directory Structure

```
monorepo/
├── pyproject.toml          # Root workspace
├── uv.lock                  # Single lockfile
├── libs/
│   └── shared/
│       ├── pyproject.toml
│       ├── src/shared/
│       │   ├── __init__.py
│       │   └── models.py
│       └── tests/
└── services/
    └── api/
        ├── pyproject.toml
        ├── Dockerfile
        ├── src/api/
        │   ├── __init__.py
        │   └── main.py
        └── tests/
```

### Configuration Reference

```toml
[tool.uv]
# Shared Python version
python-version = "3.12"

# Package indexes
index = [
    { name = "private", url = "https://pypi.example.com/simple/", priority = "primary" },
    { name = "pypi", url = "https://pypi.org/simple/" }
]

# Version constraints (apply to all packages)
constraint-dependencies = ["numpy<2.0"]

# Force specific versions
override-dependencies = ["pydantic==2.7.0"]

[tool.uv.workspace]
members = ["libs/*", "services/*"]
exclude = ["packages/legacy"]
```

## Pants Build System (Stage 3)

### When to Use Pants

- CI times > 30 minutes
- File-level dependency tracking needed
- Remote caching essential
- 50+ developers

### Setup

```bash
# Install Pants
curl --proto '=https' --tlsv1.2 -fsSL \
  https://static.pantsbuild.org/setup/install-pants.sh | bash
```

**pants.toml:**

```toml
[GLOBAL]
pants_version = "2.30.0"
backend_packages = [
    "pants.backend.python",
    "pants.backend.python.lint.black",
    "pants.backend.python.typecheck.mypy",
    "pants.backend.python.testing.pytest",
    "pants.backend.docker",
]

[python]
interpreter_constraints = [">=3.11,<3.13"]
enable_resolves = true
default_resolve = "python-default"

[python.resolves]
python-default = "3rdparty/python/default.lock"

[source]
root_patterns = ["/packages/*", "/apps/*"]
```

### Generate BUILD Files

```bash
# Auto-generate BUILD files from imports
pants tailor ::
```

**Example BUILD file (auto-generated):**

```python
python_sources(name="lib")
python_tests(name="tests", timeout=120)
```

### Essential Commands

```bash
# Run all tests
pants test packages/::

# Affected-only testing (huge time savings)
pants --changed-since=origin/main --changed-dependents=transitive test

# Lint and format
pants fmt lint check ::

# Build PEX binary
pants package //apps/api:pex

# Show dependencies
pants dependencies --transitive //apps/api
pants dependents //libs/shared
```

### Remote Caching

**Depot:**
```toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "grpcs://cache.depot.dev"
remote_store_headers = { "Authorization" = "Bearer ${DEPOT_TOKEN}" }
```

**BuildBuddy:**
```toml
[GLOBAL]
remote_store_address = "grpcs://remote.buildbuddy.io"
remote_store_headers = { "Authorization" = "Bearer ${BUILDBUDDY_TOKEN}" }
```

## Docker Integration

### uv Multi-Stage Build

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /workspace

# Copy workspace config
COPY pyproject.toml uv.lock ./
COPY libs/shared/ ./libs/shared/
COPY services/api/ ./services/api/

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies (cached layer)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --package api

FROM python:3.12-slim
WORKDIR /app

COPY --from=builder /workspace/.venv /app/.venv
COPY --from=builder /workspace/services/api/src /app/src

ENV PATH="/app/.venv/bin:$PATH"
ENV UV_COMPILE_BYTECODE=1

CMD ["python", "-m", "api.main"]
```

### Pants Docker Build

```python
# apps/api/BUILD
pex_binary(
    name="pex",
    entry_point="main.py",
)

docker_image(
    name="image",
    image_tags=["api:latest"],
    dependencies=[":pex"],
)
```

```bash
pants build //apps/api:image
docker load < dist/apps/api.tar
```

## CI/CD Configuration

### GitHub Actions (uv)

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-packages
      - run: uv run pytest packages/
```

### GitHub Actions (Pants)

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pantsbuild/actions/init-pants@v5
      - run: |
          pants --changed-since=origin/main \
                --changed-dependents=transitive \
                test
```

## Common Patterns

### Adding New Package

```bash
mkdir -p libs/new-lib/src/new_lib

cat > libs/new-lib/pyproject.toml << 'EOF'
[project]
name = "new-lib"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
EOF

uv sync --all-packages
```

### Using Workspace Dependency

```bash
cd services/api
uv add new-lib --editable

# Or manually:
# [project]
# dependencies = ["new-lib"]
# [tool.uv.sources]
# new-lib = { workspace = true }
```

### Publishing Package

```bash
uv build --package shared
uv publish --package shared
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Package not found | Check `members` glob in root pyproject.toml |
| Wrong version installed | Verify `workspace = true` in [tool.uv.sources] |
| Lockfile conflicts | Run `uv lock --upgrade` |
| Editable not working | Ensure package has src/ layout |
| Docker build slow | Use multi-stage with dependency caching |
| Pants inference fails | Verify `__init__.py` exists, run `pants tailor ::` |

## Further Reading

- [references/uv-workspaces.md](references/uv-workspaces.md) — Complete uv setup and commands
- [references/uv-advanced.md](references/uv-advanced.md) — Resolution strategies, constraints, overrides
- [references/pants.md](references/pants.md) — Full Pants configuration and patterns
- [references/docker-python.md](references/docker-python.md) — Production Docker patterns
