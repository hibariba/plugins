# GitHub Configuration

This directory contains GitHub-specific configuration for issue management, pull request workflows, and CI/CD automation.

## Issue Management System

### Issue Templates

We use YAML-based issue forms for structured data collection:

- **`ISSUE_TEMPLATE/1-bug.yml`** - Bug reports
- **`ISSUE_TEMPLATE/2-feature.yml`** - Feature requests
- **`ISSUE_TEMPLATE/3-feedback.yml`** - General feedback

Issue forms enforce required fields and provide dropdowns for common selections, making it easier to collect consistent information.

### Automated Workflows

#### Triage (`workflows/triage.yml`)

Runs when issues are opened:

- **Auto-labeling**: Detects keywords and applies relevant labels
  - Priority detection: `critical`, `urgent`, `broken` → `priority:high`
  - Component detection: Plugin names, docs, testing keywords
- **Welcome message**: First-time contributors get a friendly welcome
- **Priority notification**: High-priority issues get immediate comment

#### Stale Issue Management (`workflows/stale.yml`)

Runs daily to keep the issue tracker clean:

- **Issues**: 60 days inactive → marked stale → 7 days → closed
- **Pull Requests**: 45 days inactive → marked stale → 14 days → closed
- **Exemptions**: Issues/PRs with `priority:high`, `blocked`, or `in-progress` labels

#### PR Link Check (`workflows/pr-link-check.yml`)

Runs when PRs are opened:

- **Issue linking**: Checks for `Fixes #123` or `Closes #456` keywords
- **Auto-labeling**: Labels PRs based on changed files
  - Plugin changes → `plugin`, `plugin:name`
  - Documentation → `docs`
  - Tests/CI → `testing`, `ci/cd`

## Labels

Label categories defined in `labels.yml`:

| Category | Labels | Purpose |
|----------|--------|---------|
| **Type** | `bug`, `feature`, `feedback`, `docs`, `testing` | What kind of issue |
| **Priority** | `priority:high/medium/low` | Urgency level |
| **Status** | `triage`, `in-progress`, `blocked`, `needs-info`, `wontfix` | Current state |
| **Component** | `plugin`, `plugin:*`, `marketplace`, `ci/cd` | What part of repo |

### Syncing Labels

To sync labels to your repository:

```bash
# Using github-label-sync (recommended)
npx github-label-sync --labels .github/labels.yml owner/repo

# Or manually create them in GitHub UI
# Settings → Labels → New label
```

## Workflow Overview

```
User opens issue
    ↓
Issue form enforces structure
    ↓
Triage workflow auto-labels
    ↓
First-time contributor? → Welcome message
    ↓
Priority:high detected? → Notification comment
    ↓
Maintainer reviews (triage label)
    ↓
Work begins (in-progress label)
    ↓
PR opened with "Fixes #123"
    ↓
PR auto-labeled by changed files
    ↓
PR merged → issue auto-closed
```

## Best Practices

### For Users

- **Use issue templates** - They help provide all needed information
- **Link PRs to issues** - Use `Fixes #123` in PR description
- **Keep issues focused** - One issue per bug/feature
- **Update if blocked** - Comment if you need help

### For Maintainers

- **Review triage label** - Check new issues daily
- **Set priority** - Add priority labels based on impact
- **Add context** - Comment on issues needing clarification
- **Close duplicates** - Link to original issue when closing
- **Keep stale bot** - Let automation close inactive issues

## Customization

### Adding New Plugins to Auto-Detection

Edit `.github/workflows/triage.yml`:

```javascript
if (text.includes('new-plugin')) labels.push('plugin:new-plugin');
```

### Adjusting Stale Timeouts

Edit `.github/workflows/stale.yml`:

```yaml
days-before-stale: 60  # Change threshold
days-before-close: 7   # Change grace period
```

### Creating New Issue Templates

1. Copy existing template in `ISSUE_TEMPLATE/`
2. Rename with numeric prefix: `4-new-type.yml`
3. Customize fields and labels
4. Test by opening new issue

## Testing Locally

Issue forms can't be tested locally, but you can validate YAML:

```bash
# Validate YAML syntax
yamllint .github/ISSUE_TEMPLATE/*.yml

# Or use yq
yq eval .github/ISSUE_TEMPLATE/1-bug.yml
```

Workflows can be tested using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act

# Test triage workflow
act issues -e test-event.json
```

## Resources

- [GitHub Issue Forms Documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Stale Action](https://github.com/actions/stale)
- [GitHub Script Action](https://github.com/actions/github-script)

---

**Questions?** Open an issue using the feedback template!
