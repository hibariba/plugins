#!/usr/bin/env bash
# validate-plugin.sh - Pre-release validation for Claude Code plugins
#
# Usage: ./tests/validate-plugin.sh [options] <plugin-dir>
#
# Options:
#   -h, --help       Show this help message
#   --no-color       Disable colored output (for CI/automated environments)
#
# Checks:
#   - plugin.json is valid JSON
#   - Required fields exist
#   - Scripts have --help
#   - SKILL.md has frontmatter
#   - No obvious security issues
#
# Exit codes:
#   0 - All checks passed (or warnings only)
#   1 - One or more errors found
#   2 - Missing dependencies or invalid arguments

set -euo pipefail

# Error reporting with line numbers
trap 'echo "Error on line $LINENO" >&2' ERR

# --- Helper Functions ---

die() {
    printf 'Error: %s\n' "$1" >&2
    exit "${2:-1}"
}

usage() {
    cat <<'EOF'
Usage: ./tests/validate-plugin.sh [options] <plugin-dir>

Options:
  -h, --help       Show this help message
  --no-color       Disable colored output (for CI/automated environments)

Checks:
  - plugin.json is valid JSON
  - Required fields exist
  - Scripts have --help
  - SKILL.md has frontmatter
  - No obvious security issues

Exit codes:
  0 - All checks passed (or warnings only)
  1 - One or more errors found
  2 - Missing dependencies or invalid arguments
EOF
    exit 0
}

check_dependencies() {
    local -a missing=()

    if ! command -v jq >/dev/null 2>&1; then
        missing+=("jq")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        die "Missing required dependencies: ${missing[*]}" 2
    fi
}

# --- Color Setup ---

setup_colors() {
    if [[ "$NO_COLOR" == "true" ]]; then
        RED=''
        GREEN=''
        YELLOW=''
        NC=''
    else
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        NC='\033[0m'
    fi
}

# --- Validation Functions ---

check_plugin_json() {
    local plugin_dir="$1"
    local plugin_json="$plugin_dir/.claude-plugin/plugin.json"

    printf '📦 Checking plugin.json...\n'

    if [[ ! -f "$plugin_json" ]]; then
        printf "  %b✗%b plugin.json not found\n" "$RED" "$NC"
        ERRORS=$((ERRORS + 1))
        return
    fi

    if jq empty "$plugin_json" 2>/dev/null; then
        printf "  %b✓%b Valid JSON\n" "$GREEN" "$NC"
    else
        printf "  %b✗%b Invalid JSON syntax\n" "$RED" "$NC"
        ERRORS=$((ERRORS + 1))
    fi

    # Check required fields
    local field
    for field in name version description; do
        if jq -e ".$field" "$plugin_json" >/dev/null 2>&1; then
            printf "  %b✓%b Has '%s' field\n" "$GREEN" "$NC" "$field"
        else
            printf "  %b✗%b Missing '%s' field\n" "$RED" "$NC" "$field"
            ERRORS=$((ERRORS + 1))
        fi
    done

    printf '\n'
}

