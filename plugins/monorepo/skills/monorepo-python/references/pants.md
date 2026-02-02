# Pants Build System Reference

Pants delivers file-level dependency intelligence for Python monorepos at scale through automatic dependency inference and remote caching. This guide covers setup, configuration, and operational patterns for Python-focused teams.

## Core Architecture

Pants distinguishes itself through **automatic dependency inference**—it analyzes Python import statements to construct dependency graphs without manual BUILD file maintenance. This eliminates the primary burden of traditional build systems while providing file-level granularity that simpler tools cannot match.

### When to Use Pants

Adopt Pants when:
- CI times exceed 30 minutes
- File-level dependency tracking becomes essential
- Remote build execution and caching needed
- Multi-language coordination required (Python + JavaScript/Docker)
- 50+ developers sharing the repository

Pants is overkill for small teams or projects under 10K LOC. Consider uv workspaces as a simpler alternative first.

## Setup and Configuration

### pants.toml Essentials

The `pants.toml` file at the repository root configures the Pants engine:

```toml
[GLOBAL]
pants_version = "2.30.0"
backend_packages = [
    "pants.backend.python",
    "pants.backend.python.lint.black",
    "pants.backend.python.typecheck.mypy",
    "pants.backend.python.test.pytest",
    "pants.backend.docker",
    "pants.backend.experimental.javascript",
]

pants_home = ".pants"
log_dir = ".pants/logs"

[python]
interpreter_constraints = [">=3.9,<3.13"]
enable_resolves = true
default_resolve = "python-default"

[python.resolves]
python-default = "3rdparty/python/default.lock"
data-science = "3rdparty/python/data-science.lock"

[pytest]
args = ["--timeout=120", "-v"]
timeout_default = 120

[black]
config = "pyproject.toml"

[mypy]
config = "pyproject.toml"

[docker]
registries = ["docker.io"]

[source]
root_patterns = ["/src", "/apps"]
```

### Project Structure

Recommended layout following Pants conventions:

```
monorepo/
├── pants.toml
├── BUILD
├── pyproject.toml (workspace metadata)
├── 3rdparty/
│   └── python/
│       ├── BUILD
│       ├── requirements.txt
│       └── default.lock
├── src/
│   └── myapp/
│       ├── BUILD
│       ├── main.py
│       ├── core/
│       │   ├── BUILD
│       │   └── logic.py
│       └── utils/
│           ├── BUILD
│           └── helpers.py
├── apps/
│   └── api/
│       ├── BUILD
│       ├── pyproject.toml
│       └── server.py
└── tools/
    └── scripts/
        ├── BUILD
        └── release.py
```

## BUILD File Patterns

### Minimal BUILD Files with Inference

Pants infers most dependencies from import statements. BUILD files focus on declaring targets, not dependencies:

```python
# 3rdparty/python/BUILD - Third-party dependencies
python_requirements(
    name="reqs",
    source="requirements.txt",
)
```

```python
# src/myapp/core/BUILD - Library target
python_sources(
    name="lib",
    sources=["*.py"],
)

python_tests(
    name="tests",
    sources=["*_test.py"],
    timeout=120,
)
```

```python
# src/myapp/BUILD - Package with multiple modules
python_sources(
    name="lib",
)

python_tests(
    name="tests",
    timeout=120,
)

pex_binary(
    name="bin",
    entry_point="main.py",
)
```

### Advanced Patterns

**Multi-resolve for dependency isolation:**

```python
# src/data_science/BUILD
python_sources(
    name="lib",
    resolve="data-science",  # Uses different lockfile
)
```

**Docker image packaging:**

```python
# apps/api/BUILD
docker_image(
    name="image",
    image_tags=["latest", "v0.1.0"],
    dependencies=[":pex"],
)

pex_binary(
    name="pex",
    entry_point="server.py",
)
```

**Test batching and parameterization:**

```python
# src/myapp/BUILD
python_tests(
    name="unit_tests",
    sources=["tests/unit_*.py"],
    timeout=60,
)

python_tests(
    name="integration_tests",
    sources=["tests/integration_*.py"],
    timeout=300,
    execution_mode="nailgun",  # Long-lived process
)
```

## Dependency Inference Deep Dive

### How Inference Works

Pants analyzes `import` and `from ... import` statements to construct dependency graphs:

```python
# src/myapp/api/handler.py
from myapp.core.logic import process  # → Depends on src/myapp/core
import requests  # → Depends on 3rdparty/python:reqs
```

Pants automatically infers the dependency on both internal targets and third-party packages.

### Explicit Dependencies

Use `dependencies` field when inference cannot determine relationships (dynamic imports, string-based loading):

```python
# src/myapp/plugins/BUILD
python_sources(
    name="lib",
    dependencies=[
        "//src/myapp/plugins/loaders:plugin_registry",
        # Inference cannot detect plugin.load(name) calls
    ],
)
```

### Ignoring Dependencies

Exclude inference for test-only or temporary imports:

