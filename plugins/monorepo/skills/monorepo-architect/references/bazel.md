# Bazel Build System Reference

Bazel provides Google-scale capabilities for multi-language monorepos with strict hermeticity guarantees and sophisticated caching. This guide covers setup, configuration, and operational patterns for teams requiring fine-grained control and reproducibility.

## When to Use Bazel

Adopt Bazel when:
- Codebase exceeds 1 million lines of code
- Multi-language monorepo (Python + JavaScript/TypeScript + Go + C++)
- Strict reproducibility and hermeticity requirements
- Remote execution infrastructure already in place
- 100+ developers sharing the repository
- Fine-grained incremental builds essential

Bazel introduces significant complexity. Consider Pants for Python-only monorepos or Nx for JavaScript-focused projects first.

## Core Concepts

### Hermeticity

Bazel enforces hermetic builds: all dependencies are explicit, environment variables are sandboxed, and network access is disabled by default. This ensures builds are reproducible across machines and CI environments.

### Remote Execution

Bazel can offload build execution to remote infrastructure, enabling:
- Distributed builds across machines
- Shared caching of intermediate results
- Consistent execution environment
- Faster CI pipelines

### Module System (Bzlmod)

Modern Bazel uses the Bazel Dependency Module (Bzlmod) system for dependency management. The `MODULE.bazel` file replaces `WORKSPACE` for specifying external dependencies.

## Module.bazel Configuration

### Python Setup with rules_python

```python
# MODULE.bazel
bazel_dep(name = "rules_python", version = "0.31.0")

python = use_extension("@rules_python//python/extensions:python.bzl", "python")
python.toolchain(
    python_version = "3.12",
    is_default = true,
)
python.toolchain(
    python_version = "3.11",
)

pip = use_extension("@rules_python//python/extensions:pip.bzl", "pip")
pip.parse(
    hub_name = "pip",
    python_version = "3.12",
    requirements_lock = "//python:requirements_lock.txt",
)

use_repo(pip, "pip")
```

### JavaScript/TypeScript with rules_js

```python
# MODULE.bazel (continued)
bazel_dep(name = "aspect_rules_js", version = "2.0.0")
bazel_dep(name = "aspect_rules_ts", version = "2.4.0")

npm = use_extension("@aspect_rules_js//npm:extensions.bzl", "npm")
npm.npm_translate_lock(
    name = "npm",
    pnpm_lock = "//:pnpm-lock.yaml",
    verify_node_modules_ignored = "//:.bazelignore",
)

use_repo(npm, "npm")
```

### Mixed Language Setup

Complete MODULE.bazel for polyglot monorepo:

```python
"""Root module for the monorepo."""
module(
    name = "mymonorepo",
    version = "0.1.0",
)

bazel_dep(name = "rules_python", version = "0.31.0")
bazel_dep(name = "aspect_rules_js", version = "2.0.0")
bazel_dep(name = "aspect_rules_ts", version = "2.4.0")
bazel_dep(name = "rules_docker", version = "0.25.0")

# Python toolchain
python = use_extension("@rules_python//python/extensions:python.bzl", "python")
python.toolchain(python_version = "3.12", is_default = true)

# Python dependencies
pip = use_extension("@rules_python//python/extensions:pip.bzl", "pip")
pip.parse(
    hub_name = "pip",
    python_version = "3.12",
    requirements_lock = "//third_party/python:requirements_lock.txt",
)

# JavaScript/Node.js
npm = use_extension("@aspect_rules_js//npm:extensions.bzl", "npm")
npm.npm_translate_lock(
    name = "npm",
    pnpm_lock = "//:pnpm-lock.yaml",
)

use_repo(pip, "pip")
use_repo(npm, "npm")
```

## BUILD File Patterns

### Python Libraries and Binaries

```python
# src/myapp/core/BUILD
load("@rules_python//python:defs.bzl", "py_library", "py_test", "py_binary")

py_library(
    name = "core",
    srcs = ["__init__.py", "logic.py"],
    deps = [
        "//src/myapp/utils:utils",
        "@pip//requests",
    ],
    visibility = ["//src/myapp:__subpackages__"],
)

py_test(
    name = "core_test",
    srcs = ["logic_test.py"],
    deps = [
        ":core",
        "@pip//pytest",
    ],
)

py_binary(
    name = "cli",
    srcs = ["cli.py"],
    main = "cli.py",
    deps = [":core"],
)
```

