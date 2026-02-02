# Monorepo Decision Framework

Structured decision-making for choosing between monorepo and polyrepo, selecting tooling, and determining upgrade timing.

## When to Use Monorepo vs Polyrepo

### Use Monorepo When

All of the following conditions are true:

1. **Frequent cross-package changes** (>30% of PRs span multiple packages)
   - Refactoring shared abstractions
   - Coordinated API changes
   - Shared dependency upgrades

2. **Shared deployment cycles**
   - Services released together or in strict sequence
   - Atomic coordination required
   - Example: API change with coordinated client updates

3. **Code reuse across teams**
   - Teams maintain libraries used by many consumers
   - High synchronization cost across repos
   - Example: shared-auth library used by 5+ services

4. **Team size justifies coordination overhead**
   - 20+ developers OR
   - 10+ developers working cross-team OR
   - Complex dependency graphs (>15 packages)

5. **Consistent tooling and standards beneficial**
   - Language consistency (all Python, or Python + TypeScript)
   - Testing framework standardization reduces CI complexity
   - Shared deployment infrastructure

### Use Polyrepo When

Any of these conditions apply:

1. **Independent deployment cycles**
   - Each service releases independently
   - No cross-service coordination needed
   - Example: separate API, worker, and web services with independent release schedules

2. **Distinct technology stacks**
   - Service A: Python + FastAPI
   - Service B: Go + gRPC
   - Service C: Rust + Actix
   - Monorepo tooling complexity not justified

3. **Team autonomy important**
   - Teams own full stack (code, infra, deployment)
   - Minimal shared code
   - Example: multi-tenant SaaS where each tenant has dedicated infra

4. **Small team**
   - <10 developers
   - <5 packages
   - Self-contained projects

5. **Regulatory or organizational isolation required**
   - Separate repositories for audit/compliance
   - Different access controls per repo
   - Example: healthcare app with HIPAA-regulated components

### Decision Matrix

| Factor | Monorepo | Polyrepo |
|--------|----------|----------|
| Cross-package changes | >30% | <10% |
| Teams | 20+ | <10 |
| Packages | 10+ | <10 |
| Shared code | High | Low |
| Deployment coupling | High | Low |
| Tech stack variance | Low | High |
| Setup complexity | Moderate | Low |
| Scaling pain | Later (50+ devs) | Earlier (15+ devs) |

### Scoring Decision (Quantitative)

```python
def should_use_monorepo():
    """
    Score from 0-10 (higher = more suitable for monorepo)
    """
    score = 0

    # Cross-package changes (0-3 points)
    cross_pkg_pct = measure_cross_package_prs()
    if cross_pkg_pct > 50:
        score += 3
    elif cross_pkg_pct > 30:
        score += 2
    elif cross_pkg_pct > 10:
        score += 1

    # Team size (0-2 points)
    team_size = count_developers()
    if team_size > 50:
        score += 2
    elif team_size > 20:
        score += 1.5
    elif team_size > 10:
        score += 1

    # Package count (0-2 points)
    pkg_count = count_packages()
    if pkg_count > 50:
        score += 2
    elif pkg_count > 20:
        score += 1.5
    elif pkg_count > 10:
        score += 1

    # Code sharing (0-2 points)
    # Measure: how many shared packages, how many teams depend on each
    sharing_degree = measure_dependency_density()
    if sharing_degree > 0.7:  # High sharing
        score += 2
    elif sharing_degree > 0.4:
        score += 1

    # Deployment coupling (0-1 point)
    atomic_deploys = pct_coordinated_releases()
    if atomic_deploys > 0.3:
        score += 1

    # Recommendation
    if score >= 7:
        return "STRONG monorepo"
    elif score >= 5:
        return "MODERATE monorepo (can go either way)"
    elif score >= 3:
        return "WEAK monorepo (polyrepo probably better)"
    else:
        return "STRONG polyrepo"
```

---