```python
# src/myapp/BUILD
python_tests(
    name="tests",
    dependencies=["//src/myapp/mocks:fixtures"],
    # Inference still applies to non-excluded imports
)
```

## Remote Caching Setup

### BuildBuddy Integration

BuildBuddy provides free remote caching for GitHub Actions:

```toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "grpcs://remote.buildbuddy.io"
remote_store_headers = { "Authorization" = "Bearer ${BUILDBUDDY_TOKEN}" }
remote_execution_address = "grpcs://remote.buildbuddy.io"
```

GitHub Actions configuration:

```yaml
- name: Run tests with BuildBuddy cache
  run: |
    pants --changed-since=origin/main test
  env:
    BUILDBUDDY_TOKEN: ${{ secrets.BUILDBUDDY_TOKEN }}
```

### EngFlow Setup

EngFlow offers enterprise remote execution:

```toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "grpcs://api.engflow.com"
remote_store_headers = {
    "Authorization" = "Bearer ${ENGFLOW_TOKEN}",
    "x-engflow-client-id" = "${ENGFLOW_CLIENT_ID}",
}
remote_execution_address = "grpcs://api.engflow.com"
```

### Depot Setup

Depot specializes in fast remote execution:

```toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "grpcs://cache.depot.dev"
remote_store_headers = { "Authorization" = "Bearer ${DEPOT_TOKEN}" }
remote_execution_address = "grpcs://execution.depot.dev"
```

GitHub Actions integration:

```yaml
- name: Authenticate with Depot
  run: depot auth token ${{ secrets.DEPOT_TOKEN }}

- name: Test with remote execution
  run: pants --changed-since=origin/main test
```

### GitHub Actions Cache Backend

For teams without remote execution infrastructure, use GitHub's built-in cache:

```toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "file:///tmp/pants-cache"
```

```yaml
- uses: actions/cache@v3
  with:
    path: .pants/cache
    key: pants-${{ hashFiles('pants.lock') }}
    restore-keys: pants-
```

## CI Integration

### Changed-Since Detection

The `--changed-since` flag identifies affected files since a reference point:

```bash
# Test only changed packages and their dependents
pants --changed-since=origin/main --changed-dependents=transitive test

# Format changed files
pants --changed-since=HEAD~1 fmt

# Lint changed files
pants --changed-since=HEAD fmt --check
```

### GitHub Actions Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for --changed-since

      - uses: pantsbuild/actions/init@main
        with:
          cache-setup: true  # Use .pants/cache

      - name: Test changed packages
        run: |
          pants \
            --changed-since=origin/main \
            --changed-dependents=transitive \
            test

      - name: Lint all code
        run: pants lint
```

### Dependency Graph Visualization

Export and analyze the dependency graph:

```bash
# Generate transitive dependencies for a target
pants peek //src/myapp:lib --no-verify

# Query for all dependents of a target
pants peek //src/myapp/core:lib --dependents

# Export full graph as JSON
pants export-codegen --json
```

## Docker Integration

### Multi-Stage Docker Builds

```dockerfile
# Dockerfile using Pants-generated PEX
FROM python:3.12-slim as builder
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y git
RUN pants package //apps/api:pex

FROM python:3.12-slim
COPY --from=builder /app/dist/apps/api.pex /app/api.pex
ENTRYPOINT ["/app/api.pex"]
```

Build the PEX:

```bash
pants package //apps/api:pex
```

### Docker Image Targets

Define Docker images directly in BUILD files:

```python
# apps/api/BUILD
pex_binary(
    name="pex",
    entry_point="server.py",
    dependencies=[":lib"],
)

docker_image(
    name="image",
    image_tags=["api:latest", f"api:{tag}"],
    dependencies=[":pex"],
    env={
        "PYTHONUNBUFFERED": "1",
    },
)
```

Build and push:

```bash
pants build //apps/api:image
docker load < dist/apps/api.tar
docker push api:latest
```

### Registries and Authentication

Configure registry access in `pants.toml`:

```toml
[docker]
registries = [
    "docker.io",
    "ghcr.io",
    "registry.internal.company.com",
]
```

Use credentials via environment:

```bash
export DOCKER_CONFIG=/path/to/.docker
pants build //apps/api:image
```

## Migration from pip/uv

### Phase 1: Establish Infrastructure

1. Create `pants.toml` with Python backend
2. Create `3rdparty/python/requirements.txt` from existing dependencies
3. Run `pants tailor ::` to auto-generate initial BUILD files
4. Verify structure: `pants peek //...`

```bash
# Bootstrap Pants
mkdir 3rdparty/python
cp requirements.txt 3rdparty/python/

# Generate BUILD files
pants tailor ::

# Verify the setup
pants lint
```

### Phase 2: Low-Risk Testing

Start with linting and formatting (no execution risk):

```bash
# Format all code
pants fmt ::

# Lint all code
pants lint ::

# Type-check with mypy
pants check ::
```

### Phase 3: Add Testing

Enable pytest execution:

```toml
[GLOBAL]
backend_packages = [
    "pants.backend.python",
    "pants.backend.python.test.pytest",
    "pants.backend.python.lint.black",
]
```