### Python with Multiple Entry Points

```python
# apps/api/BUILD
load("@rules_python//python:defs.bzl", "py_binary", "py_library")

py_library(
    name = "lib",
    srcs = glob(["*.py"], exclude = ["*.py"]),
    deps = [
        "//src/core:core",
        "@pip//fastapi",
        "@pip//uvicorn",
    ],
)

py_binary(
    name = "api",
    srcs = ["server.py"],
    main = "server.py",
    deps = [":lib"],
)

py_binary(
    name = "worker",
    srcs = ["worker.py"],
    main = "worker.py",
    deps = [":lib"],
)
```

### JavaScript/TypeScript

```python
# apps/web/BUILD
load("@aspect_rules_js//js:defs.bzl", "js_library", "js_run_devserver")
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@npm//:package.json.bzl", npm_link_all_packages = "link_all_packages")

npm_link_all_packages(name = "node_modules")

ts_project(
    name = "lib",
    srcs = glob(["src/**/*.ts", "src/**/*.tsx"]),
    composite = true,
    declaration = True,
    tsconfig = "tsconfig.json",
    deps = [
        ":node_modules",
        ":node_modules/react",
        ":node_modules/react-dom",
    ],
)

js_run_devserver(
    name = "dev",
    data = [":lib"],
    command = "npm run dev",
)
```

### Docker Images

```python
# apps/api/BUILD
load("@rules_docker//go:image.bzl", "go_image")

go_image(
    name = "image",
    base = "@python_base//image",
    binary = ":api",
    visibility = ["//visibility:public"],
)
```

## Dependency Management

### Python Requirements Lock File

Generate lock file with `pip-compile`:

```bash
# third_party/python/requirements.txt
pip-compile --generate-hashes third_party/python/requirements.in

# OUTPUT: third_party/python/requirements_lock.txt
# With hashes for reproducibility
```

Update MODULE.bazel to reference the lock file:

```python
pip = use_extension("@rules_python//python/extensions:pip.bzl", "pip")
pip.parse(
    hub_name = "pip",
    python_version = "3.12",
    requirements_lock = "//third_party/python:requirements_lock.txt",
    extra_pip_args = ["--require-hashes"],
)
```

### Node.js Dependencies with pnpm

Manage JavaScript dependencies via pnpm:

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalog:
  react: ^18.2.0
  typescript: ^5.3.0
```

Translate pnpm-lock to Bazel:

```python
npm = use_extension("@aspect_rules_js//npm:extensions.bzl", "npm")
npm.npm_translate_lock(
    name = "npm",
    pnpm_lock = "//:pnpm-lock.yaml",
    verify_node_modules_ignored = "//:.bazelignore",
)
```

### Workspace Dependencies

Depend on other local packages:

```python
# apps/api/BUILD
py_binary(
    name = "api",
    deps = [
        "//packages/core:core",
        "//packages/models:models",
    ],
)
```

## BUILD File Discovery and Maintenance

### Automatic BUILD File Generation

Use `bazel init` to create initial BUILD files:

```bash
bazel init
# Generates BUILD files in all directories with .py, .js, etc.
```

### Query Language

Understand the dependency graph with Bazel Query:

```bash
# List all Python targets
bazel query "kind(py_library, //...)"

# Find targets depending on a specific library
bazel query "rdeps(//..., //packages/core:core)"

# Find transitive closure
bazel query "deps(//apps/api:api)"

# Filter by attribute
bazel query "attr(visibility, //apps:__pkg__, //...)"

# Complex queries
bazel query "let deps = deps(//packages/core:core) in deps intersect kind(py_test, //...)"
```

## Remote Execution Setup

### gRPC Remote Execution API (REAPI)

Bazel connects to REAPI-compatible services. Configure in `.bazelrc`:

```bash
# .bazelrc
build:remote --remote_executor=grpcs://execution.example.com
build:remote --remote_cache=grpcs://cache.example.com
build:remote --google_default_credentials
build:remote --remote_timeout=3600

# Use remote execution by default
build --config=remote
```

### BuildBuddy Integration

```bash
# .bazelrc
build:buildbuddy --remote_cache=grpcs://remote.buildbuddy.io
build:buildbuddy --remote_header=x-buildbuddy-api-key=YOUR_API_KEY
build:buildbuddy --bes_backend=grpcs://events.buildbuddy.io
build:buildbuddy --bes_header=x-buildbuddy-api-key=YOUR_API_KEY