## Choosing Stage and Framework

### Framework Selection by Language

#### Python-Only Monorepo

| Scale | Framework | Rationale |
|-------|-----------|-----------|
| 1-20 packages, <30 min CI | **uv workspaces** | Minimal setup, single lockfile, Cargo-inspired |
| 20-50 packages, 30-60 min CI | **uv + Turborepo** | Affected-only testing, ~70% CI reduction |
| 50+ packages, multi-lang | **Pants** | File-level deps, Python-native, fast remote cache |
| 100+ packages, very large | **Pants or Bazel** | Bazel if strict hermetic requirements |

**Quick recommendation**:

```python
if team_size < 30 and ci_time < 20:
    framework = "uv"
elif ci_time < 45 and no_multiple_languages:
    framework = "uv + Turborepo"
elif team_size > 50 or "TypeScript" in languages:
    framework = "Pants"
else:
    framework = "uv + Turborepo"  # Safe default
```

#### Python + TypeScript Polyglot

| Setup | Framework | Notes |
|-------|-----------|-------|
| Independent test suites (separate CI) | **pnpm + Turborepo + uv** | Two separate tool chains; sync via scripts |
| Unified CI/CD | **Pants** | Handles both languages, single cache, single graph |
| Enterprise with unlimited budget | **Bazel** | Strict hermeticity, multi-language, steep curve |

**Approach**: Python and JavaScript workflows are fundamentally different.

```bash
# pnpm for Node packages
pnpm install && pnpm build && pnpm test

# uv for Python packages
uv sync && uv run pytest packages/

# Coordinate with root Makefile or just script
```

#### Python + Go + Other Languages

**Must use Pants or Bazel**.

- Pants supports Python + Go (Go support in beta)
- Bazel supports all languages (learning curve)
- Separate tool chains become unmaintainable with 3+ languages

---

## When to Migrate Between Stages

### Migration Trigger Conditions

**Stage 1 → Stage 2** (uv → Turborepo/Nx):

```bash
# Trigger metric: CI time exceeded 30 minutes with affected-only testing needed

# Check:
time pytest packages/ -v  # Measures total
time pytest packages/$(git diff --name-only origin/main | head -1) -v  # Affected

# If total > 30 min AND (total / affected) > 3, consider Stage 2
```

**Stage 2 → Stage 3** (Turborepo/Nx → Pants):

```bash
# Trigger metrics:
# 1. CI still slow (> 30 min even with Turborepo/Nx)
ci_time = 45  # minutes
remote_cache_hit_rate = 0.6  # 60% hit rate (good for Stage 2)

if ci_time > 30 and team_size > 50:
    # Problem: Even with caching, still slow
    # Solution: File-level tracking (Pants)
    recommend_migration = True

# 2. Multi-language monorepo
if "Python" in languages and "TypeScript" in languages and "Go" in languages:
    # Pants/Bazel better than separate pipelines
    recommend_migration = True

# 3. Build system complexity
if num_packages > 100:
    # Manual dependency tracking error-prone
    # Need automatic dependency inference
    recommend_migration = True
```

**Stage 3 → Bazel**:

Almost never justified. Bazel only for:
- Monorepos > 100 million lines
- Strict hermeticity requirements (reproducible builds)
- Google-scale infrastructure

---

## Cost-Benefit Analysis Template

Use this framework to evaluate any tool migration decision.

### Template

