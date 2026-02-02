# Monorepo Analysis Framework

A systematic approach to evaluating existing monorepos and polyrepos to inform architectural decisions.

## Repository Metrics

Quantify baseline characteristics before migration or tool selection.

### Size Metrics

- **Total disk footprint**: `du -sh .` (includes .git history)
- **Git history**: `du -sh .git/`
- **Source code**: `find . -type f -name "*.py" -o -name "*.ts" -o -name "*.js" | wc -l`
- **Number of packages**: Count directories matching workspace patterns
- **Average files per package**: Total files / number of packages
- **Dependency density**: (Total dependencies) / (Number of packages)

**Example**: A polyrepo with 15 microservices spanning 250GB (100GB .git) with 45,000 Python files across 15,000 dependencies indicates high migration complexity.

### Language Distribution

```bash
# Quick language census
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.go" \) | \
  sed 's/.*\.//' | sort | uniq -c | sort -rn
```

Monorepos containing multiple languages (Python + TypeScript + Go) require polyglot-capable build systems like **Pants** or **Bazel**, not simple workspace managers.

### Dependency Analysis

```bash
# Find all direct external dependencies
find . -name "requirements.txt" -o -name "pyproject.toml" -o -name "package.json" | \
  xargs grep -h "^[a-z]" | sort | uniq -c | sort -rn

# Identify dependency overlap
# High overlap suggests monorepo consolidation would reduce maintenance burden
```

---

## CI/CD Performance Analysis

Slow builds are the primary pain point driving monorepo tool adoption. Measure baseline performance before optimization.

### Build and Test Metrics

**Collect from CI system** (GitHub Actions, GitLab CI, etc.):

- Full test suite time: `T_full` (seconds to run all tests)
- Average affected-only test time: `T_affected` (when running tests on changed packages)
- Build artifact size: `du -sh dist/ build/`
- Number of test files: `find . -name "*_test.py" -o -name "*.spec.ts" | wc -l`
- Average test duration: `T_full / test_count`

**Red flags indicating need for optimization**:

- Full test suite > 30 minutes
- No affected-only testing (full suite runs on every PR)
- Duplicate test runs across dependent packages
- Artifact caching disabled or ineffective

### Dependency Graph Insights

```bash
# For Nx/Turbo-compatible projects
nx graph --file=deps.json
cat deps.json | jq '.dependencies | length'

# For Pants projects
pants tailor :: --check
pants --changed-since=HEAD~1 test  # Compare time vs full suite
```

**Metrics to extract**:

- Number of independent dependency chains (chain_count)
- Maximum chain depth (longest_path)
- Parallelization ratio: `T_full / T_affected` (ideal: close to chain_depth)

**Example analysis**:

```
- 120 packages total
- Full test suite: 45 minutes
- Affected-only (1 file changed): 8 minutes
- Parallelization ratio: 5.6x
- Interpretation: Maximum chain depth ~6, suggesting CI can run ~20 packages in parallel
- Opportunity: Remote caching could reduce 45m to 20m with warm cache
```

---

## Team Workflow Assessment

Tool effectiveness depends on team size, geographic distribution, and development patterns.

### Developer Velocity Signals

**Interview-based assessment**:

1. How often do cross-package changes occur? (weekly, monthly, quarterly)
   - Frequent = monorepo beneficial
   - Rare = polyrepo acceptable

2. How many developers regularly touch multiple packages?
   - >50% = monorepo recommended
   - <20% = polyrepo adequate

3. What percentage of PRs require coordinated changes across packages?
   - >30% = monorepo essential
   - <10% = polyrepo sufficient

4. Time spent managing dependency version conflicts?
   - >5% of sprint = pain point requiring monorepo

### Team Size Maturity

| Team Size | Recommended Approach | Tooling |
|-----------|---------------------|---------|
| 1-5 developers | Tight coupling acceptable | uv workspaces or pip |
| 5-20 developers | Light coordination needed | uv + basic CI/CD |
| 20-50 developers | Affected-only testing critical | Nx or Turborepo |
| 50-150 developers | Remote caching essential | Pants |
| 150+ developers | File-level granularity required | Bazel |

**Geographic distribution** multiplies complexity:
- Same timezone: Synchronous monorepo updates feasible
- Global: Async CI/CD with remote caching (Pants remote execution, Nx Cloud)

---

## Pain Point Identification

### Symptoms of Polyrepo Dysfunction

**Version skew**: "Works on my machine but CI failed"
- Caused by inconsistent lock files across repositories
- Solution: Monorepo with single lock file (uv.lock, pnpm-lock.yaml)

**Dependency hell**: Diamond dependencies, incompatible transitive requirements
- Caused by separate dependency resolution per service
- Solution: Single version policy, central dependency management

**Broken atomicity**: Cross-package changes land in multiple commits
- Caused by independent CI/CD pipelines
- Solution: Atomic commits with coordinated tests

**Slow local development**: Running tests requires running all upstream packages first
- Caused by lack of workspace support
- Solution: Workspace tools with editable installations

**Duplicate CI logic**: Same linting, testing, building rules reimplemented per repository
- Caused by repo-local configuration
- Solution: Centralized tooling (Pants, Bazel, Nx)