```bash
# Run all tests
pants test ::

# Run specific test suite
pants test src/myapp::
```

### Phase 4: Packaging and Deployment

```bash
# Build PEX binaries
pants package //apps/api:pex

# Create Docker images
pants build //apps/api:image

# Build Python distributions
pants package //packages/core:
```

### uv Workspace to Pants Migration

If migrating from uv workspaces:

1. Keep existing `pyproject.toml` in each package
2. Create `3rdparty/python/requirements.txt` from lockfile
3. Enable multiple resolves if using different dependency sets
4. Adjust `pants.toml` to reference the requirements

```bash
# Extract requirements from pyproject.toml
uv export --output-file 3rdparty/python/requirements.txt

# Generate Pants BUILD files
pants tailor ::
```

## Common Commands

### Discovery

```bash
# List all targets
pants list ::

# List targets matching pattern
pants list src/myapp::

# Show target definition
pants peek //src/myapp:lib

# Show dependencies
pants peek //src/myapp:lib --dependents
```

### Execution

```bash
# Run tests with timeout
pants test src/myapp:: --timeout=300

# Run specific test function
pants test src/myapp:tests -- -k test_handler

# Run with coverage
pants test :: --pytest-args="--cov=src"

# Run formatters
pants fmt ::

# Run linters
pants lint ::

# Type-check
pants check ::
```

### CI Optimization

```bash
# Test only changed code and dependents
pants --changed-since=origin/main --changed-dependents=transitive test

# Format changed files
pants --changed-since=HEAD fmt

# Export dependency graph
pants peek --include-description //...
```

### Build and Package

```bash
# Build all targets
pants build ::

# Package specific binary
pants package //apps/api:pex

# Generate Python distributions
pants package //packages/core:

# Build Docker image
pants build //apps/api:image
```

## Troubleshooting

### Dependency Inference Issues

**Problem**: "No targets found" error
```
Solution: Verify __init__.py exists in package directories
         Run `pants tailor ::` to regenerate BUILD files
         Check pants.toml [source] root_patterns
```

**Problem**: "Unused dependency" warnings
```
Solution: Remove from BUILD dependencies field
         Or suppress with `pants lint --skip=python-unresolved-imports`
```

**Problem**: Circular dependencies detected
```
Solution: Review import structure
         Use `pants peek --dependents` to visualize
         Refactor to break cycles
```

### Remote Caching Issues

**Problem**: Cache not being used
```
Solution: Verify remote_store_address is correct
         Check BUILDBUDDY_TOKEN/DEPOT_TOKEN env vars
         Run with --no-remote to verify local functionality
         Check network connectivity: pants --debug
```

**Problem**: Authentication failed
```
Solution: Regenerate tokens in BuildBuddy/EngFlow/Depot
         Verify remote_store_headers syntax
         Ensure token environment variables are exported
```

### CI Performance

**Problem**: Full test suite running despite --changed-since
```
Solution: Verify --changed-dependents=transitive is set
         Check CI checkout uses fetch-depth: 0
         Confirm origin/main ref exists in shallow clone
         Use pants peek to debug graph
```

**Problem**: Tests timing out
```
Solution: Increase timeout in pytest config
         Use --timeout-default flag
         Check for hanging network I/O or file operations
         Consider parallel execution with --processes
```

## Advanced Topics

### Custom Backends and Plugins

Extend Pants with custom rule implementations:

```python
# build_rules/custom_rule.py
from pants.engine.rules import rule
from pants.engine.targets import Target

@rule
async def custom_operation(request: CustomRequest) -> CustomResult:
    # Custom build logic
    return CustomResult(...)
```

Register in `pants.toml`:

```toml
[GLOBAL]
backend_packages = [
    "build_rules.custom_rule",
]
```

### Resolves and Dependency Isolation

Use multiple resolves to isolate incompatible dependencies:

```toml
[python.resolves]
python-default = "3rdparty/python/default.lock"
django = "3rdparty/python/django.lock"
pytorch = "3rdparty/python/pytorch.lock"
```

Target assignment:

```python
# src/web/django_app/BUILD
python_sources(
    name="lib",
    resolve="django",
)

# src/ml/models/BUILD
python_sources(
    name="lib",
    resolve="pytorch",
)
```

### Performance Tuning

Configure cache and execution parameters:

```toml
[GLOBAL]
process_cleanup = "always"  # Clean temp files aggressively
speculative_execution = true
speculation_strategy = "processes_remote_first"

[pytest]
# Use nailgun for longer-running tests
execution_mode = "nailgun"
processes = 4
```

## Key Resources

- **Official Documentation**: https://www.pantsbuild.org/stable/docs/python/overview
- **CI Integration**: https://www.pantsbuild.org/stable/docs/using-pants/using-pants-in-ci
- **Community Chat**: https://www.pantsbuild.org/stable/docs/community
- **BUILD file reference**: https://www.pantsbuild.org/stable/reference/targets/all