```
# Migration Decision: [Tool/Stage Change]

## Current State
- CI time: [X] minutes
- Team size: [N] developers
- Package count: [M]
- Main pain point: [description]

## Proposed Solution
- Tool/framework: [name]
- Expected impact:
  - CI reduction: [X]m → [Y]m
  - Developer productivity gain: [description]
  - Cost: [infrastructure costs]

## Cost Breakdown

### One-Time Costs
- Migration effort: [D] developer-days
  - Cost: [D] × [hourly_rate]
- Infrastructure setup: $[amount]
- Training: [hours × developers × hourly_rate]
- Total one-time: $[amount]

### Ongoing Costs
- Infrastructure: $[monthly]
- Maintenance: [hours/month × hourly_rate]
- Learning curve drag: [weeks × team_productivity_loss]
- Total annual: $[amount]

## Benefit Breakdown

### Time Savings
- CI reduction: [minutes saved per commit]
- Commits per day: [N]
- Days per year: [work_days]
- Hours saved annually: [minutes/60 × N × work_days]
- Cost of hours: [hours × hourly_rate]
- Annual benefit: $[amount]

### Quality Improvements
- Bugs caught earlier: [estimated quantity]
- Estimated cost per bug: $[amount]
- Expected reduction: [percent]
- Annual benefit: $[amount]

## ROI Analysis

| Year | Savings | Costs | Net Benefit |
|------|---------|-------|------------|
| 1 | $[Y1_save] | $[Y1_cost] | $[Y1_net] |
| 2 | $[Y2_save] | $[Y2_cost] | $[Y2_net] |
| 3 | $[Y3_save] | $[Y3_cost] | $[Y3_net] |

- **Break-even**: [months]
- **3-year ROI**: [percent]
- **Payback period**: [months]

## Risk Assessment

### Technical Risks
- [ ] Team skill gap (learning curve)
- [ ] Integration complexity with existing infra
- [ ] Performance uncertainty
- Mitigation: [actions]

### Organizational Risks
- [ ] Team adoption resistance
- [ ] Disruption during migration
- [ ] Dependency on specific engineers
- Mitigation: [actions]

## Recommendation

**[PROCEED / DEFER / REJECT]**

Rationale:
- Primary factor: [factor]
- Secondary factors: [factors]
- Risk tolerance: [acceptable/marginal/high]
```

### Concrete Example: uv → Pants Migration

```
# Migration Decision: uv → Pants

## Current State
- CI time: 45 minutes (all packages)
- Team size: 65 developers (expanding)
- Package count: 52 packages
- Main pain point: Full test suite on every PR (45 min, 150 min/dev/day wasted)

## Proposed Solution
- Tool: Pants with remote caching (Depot)
- Expected impact:
  - CI reduction: 45m → 12m (with warm cache)
  - Developer feedback: 45 min wait → 12 min wait (67% faster)
  - Better dependency tracking: catch integration issues earlier

## Cost Breakdown

### One-Time Costs
- Migration: 3 dev-weeks = 120 hours = $9,000
- Infrastructure (Depot setup): $500
- Training (2-hour session × 65 devs = 130 hours): $9,750
- BUILD file generation + validation: 40 hours = $3,000
- Total one-time: $22,250

### Ongoing Costs
- Depot remote cache: $500/month = $6,000/year
- Pants maintenance (0.5 FTE): $50,000/year
- Learning curve drag (10 devs × 40 hours @ 25% effective): $10,000
- Total annual: $66,000

## Benefit Breakdown

### Time Savings
- CI reduction: 33 minutes per commit saved
- Commits per day: 500 (50 devs × 10 commits/dev)
- Days per year: 240 (work days)
- Hours saved: (33 min / 60) × 500 × 240 = 66,000 hours
- Cost of hours: 66,000 × $150/hr = $9,900,000
  - NOTE: Not all time translates to profit (context-switching, etc.)
  - Realistic multiplier: 30% = $3,000,000 benefit

### Quality Improvements
- Failed CI catches ~2 integration issues/month that would hit production
- Cost per production issue: ~$10,000 (debugging, rollback, customer impact)
- Monthly savings: 2 × $10,000 = $20,000 × 12 = $240,000/year

### Total annual benefits
- Time savings: $3,000,000 (conservative value at 30% multiplier)
- Quality improvements: $240,000
- Developer morale improvement: [hard to quantify but real]
- **Total: ~$3,240,000**

## ROI Analysis

| Year | Savings | Costs | Net Benefit |
|------|---------|-------|------------|
| 1 | $3,240,000 | $88,250 | $3,151,750 |
| 2 | $3,240,000 | $66,000 | $3,174,000 |
| 3 | $3,240,000 | $66,000 | $3,174,000 |

- Break-even: ~10 days (within first month)
- 3-year ROI: 2,500% ← enormous value creation
- Payback period: Days (immediate)

## Risk Assessment

### Technical Risks
- [ ] Build system complexity (Pants learning curve)
- [x] Integration with existing GitHub Actions
- [x] Remote cache infrastructure dependency

Mitigation:
- Assign dedicated build engineer (included in maintenance cost)
- Start with local cache, migrate to Depot gradually
- Backup exit plan: revert to pytest + Turborepo

### Organizational Risks
- [x] Developer adoption (unfamiliar tool)
- [x] Migration disruption during cutover
- [x] Build engineer dependency

Mitigation:
- 2-hour training session with demos
- Migrate one team at a time (1-week staggered rollout)
- Document all common issues + solutions
- Ensure knowledge not concentrated in one engineer

## Recommendation

**PROCEED IMMEDIATELY**

Rationale:
- ROI is massive ($3M+/year) and breaks even immediately
- Technical risk is manageable (Pants is stable, Depot is reliable)
- Team size justifies complexity (65 devs get immediate benefit)
- Pain point is real and current (45-min CI blocks productivity)

Success criteria:
- Pants CI average < 15 minutes within 2 weeks of rollout
- Developer satisfaction survey shows improvement
- Deployment frequency increases (teams can deploy more often)
- No production issues caused by build system changes
```

