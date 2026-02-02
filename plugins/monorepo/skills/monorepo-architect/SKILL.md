---
name: monorepo-architect
description: Monorepo architecture decisions, analysis, and initial setup. Use for "should I use a monorepo", "monorepo vs polyrepo", "which build system", "Pants vs Bazel vs Nx", "analyze my repository structure", "evaluate monorepo tooling", "set up new monorepo", "monorepo architecture planning", "CI optimization strategy", or "build system selection".
---

# Monorepo Architecture & Decision Support

Guide decisions about monorepo adoption, tool selection, and initial setup through systematic analysis.

## Quick Navigation

- **Decision Framework** → [references/decision-framework.md](references/decision-framework.md)
- **Repository Analysis** → [references/analysis.md](references/analysis.md)
- **Tool Comparison** → [references/tool-comparison.md](references/tool-comparison.md)
- **Management Principles** → [references/principles.md](references/principles.md)

## Core Decision: Monorepo vs Polyrepo

### Use Monorepo When

All conditions are true:
1. **Frequent cross-package changes** (>30% of PRs span packages)
2. **Shared deployment cycles** (services release together)
3. **Code reuse across teams** (shared libraries, common deps)
4. **Team size justifies coordination** (20+ devs OR complex deps)

### Use Polyrepo When

Any condition applies:
1. **Independent deployment** (each service releases alone)
2. **Distinct tech stacks** (Python, Go, Rust with no shared code)
3. **Team autonomy priority** (full-stack ownership per team)
4. **Small team** (<10 devs, <5 packages)
5. **Regulatory isolation** (separate repos for compliance)

### Decision Matrix

| Factor | Monorepo | Polyrepo |
|--------|----------|----------|
| Cross-package changes | >30% | <10% |
| Teams | 20+ | <10 |
| Packages | 10+ | <10 |
| Shared code | High | Low |
| Tech stack variance | Low | High |

## Tool Selection Framework

### Progressive Complexity Model

```
Stage 1: uv/pnpm workspaces  → <10 packages, CI <5min
Stage 2: + Turborepo/Nx      → <20 packages, CI <10min
Stage 3: Pants/Bazel         → >20 packages, CI >10min, file-level tracking
```

**Migrate when pain emerges, not before.**

### By Primary Language

**Python-only:**
| Scale | Tool | Rationale |
|-------|------|-----------|
| 1-20 packages | uv workspaces | Single lockfile, minimal config |
| 20-50 packages | uv + Turborepo | Affected-only testing |
| 50+ packages | Pants | File-level deps, automatic inference |

**TypeScript-only:**
| Scale | Tool | Rationale |
|-------|------|-----------|
| 1-20 packages | pnpm workspaces | Hard-linked node_modules |
| 20-50 packages | Turborepo | Minimal config, Vercel cache |
| 50+ packages | Nx | Generators, migrations, graph |

**Python + TypeScript:**
| Setup | Tool | Notes |
|-------|------|-------|
| Separate CI | pnpm + uv | Two toolchains, script coordination |
| Unified CI | Pants | Single cache, single graph |
| Enterprise | Bazel | Strict hermeticity, steep curve |

### Tool Comparison Summary

| Factor | uv | Pants | Nx | Turborepo | Bazel |
|--------|-----|-------|-----|-----------|-------|
| Setup time | 1 hour | 1-2 days | 1 day | 2 hours | 1-2 weeks |
| Learning curve | Easy | Moderate | Moderate | Gentle | Steep |
| Dependency inference | No | Yes | Yes | No | No |
| File-level tracking | No | Yes | No | No | Yes |
| Remote caching | No | Yes | Yes | Yes | Yes |
| Multi-language | No | Yes | Limited | Limited | Yes |

## Analysis Workflow

When evaluating an existing codebase:

### 1. Measure Current State

