# Monorepo Plugin

Comprehensive guidance for monorepo architecture—from decision support to migration to implementation.

## Skills

| Skill | Purpose | Triggers |
|-------|---------|----------|
| **monorepo-architect** | Decisions, analysis, initial setup | "should I use monorepo", "which build system", "Pants vs Nx" |
| **monorepo-migration** | Polyrepo → monorepo, stage upgrades | "migrate to monorepo", "upgrade to Pants" |
| **monorepo-python** | Python with uv/Pants | "Python monorepo", "uv workspace", "Pants" |
| **monorepo-typescript** | TypeScript with pnpm/Nx/Turborepo | "TypeScript monorepo", "pnpm workspace", "Nx" |

## Progressive Complexity Model

```
Stage 1: uv/pnpm workspaces    → <10 packages, CI <5min
Stage 2: + Turborepo/Nx        → <20 packages, CI <10min
Stage 3: Pants/Bazel           → >20 packages, CI >10min, file-level tracking
```

**When to graduate**: CI >30min, 50+ developers, or file-level dependency tracking essential.

## Coverage

| Category | Tools |
|----------|-------|
| Python | uv workspaces, Pants, Bazel |
| TypeScript | pnpm, Turborepo, Nx, Bazel |
| Topics | Docker optimization, CI/CD, remote caching, affected-only testing, migrations |

## Core Principles

1. **Atomic commits** — Cross-package changes land together
2. **Single version policy** — One version per external dependency
3. **Trunk-based development** — Short-lived branches, feature flags
4. **Affected-only testing** — Don't run full suite every commit

## Installation

```bash
# From hibariba-plugins marketplace
claude --plugin-dir ./plugins/monorepo

# Or with absolute path
claude --plugin-dir /Users/me/Developer/projects/plugins/plugins/monorepo
```

## Usage Examples

### Architecture Decisions
- "Should I use a monorepo?"
- "Pants vs Nx for Python + TypeScript?"
- "Analyze my repository structure"

### Migration
- "How do I migrate from polyrepo to monorepo?"
- "Upgrade from uv to Pants"
- "Combine these repositories"

### Implementation
- "Set up uv workspace"
- "Configure Turborepo caching"
- "Add new package to Nx workspace"

## Attribution

Advanced uv content adapted from [uv-advanced skill](https://github.com/cuba6112/researchagent/tree/master/.claude/skills/uv-advanced) by cuba6112.