---

## Team Readiness Assessment

Before migrating to a new framework, assess team capability.

### Readiness Checklist

**Technical Readiness**:

- [ ] Team has one engineer comfortable with proposed tool
- [ ] CI/CD infrastructure can support new system
- [ ] Existing tooling can integrate (linters, formatters, test runners)
- [ ] Version control system supports atomic commits
- [ ] Build artifacts infrastructure supports caching

**Organizational Readiness**:

- [ ] Consensus on problem worth solving (alignment on pain point)
- [ ] Executive sponsorship (time budget approved for migration)
- [ ] Designated champion engineer (will lead migration + become expert)
- [ ] Training plan documented
- [ ] Timeline communicated to teams

**Knowledge Readiness**:

- [ ] Majority of team understands monorepo benefits
- [ ] Team familiar with at least one similar tool
- [ ] Clear documentation/videos of target state
- [ ] Rollback procedure documented and tested

### Readiness Scoring

```python
def assess_team_readiness(tool):
    """Score from 0-100 (higher = better prepared)"""
    score = 0

    # Technical (40 points max)
    if has_designated_champion(tool):
        score += 20
    if ci_infrastructure_adequate():
        score += 10
    if existing_tools_compatible():
        score += 10

    # Organizational (30 points max)
    if consensus_on_problem():
        score += 10
    if executive_sponsorship():
        score += 10
    if timeline_realistic():
        score += 10

    # Knowledge (30 points max)
    if training_material_exists():
        score += 10
    if rollback_plan_documented():
        score += 10
    if majority_team_aligned():
        score += 10

    # Recommendation
    if score >= 85:
        return "GO: Proceed immediately"
    elif score >= 70:
        return "CAUTION: Address gaps before proceeding"
    elif score >= 50:
        return "DELAY: More preparation needed"
    else:
        return "STOP: Not ready for this migration"
```

**Readiness gaps → mitigation**:

| Gap | Mitigation |
|-----|-----------|
| No designated champion | Hire consultant or invest time in training engineer |
| CI infrastructure inadequate | Upgrade infrastructure first (separate project) |
| No rollback plan | Document and test before migration starts |
| Team skeptical | Pilot with one team; demonstrate benefits |
| Executive alignment lacking | Prepare ROI analysis and present to leadership |
| Timeline pressure | Extend timeline; quality > speed for tool adoption |