### Symptoms of Monorepo Overhead

**CI timeout on full test suite**: Changes to root dependencies require testing everything
- Indicator: Full suite > 45 minutes
- Solution: Affected-only testing with correct dependency tracking
- Tool upgrade: uv → Nx/Turborepo → Pants

**Slow workspace sync**: `uv sync` takes >10 minutes with many packages
- Caused by: Excessive dependencies, poor structure
- Solutions: Dependency audit, package split validation

**IDE performance**: Language server thrashes with thousands of packages
- Caused by: Misconfigured paths or excessive projects
- Solution: Workspace exclusions, IDE tuning

**Git history explosion**: .git folder grows faster than source code
- Caused by: Large binary artifacts committed
- Solution: Git LFS for assets, build artifacts in .gitignore

---

## Tooling Audit

### Existing Tool Capabilities Matrix

| Capability | uv | Pants | Nx | Bazel | pnpm | Turborepo |
|-----------|----|----|-----|-----|------|-----------|
| Single lockfile | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Dependency inference | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Affected-only testing | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Remote caching | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ |
| Multi-language | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Learning curve | Easy | Moderate | Moderate | Steep | Easy | Easy |

### Current Workflow Barriers

**For Python projects**:

```bash
# Test current workflow time
time pytest -xvs tests/

# Identify non-deterministic test failures (CI-only issues)
for i in {1..3}; do pytest tests/ --tb=no -q; done

# Check dependency resolution conflicts
pip-audit
pipdeptree | grep -E "CONFLICT|ERROR"
```

**For TypeScript projects**:

```bash
# Measure package install time
time npm install
time pnpm install  # Compare to npm

# Test build parallelization
time npm run build  # Single-threaded
time nx affected --target=build  # With graph awareness

# Check for circular dependencies
nx lint
```

### Configuration Drift Assessment

```bash
# Find configuration inconsistencies
find . -name "pyproject.toml" -exec md5sum {} \; | sort | uniq -c | sort -rn
find . -name "tsconfig.json" -exec diff {} \; | wc -l

# Higher counts indicate more maintenance burden
```

---

## Recommendation Framework

### Decision Matrix

| Current State | Pain Level | Recommended Action |
|---------------|------------|-------------------|
| Polyrepo, <20 devs, no CI issues | Low | Stay polyrepo, use dependency management tools (Renovate) |
| Polyrepo, frequent cross-package changes | High | Migrate to monorepo with uv or pnpm |
| uv monorepo, CI times 15-30 min | Medium | Add Turborepo or Nx for affected testing |
| uv monorepo, CI times >45 min | High | Migrate to Pants |
| Pants, multi-language, >50 devs | Medium | Consider Bazel if remote execution bottleneck |
| Pants, Python-only, <50 devs | Low | Stay with Pants, optimize cache |

### Migration Readiness Checklist

Before migrating to a new tool or structure:

- [ ] Full backup of git history (push to secondary remote)
- [ ] Documented baseline metrics (CI time, build size, test count)
- [ ] Team consensus on new tool (demonstrated in sandbox)
- [ ] CI/CD configuration ready (test on feature branch first)
- [ ] Documentation plan (wiki, video walkthrough)
- [ ] Rollback procedure documented and tested
- [ ] Dependency audit completed (no circular dependencies)
- [ ] IDE/editor configuration validated

### Cost-Benefit Analysis Template

```
Tool: [Pants | Nx | Bazel | Turborepo]

Benefits:
- CI time reduction: [X]m → [Y]m (save [Z]% = [cost/month])
- Developer productivity: [specific pain point solved]
- Operational overhead: [infrastructure required]
- Learning curve: [hours per developer]

Costs:
- Migration effort: [developer-weeks]
- Infrastructure: [storage, server costs]
- Maintenance: [ongoing overhead]
- Opportunity cost: [feature velocity impact]

ROI Timeline:
- Break-even: [months]
- 12-month savings: $[amount]
```

**Example**:

```
Tool: Pants (from uv)

Benefits:
- CI time: 45m → 15m (66% reduction = $8k/month in CI costs)
- Developer feedback loop: 3min → 30s (remote execution)
- No more manual dependency management

Costs:
- Migration: 4 developer-weeks
- Infrastructure: Depot remote cache (~$500/month)
- Maintenance: 10% of build engineer time

ROI: Break-even at 2.5 months, $90k annual savings
```

---

## Execution Roadmap

### Phase 1: Data Collection (Week 1)

- Run metric collection scripts across all repositories
- Interview team leads on pain points
- Measure baseline CI/CD performance
- Document current dependency structure

### Phase 2: Analysis (Week 2)

- Create repository heatmaps (high-touch packages)
- Model CI improvement with proposed tools
- Estimate migration effort
- Present findings to stakeholders

### Phase 3: Pilot (Weeks 3-4)

- Select one high-pain repository
- Execute pilot migration on feature branch
- Measure pilot metrics (CI time, developer experience)
- Iterate based on feedback

### Phase 4: Rollout (Weeks 5-8)

- Migrate remaining repositories (batched by team)
- Provide training and documentation
- Monitor metrics and adjust tooling as needed
- Plan next-phase optimization