```bash
# Repository size
du -sh . && du -sh .git/

# Package count
find . -name "pyproject.toml" -o -name "package.json" | wc -l

# Language distribution
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) | \
  sed 's/.*\.//' | sort | uniq -c | sort -rn

# CI time (from CI system logs)
# Dependency overlap (shared packages across services)
```

### 2. Identify Pain Points

**Polyrepo dysfunction signals:**
- Version skew ("works locally, fails CI")
- Diamond dependencies
- Non-atomic cross-repo changes
- Duplicate CI configuration

**Monorepo overhead signals:**
- CI timeout on full suite (>45 min)
- Slow workspace sync (>10 min)
- IDE performance issues
- Git history explosion

### 3. Apply Decision Matrix

Read [references/decision-framework.md](references/decision-framework.md) for quantitative scoring.

## Initial Setup Guide

### Stage 1: Python Monorepo (uv)

```bash
# Create workspace structure
mkdir -p monorepo/{libs,services,apps}
cd monorepo

# Root pyproject.toml
cat > pyproject.toml << 'EOF'
[project]
name = "monorepo"
version = "0.0.1"
requires-python = ">=3.11"

[tool.uv.workspace]
members = ["libs/*", "services/*", "apps/*"]
EOF

# Create first package
mkdir -p libs/shared-core/src/shared_core
cat > libs/shared-core/pyproject.toml << 'EOF'
[project]
name = "shared-core"
version = "0.1.0"
dependencies = []
EOF

# Initialize
uv sync
```

### Stage 1: TypeScript Monorepo (pnpm)

```bash
# Create workspace
mkdir -p monorepo/{packages,apps}
cd monorepo

# pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# Root package.json
cat > package.json << 'EOF'
{
  "name": "monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
EOF

pnpm install
```

### Standard Directory Structure

```
monorepo/
├── pyproject.toml          # Python workspace (uv)
├── uv.lock
├── package.json            # TypeScript workspace (pnpm)
├── pnpm-workspace.yaml
├── libs/                   # Shared libraries
│   ├── shared-py/
│   └── shared-ts/
├── services/               # Backend services
│   └── api/
└── apps/                   # Frontend applications
    └── web/
```

## Key Principles

Regardless of tooling:

1. **Atomic commits** — Cross-package changes land together
2. **Single version policy** — One version per external dependency
3. **Trunk-based development** — Short-lived branches, feature flags
4. **Code ownership** — CODEOWNERS with team granularity
5. **Affected-only testing** — Don't run full suite every commit
6. **Consistent naming** — `@company/package-name` convention, kebab-case directories
7. **Dependency constraints** — Use Nx tags or Pants visibility rules to enforce boundaries
8. **Automated updates** — Renovate or Dependabot for external dependency PRs

See [references/principles.md](references/principles.md) for implementation details.

## Migration Triggers

**Stage 1 → Stage 2** (add Turborepo/Nx):
- CI time exceeds 10-15 minutes
- Need affected-only testing
- Remote caching would help team

**Stage 2 → Stage 3** (adopt Pants/Bazel):
- CI still slow (>30 min) despite caching
- Need file-level dependency tracking
- Multi-language coordination required
- Team size >50 developers

**When NOT to migrate:**
- Pain is manageable
- Team lacks bandwidth for learning curve
- No designated champion engineer

## Anti-Patterns

| Pattern | Problem | Solution |
|---------|---------|----------|
| Monolith without boundaries | No clear ownership | Enforce package structure |
| No tooling investment | Developer frustration | Budget for build infrastructure |
| Full test suite every commit | CI bottleneck | Affected-only testing |
| Premature optimization | Complexity without benefit | Start simple, measure pain |

## Further Reading

- [references/decision-framework.md](references/decision-framework.md) — Quantitative scoring, cost-benefit analysis
- [references/analysis.md](references/analysis.md) — Repository metrics, pain point identification
- [references/tool-comparison.md](references/tool-comparison.md) — Detailed framework comparison
- [references/principles.md](references/principles.md) — Atomic commits, trunk-based dev, CODEOWNERS