build --config=buildbuddy
```

### EngFlow Integration

```bash
# .bazelrc
build:engflow --remote_executor=grpcs://api.engflow.com
build:engflow --remote_cache=grpcs://api.engflow.com
build:engflow --google_default_credentials
build:engflow --remote_header=authorization="Bearer ${ENGFLOW_TOKEN}"

build --config=engflow
```

### Local Caching

Configure persistent local cache:

```bash
# .bazelrc
build --disk_cache=~/.cache/bazel-disk-cache
build --repository_cache=~/.cache/bazel-repo-cache
build --action_env=BAZEL_CACHE=/tmp/bazel-cache
```

## Multi-Language Coordination

### Cross-Language Dependencies

Python code consuming JavaScript/TypeScript:

```python
# src/python/processor/BUILD
py_binary(
    name = "processor",
    srcs = ["main.py"],
    data = [
        "//apps/web:build",  # Depend on JS build output
    ],
    env = {
        "WEB_DIR": "$(location //apps/web:build)",
    },
)
```

### Shared Tooling and Utilities

Create shared build macros:

```python
# build_defs/common.bzl
"""Common build definitions."""

def py_app(name, srcs, deps=None, **kwargs):
    """Wrapper for common Python application patterns."""
    native.py_binary(
        name = name,
        srcs = srcs,
        deps = (deps or []) + [
            "//src/core:core",
            "@pip//click",
        ],
        **kwargs
    )

def ts_app(name, srcs, deps=None, **kwargs):
    """Wrapper for common TypeScript application patterns."""
    ts_project(
        name = name,
        srcs = srcs,
        deps = (deps or []) + [":node_modules"],
        **kwargs
    )
```

## CI Integration

### GitHub Actions with Remote Caching

```yaml
name: Build and Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: bazel-contrib/setup-bazel@v0
        with:
          bazelisk-version: latest

      - name: Build all targets
        run: bazel build //...
        env:
          BAZEL_CACHE: ${{ secrets.BAZEL_CACHE_KEY }}

      - name: Run all tests
        run: bazel test //...
```

### Affected Testing with Bazel

Unlike Pants/Turborepo, Bazel requires manual filtering. Use visibility patterns:

```bash
# Test only targets with changed files
bazel test //src/... --test_env=BAZEL_AFFECTED=true

