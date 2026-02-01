#!/bin/bash
# validate-plugin.sh - Pre-release validation for Claude Code plugins
#
# Usage: ./scripts/validate-plugin.sh <plugin-dir>
#
# Checks:
# - plugin.json is valid JSON
# - Required fields exist
# - Scripts have --help
# - SKILL.md has frontmatter
# - No obvious security issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PLUGIN_DIR="${1:-.}"
ERRORS=0
WARNINGS=0

echo "======================================"
echo "Plugin Validation: $(basename "$PLUGIN_DIR")"
echo "======================================"
echo ""

# Check plugin.json exists and is valid
echo "📦 Checking plugin.json..."
PLUGIN_JSON="$PLUGIN_DIR/.claude-plugin/plugin.json"
if [ ! -f "$PLUGIN_JSON" ]; then
    echo -e "  ${RED}✗${NC} plugin.json not found"
    ERRORS=$((ERRORS + 1))
else
    if jq empty "$PLUGIN_JSON" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Valid JSON"
    else
        echo -e "  ${RED}✗${NC} Invalid JSON syntax"
        ERRORS=$((ERRORS + 1))
    fi

    # Check required fields
    for field in name version description; do
        if jq -e ".$field" "$PLUGIN_JSON" >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} Has '$field' field"
        else
            echo -e "  ${RED}✗${NC} Missing '$field' field"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi
echo ""

# Check skills
echo "📚 Checking skills..."
SKILL_COUNT=0
for skill_dir in "$PLUGIN_DIR"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    SKILL_COUNT=$((SKILL_COUNT + 1))
    skill_name=$(basename "$skill_dir")
    skill_file="$skill_dir/SKILL.md"

    if [ ! -f "$skill_file" ]; then
        echo -e "  ${RED}✗${NC} $skill_name: Missing SKILL.md"
        ERRORS=$((ERRORS + 1))
        continue
    fi

    # Check frontmatter
    if head -1 "$skill_file" | grep -q "^---"; then
        if head -20 "$skill_file" | grep -q "^name:"; then
            echo -e "  ${GREEN}✓${NC} $skill_name: Valid frontmatter"
        else
            echo -e "  ${RED}✗${NC} $skill_name: Missing 'name' in frontmatter"
            ERRORS=$((ERRORS + 1))
        fi
        if head -20 "$skill_file" | grep -q "^description:"; then
            echo -e "  ${GREEN}✓${NC} $skill_name: Has description"
        else
            echo -e "  ${YELLOW}⚠${NC} $skill_name: Missing 'description' in frontmatter"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "  ${RED}✗${NC} $skill_name: No frontmatter (must start with ---)"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $SKILL_COUNT -eq 0 ]; then
    echo -e "  ${YELLOW}⚠${NC} No skills found (optional but typical)"
fi
echo ""

# Check scripts
echo "📜 Checking scripts..."
SCRIPT_COUNT=0
while IFS= read -r -d '' script; do
    SCRIPT_COUNT=$((SCRIPT_COUNT + 1))
    script_name=$(basename "$script")

    # Check --help works (skip if bun not available)
    if command -v bun >/dev/null 2>&1; then
        if bun run "$script" --help >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $script_name: --help works"
        else
            echo -e "  ${YELLOW}⚠${NC} $script_name: --help failed"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} $script_name: bun not installed, skipping --help check"
    fi

    # Check for exit codes documentation
    if grep -q "Exit codes:" "$script" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $script_name: Has exit code docs"
    else
        echo -e "  ${YELLOW}⚠${NC} $script_name: Missing exit code documentation"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check for dangerous patterns
    if grep -q 'process\.argv\[.\].*JSON\.parse' "$script" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} $script_name: Parses JSON from CLI arg (shell escaping risk)"
        ERRORS=$((ERRORS + 1))
    fi
done < <(find "$PLUGIN_DIR" -name "*.ts" -path "*/scripts/*" -print0 2>/dev/null)

if [ $SCRIPT_COUNT -eq 0 ]; then
    echo -e "  ${YELLOW}⚠${NC} No scripts found"
fi
echo ""

# Check for common issues
echo "🔒 Security checks..."

# Check for hardcoded paths (in code files only, not docs)
HARDCODED_PATHS=$(grep -r "/Users/\|/home/" "$PLUGIN_DIR" --include="*.ts" --include="*.js" 2>/dev/null | grep -v ".git" | grep -v "// Example" | head -3)
if [ -n "$HARDCODED_PATHS" ]; then
    echo -e "  ${YELLOW}⚠${NC} Hardcoded user path found:"
    echo "$HARDCODED_PATHS" | head -1 | sed 's/^/      /'
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "  ${GREEN}✓${NC} No hardcoded user paths"
fi

# Check for secrets patterns (exclude common false positives)
SECRETS=$(grep -rE "(api[_-]?key|password|secret[_-]?key|auth[_-]?token)\s*[:=]\s*['\"][^'\"]+['\"]" "$PLUGIN_DIR" --include="*.ts" --include="*.json" 2>/dev/null | grep -v ".git" | grep -v "process.env" | head -3)
if [ -n "$SECRETS" ]; then
    echo -e "  ${RED}✗${NC} Possible hardcoded secret found:"
    echo "$SECRETS" | head -1 | sed 's/^/      /'
    ERRORS=$((ERRORS + 1))
else
    echo -e "  ${GREEN}✓${NC} No obvious secrets"
fi
echo ""

# Summary
echo "======================================"
echo "Summary"
echo "======================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s), 0 errors${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s), $WARNINGS warning(s)${NC}"
    exit 1
fi