check_skills() {
    local plugin_dir="$1"
    local skill_count=0
    local skill_dir skill_name skill_file

    printf '📚 Checking skills...\n'

    for skill_dir in "$plugin_dir"/skills/*/; do
        [[ -d "$skill_dir" ]] || continue
        skill_count=$((skill_count + 1))
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"

        if [[ ! -f "$skill_file" ]]; then
            printf "  %b✗%b %s: Missing SKILL.md\n" "$RED" "$NC" "$skill_name"
            ERRORS=$((ERRORS + 1))
            continue
        fi

        # Check frontmatter
        if head -n 1 "$skill_file" | grep -q "^---"; then
            if head -n 20 "$skill_file" | grep -q "^name:"; then
                printf "  %b✓%b %s: Valid frontmatter\n" "$GREEN" "$NC" "$skill_name"
            else
                printf "  %b✗%b %s: Missing 'name' in frontmatter\n" "$RED" "$NC" "$skill_name"
                ERRORS=$((ERRORS + 1))
            fi
            if head -n 20 "$skill_file" | grep -q "^description:"; then
                printf "  %b✓%b %s: Has description\n" "$GREEN" "$NC" "$skill_name"
            else
                printf "  %b⚠%b %s: Missing 'description' in frontmatter\n" "$YELLOW" "$NC" "$skill_name"
                WARNINGS=$((WARNINGS + 1))
            fi
        else
            printf "  %b✗%b %s: No frontmatter (must start with ---)\n" "$RED" "$NC" "$skill_name"
            ERRORS=$((ERRORS + 1))
        fi
    done

    if [[ "$skill_count" -eq 0 ]]; then
        printf "  %b⚠%b No skills found (optional but typical)\n" "$YELLOW" "$NC"
    fi

    printf '\n'
}

check_scripts() {
    local plugin_dir="$1"
    local script_count=0
    local script script_name

    printf '📜 Checking scripts...\n'

    while IFS= read -r -d '' script; do
        script_count=$((script_count + 1))
        script_name=$(basename "$script")

        # Check --help works (skip if bun not available)
        if command -v bun >/dev/null 2>&1; then
            if bun run "$script" --help >/dev/null 2>&1; then
                printf "  %b✓%b %s: --help works\n" "$GREEN" "$NC" "$script_name"
            else
                printf "  %b⚠%b %s: --help failed\n" "$YELLOW" "$NC" "$script_name"
                WARNINGS=$((WARNINGS + 1))
            fi
        else
            printf "  %b⚠%b %s: bun not installed, skipping --help check\n" "$YELLOW" "$NC" "$script_name"
        fi

        # Check for exit codes documentation
        if grep -q "Exit codes:" "$script" 2>/dev/null; then
            printf "  %b✓%b %s: Has exit code docs\n" "$GREEN" "$NC" "$script_name"
        else
            printf "  %b⚠%b %s: Missing exit code documentation\n" "$YELLOW" "$NC" "$script_name"
            WARNINGS=$((WARNINGS + 1))
        fi

        # Check for dangerous patterns
        if grep -q 'process\.argv\[.\].*JSON\.parse' "$script" 2>/dev/null; then
            printf "  %b✗%b %s: Parses JSON from CLI arg (shell escaping risk)\n" "$RED" "$NC" "$script_name"
            ERRORS=$((ERRORS + 1))
        fi
    done < <(find "$plugin_dir" -name "*.ts" -path "*/scripts/*" -print0 2>/dev/null)

    if [[ "$script_count" -eq 0 ]]; then
        printf "  %b⚠%b No scripts found\n" "$YELLOW" "$NC"
    fi

    printf '\n'
}

check_security() {
    local plugin_dir="$1"
    local hardcoded_paths secrets

    printf '🔒 Security checks...\n'

    # Check for hardcoded paths (in code files only, not docs)
    hardcoded_paths=$(grep -r "/Users/\|/home/" "$plugin_dir" --include="*.ts" --include="*.js" 2>/dev/null | grep -v ".git" | grep -v "// Example" | head -n 3 || true)
    if [[ -n "$hardcoded_paths" ]]; then
        printf "  %b⚠%b Hardcoded user path found:\n" "$YELLOW" "$NC"
        printf '%s\n' "$hardcoded_paths" | head -n 1 | sed 's/^/      /'
        WARNINGS=$((WARNINGS + 1))
    else
        printf "  %b✓%b No hardcoded user paths\n" "$GREEN" "$NC"
    fi

    # Check for secrets patterns (exclude common false positives)
    secrets=$(grep -rE "(api[_-]?key|password|secret[_-]?key|auth[_-]?token)\s*[:=]\s*['\"][^'\"]+['\"]" "$plugin_dir" --include="*.ts" --include="*.json" 2>/dev/null | grep -v ".git" | grep -v "process.env" | head -n 3 || true)
    if [[ -n "$secrets" ]]; then
        printf "  %b✗%b Possible hardcoded secret found:\n" "$RED" "$NC"
        printf '%s\n' "$secrets" | head -n 1 | sed 's/^/      /'
        ERRORS=$((ERRORS + 1))
    else
        printf "  %b✓%b No obvious secrets\n" "$GREEN" "$NC"
    fi

    printf '\n'
}

print_summary() {
    printf '======================================\n'
    printf 'Summary\n'
    printf '======================================\n'

    if [[ "$ERRORS" -eq 0 ]] && [[ "$WARNINGS" -eq 0 ]]; then
        printf "%b✓ All checks passed!%b\n" "$GREEN" "$NC"
        exit 0
    elif [[ "$ERRORS" -eq 0 ]]; then
        printf "%b⚠ %d warning(s), 0 errors%b\n" "$YELLOW" "$WARNINGS" "$NC"
        exit 0
    else
        printf "%b✗ %d error(s), %d warning(s)%b\n" "$RED" "$ERRORS" "$WARNINGS" "$NC"
        exit 1
    fi
}

# --- Main ---

main() {
    # Globals
    NO_COLOR=false
    PLUGIN_DIR=""
    ERRORS=0
    WARNINGS=0

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                ;;
            --no-color)
                NO_COLOR=true
                shift
                ;;
            --)
                shift
                break
                ;;
            -*)
                die "Unknown option: $1" 2
                ;;
            *)
                PLUGIN_DIR="$1"
                shift
                ;;
        esac
    done

    # Default to current directory
    PLUGIN_DIR="${PLUGIN_DIR:-.}"

    # Validate plugin directory
    if [[ ! -d "$PLUGIN_DIR" ]]; then
        die "Plugin directory not found: $PLUGIN_DIR" 2
    fi

    # Setup
    check_dependencies
    setup_colors

    # Header
    printf '======================================\n'
    printf 'Plugin Validation: %s\n' "$(basename "$PLUGIN_DIR")"
    printf '======================================\n'
    printf '\n'

    # Run checks
    check_plugin_json "$PLUGIN_DIR"
    check_skills "$PLUGIN_DIR"
    check_scripts "$PLUGIN_DIR"
    check_security "$PLUGIN_DIR"

    # Summary
    print_summary
}

main "$@"