# Test specific package and dependents
bazel test //packages/core/... +//...
```

Or use a shell wrapper script:

```bash
#!/bin/bash
# scripts/test_changed.sh
CHANGED=$(git diff --name-only origin/main)
bazel test $(bazel query "rdeps(//..., set($(for f in $CHANGED; do echo "//$f"; done)))")
```

## Query Language Deep Dive

### Finding Dependencies

```bash
# Direct dependencies
bazel query "deps(//apps/api:api, 1)"

# Transitive dependencies
bazel query "deps(//apps/api:api)"

# Reverse dependencies
bazel query "rdeps(//..., //packages/core:core)"

# Dependencies excluding test targets
bazel query "deps(//..., 1) - kind(.*_test, deps(//...))"
```

### Filter and Set Operations

```bash
# All Python libraries
bazel query "kind(py_library, //...)"

# Python tests only
bazel query "kind(py_test, //...)"

# Intersection: Test files in specific package
bazel query "kind(py_test, //src/myapp/...)"

# Difference: All targets except tests
bazel query "//... - kind(.*_test, //...)"

# Union: Multiple package patterns
bazel query "//src/... + //packages/... - //third_party/..."
```

### Visibility Analysis

```bash
# Targets visible to a specific target
bazel query "//src/myapp/... + visibility(//src/myapp:lib)"

# What can see a specific target
bazel query "rdeps(//..., //packages/core:core, 1)"
```

## Common Commands

### Building and Testing

```bash
# Build all targets
bazel build //...

# Build specific target
bazel build //apps/api:api

# Test all tests
bazel test //...

# Test with output
bazel test //apps/api:api_test --test_output=all

# Test with arguments passed to test
bazel test //src/myapp:tests -- --verbose

# Build with specific config
bazel build //... --config=release
```

### Querying the Graph

```bash
# List all targets
bazel query //...

# Count targets by type
bazel query "kind(py_library, //...)" --output=build

# Export dependency graph as JSON
bazel query --output=graph //... | dot -Tpng > graph.png
```

### Caching and Performance

```bash
# Clean local cache
bazel clean

# Clean with remote cache preservation
bazel clean --nofetch

# Show action cache statistics
bazel info local_action_cache_size

# Profile build performance
bazel build //... --profile=/tmp/profile.json
# Analyze with: bazel analyze-profile /tmp/profile.json
```

### Workspace Management

```bash
# Show workspace information
bazel info

# List workspace roots
bazel info workspace

# Check configuration
bazel info config
```

## Troubleshooting

### Import Resolution Issues

**Problem**: "No module named X" errors
```
Solution: Verify MODULE.bazel includes all dependencies
         Check pip.parse() references correct requirements_lock.txt
         Ensure py_library declares transitive dependencies
         Use bazel query to verify dependency path
```

**Problem**: Circular dependency detected
```
Solution: Review BUILD file dependency declarations
         Use bazel query "rdeps(//..., //target)" to visualize
         Refactor to break circular import chains
         Consider splitting into separate targets
```

### Remote Execution Issues

**Problem**: Remote execution failures
```
Solution: Verify remote executor address is correct
         Check authentication credentials (BAZEL_CACHE_KEY env)
         Confirm hermeticity: builds must not depend on local files
         Use --experimental_remote_downloader for debugging
```

**Problem**: Cache misses despite identical source
```
Solution: Ensure all dependencies are declared (hermetic build)
         Check for timestamp dependencies or absolute paths
         Verify --stamp flag not injecting build-specific data
         Compare action digests: bazel build --subcommands
```

### Build Performance

**Problem**: Slow incremental builds
```
Solution: Enable action caching: bazel build --disk_cache=~/.cache/bazel
         Use remote caching with --remote_cache flag
         Profile with --profile flag
         Reduce transitive dependency scope
```

**Problem**: Large cache taking disk space
```
Solution: Implement cache eviction: bazel clean --expunge
         Configure max size: bazel build --experimental_repository_cache_hardlinks
         Use remote cache instead of local cache
```

## Advanced Topics

### Custom Rules

Write custom build rules:

```python
# build_defs/custom.bzl
def custom_generator(name, src, out):
    """Generate code from input file."""
    native.genrule(
        name = name,
        srcs = [src],
        outs = [out],
        cmd = "python3 generate.py $< > $@",
        tools = ["//tools:generator"],
    )
```

### Aspects for Cross-Cutting Concerns

Apply transformations across the dependency graph:

```python
# build_defs/collect_deps.bzl
def _collect_deps_impl(target, ctx):
    """Aspect to collect all dependencies."""
    transitive_deps = depset()
    for dep in ctx.rule.attr.deps:
        transitive_deps = depset(transitive=[transitive_deps, dep[DefaultInfo].files])
    return [OutputGroupInfo(all_deps = transitive_deps)]

collect_deps = aspect(
    implementation = _collect_deps_impl,
    attr_aspects = ["deps"],
)
```

### Configuration Transitions

Customize build configuration for specific rules:

```python
def _custom_transition(settings, attr):
    return {
        "//command_line_option:cxxopt": ["-O3"],
        "//command_line_option:copt": ["-O3"],
    }

custom_binary = rule(
    implementation = _custom_binary_impl,
    cfg = _custom_transition,
    attrs = {"src": attr.label()},
)
```

## Bazel vs Pants Comparison

| Factor | Bazel | Pants |
|--------|-------|-------|
| Multi-language support | Excellent | Good (Python-focused) |
| Setup complexity | Very high | Moderate |
| Learning curve | Steep | Moderate |
| Dependency inference | Manual BUILD files | Automatic |
| Remote execution | Built-in | Via plugins |
| Reproducibility | Strict hermetic | Very good |
| IDE integration | Limited | Better |
| Community size | Large | Growing |
| Maturity | Very mature | Stable |

## Key Resources

- **Official Documentation**: https://bazel.build/
- **Python Rules**: https://rules-python.readthedocs.io
- **JavaScript Rules**: https://github.com/aspect-build/rules_js
- **Query Language**: https://bazel.build/query/quickstart
- **Remote Execution**: https://bazel.build/remote/caching
- **BuildBuddy Integration**: https://www.buildbuddy.io/
- **EngFlow**: https://www.engflow.com/