---

## Migration Timeline Template

Customize based on team size and framework.

### Small Team (10 devs, 10 packages): uv → Pants

```
Week 1: Preparation
- Day 1: Pants training (2 hours)
- Days 2-3: Set up Pants locally, create pants.toml
- Days 4-5: Run pants tailor ::, validate BUILD files
- Risk: BUILD files may need manual tweaking

Week 2-3: Pilot Migration
- Select one package (lowest-risk)
- Convert tests to run via Pants
- Validate output matches pytest
- Document any issues

Week 4: Full Migration
- Convert remaining packages
- Update CI/CD to use Pants
- Remove pytest from CI

Week 5: Stabilization
- Monitor Pants performance
- Fix any edge cases
- Team training follow-ups
```

### Large Team (100 devs, 100+ packages): Turborepo → Pants

```
Month 1: Planning & Preparation
- Week 1: Stakeholder alignment, executive sign-off
- Week 2: Pants training for build team + tech leads
- Week 3: Set up Pants infrastructure (remote cache, CI agents)
- Week 4: Draft migration plan, identify high-risk packages

Month 2-3: Pilot & Learning
- Select 5 packages (one per team)
- Each team migrates their package
- Weekly sync to discuss blockers
- Iterate on process

Month 4: Roll out in Waves
- Wave 1: 20 packages (week 1)
- Wave 2: 30 packages (week 2)
- Wave 3: 30 packages (week 3)
- Wave 4: Final packages (week 4)
- Each wave: 3-4 day stabilization period before next

Month 5: Stabilization & Optimization
- Monitor Pants performance across all packages
- Optimize remote cache hit rate
- Final training sessions
- Documentation updates
- Celebrate wins and team learning
```

---

## Ongoing Decision Reviews

Monorepo tool selection isn't permanent. Periodically assess fit.

### Quarterly Review Process

**Metrics to track**:

```bash
# CI Performance
echo "Average CI time:" && \
  git log --oneline --since="3 months ago" | wc -l  # CI runs

# Developer Satisfaction
# Survey: How satisfied are you with build system? (1-5)

# Build System Errors
# How many build system issues (excluding test failures)?

# Tool Adoption
# What percent of team members feel confident with tool?
```

**Decision points** (quarterly):

1. **CI times increased** → Optimize cache, or consider Stage upgrade
2. **Team expansion** → Reconsider tool complexity vs. team size
3. **Tech stack change** → Multi-language requires Pants/Bazel
4. **Team feedback negative** → Investigate root causes (training? tool fit?)
5. **New competitive tool** → Consider lateral migration

**Example**: "Turborepo → Nx Migration"

If after 6 months on Turborepo, Nx features (generators, advanced graph visualization) become critical, consider migration:

```bash
# Cost: 1-2 days (both JavaScript-based; fairly compatible)
# Benefit: Better IDE integration, generators
# Timeline: Quick pilot, 1 week rollout
# Risk: Low (can revert in hours)
```

---

## Red Flags: When to Reconsider

| Red Flag | Interpretation | Action |
|----------|-----------------|--------|
| "Our builds are slower with the new tool" | Misconfiguration or wrong tool choice | Audit build config, measure baseline, consider different tool |
| "Developers prefer working in old repos" | Tool not solving real problem | Revisit why tool was chosen; may have been wrong decision |
| "BUILD files more complex than code" | Over-tooling the problem | Simplify to lighter framework (uv vs Pants) |
| "Only one engineer understands the system" | Knowledge concentration | Invest in training and documentation |
| "CI times never improved" | Tool isn't being used effectively | Root cause analysis, optimization, or tool change |
| "Team spends 20% time on build issues" | Tool too complex for team capacity | Downgrade to simpler framework |

If experiencing multiple red flags, **pause and reassess**. Tool complexity should be proportional to problem scale.

