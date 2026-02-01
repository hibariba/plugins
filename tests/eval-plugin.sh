#!/usr/bin/env bash
# eval-plugin.sh - Behavioral evaluation for Claude Code plugins
#
# Usage: ./tests/eval-plugin.sh [options] <plugin-dir>
#
# Options:
#   -h, --help       Show this help message
#   -v, --verbose    Show detailed output for each test
#   -n, --dry-run    Show tests without running them
#   --no-color       Disable colored output (for CI/automated environments)
#   --timeout <sec>  Per-test timeout in seconds (default: 60)
#
# Tests:
#   - Reads tests.txt from plugin directory
#   - Format: prompt|expected_behavior (# for comments)
#   - Uses CC as judge to evaluate behavioral match
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#   2 - Missing dependencies or invalid arguments
#   3 - No tests.txt found

set -euo pipefail

# Error reporting with line numbers
trap 'echo "Error on line $LINENO" >&2' ERR

# Cleanup temp files on exit
TEMP_FILES=()
cleanup() {
    if [[ ${#TEMP_FILES[@]} -gt 0 ]]; then
        for f in "${TEMP_FILES[@]}"; do
            [[ -f "$f" ]] && rm -f "$f"
        done
    fi
}
trap cleanup EXIT

# --- Helper Functions ---

die() {
    printf 'Error: %s\n' "$1" >&2
    exit "${2:-1}"
}

usage() {
    cat <<'EOF'
Usage: ./tests/eval-plugin.sh [options] <plugin-dir>

Options:
  -h, --help       Show this help message
  -v, --verbose    Show detailed output for each test
  -n, --dry-run    Show tests without running them
  --no-color       Disable colored output (for CI/automated environments)
  --timeout <sec>  Per-test timeout in seconds (default: 60)

Tests:
  - Reads tests.txt from plugin directory
  - Format: prompt|expected_behavior (# for comments)
  - Uses CC as judge to evaluate behavioral match

Exit codes:
  0 - All tests passed
  1 - One or more tests failed
  2 - Missing dependencies or invalid arguments
  3 - No tests.txt found
EOF
    trap - ERR EXIT  # Clear traps before clean exit
    exit 0
}

check_dependencies() {
    local -a missing=()

    # Only check claude dependency if not in dry-run mode
    if [[ "$DRY_RUN" != "true" ]]; then
        if ! command -v claude >/dev/null 2>&1; then
            missing+=("claude (Claude Code CLI)")
        fi
    fi

    # Check for timeout command (gtimeout on macOS, timeout on Linux)
    if command -v gtimeout >/dev/null 2>&1; then
        TIMEOUT_CMD="gtimeout"
    elif command -v timeout >/dev/null 2>&1; then
        TIMEOUT_CMD="timeout"
    elif [[ "$DRY_RUN" != "true" ]]; then
        # Only require timeout for actual runs
        missing+=("timeout (brew install coreutils)")
    else
        # For dry-run, use a no-op
        TIMEOUT_CMD=""
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
        BLUE=''
        NC=''
    else
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        NC='\033[0m'
    fi
}

# --- Eval Functions ---

create_temp_file() {
    local temp_file
    temp_file=$(mktemp)
    TEMP_FILES+=("$temp_file")
    echo "$temp_file"
}

# Run a single test with specified model
# Returns: 0=pass, 1=fail, 2=timeout/error
run_single_test() {
    local plugin_dir="$1"
    local prompt="$2"
    local expected="$3"
    local test_num="$4"
    local model="$5"  # "haiku" or "sonnet"
    local response_file="$6"
    local judge_result_file="$7"

    local judge_prompt_file
    judge_prompt_file=$(create_temp_file)

    # Run CC with plugin and specified model
    if ! $TIMEOUT_CMD "${TEST_TIMEOUT}s" claude --model "$model" \
        --plugin-dir "$plugin_dir" \
        --disable-slash-commands \
        --print --dangerously-skip-permissions \
        -p "$prompt" > "$response_file" 2>&1; then
        return 2  # Timeout or error
    fi

    local response
    response=$(cat "$response_file")

    if [[ "$VERBOSE" == "true" ]]; then
        printf "  %b→%b Response (%s):\n" "$BLUE" "$NC" "$model"
        echo "$response" | head -20 | sed 's/^/      /'
        [[ $(wc -l < "$response_file") -gt 20 ]] && printf "      ...(truncated)\n"
    fi

    # Create judge prompt using file-based IPC (avoid shell escaping issues)
    cat > "$judge_prompt_file" <<JUDGEPROMPT
You are evaluating whether an AI response matches expected behavior.

EXPECTED BEHAVIOR:
$expected

ACTUAL RESPONSE:
$response

Does the response demonstrate the expected behavior? Consider:
- Does it show the key characteristics described?
- Does it accomplish what was expected?
- Minor variations in wording are acceptable if behavior matches.

Reply with ONLY one word: PASS or FAIL
JUDGEPROMPT

    # Run judge with Sonnet (always - needs reliable judgment)
    if ! $TIMEOUT_CMD 30s claude --model sonnet \
        --print --dangerously-skip-permissions \
        -p "$(cat "$judge_prompt_file")" > "$judge_result_file" 2>&1; then
        return 2  # Judge timeout
    fi

    local verdict
    verdict=$(cat "$judge_result_file" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')

    if [[ "$verdict" == *"PASS"* ]]; then
        return 0
    else
        return 1
    fi
}

# Generate actionable bug report for failed tests
generate_bug_report() {
    local plugin_dir="$1"
    local prompt="$2"
    local expected="$3"
    local test_num="$4"
    local haiku_response_file="$5"
    local sonnet_response_file="$6"
    local judge_result_file="$7"

    local plugin_name
    plugin_name=$(basename "$plugin_dir")

    local script_dir
    script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
    local reports_dir="$script_dir/../tests/reports"
    local report_file="$reports_dir/${plugin_name}-test${test_num}.md"

    mkdir -p "$reports_dir"

    cat > "$report_file" <<EOF
# Bug Report: ${plugin_name} Test ${test_num}

## Test Details
- **Plugin**: ${plugin_name}
- **Test #**: ${test_num}
- **Prompt**: ${prompt}
- **Expected**: ${expected}

## Haiku Response
\`\`\`
$(cat "$haiku_response_file" 2>/dev/null || echo "(no response)")
\`\`\`

## Sonnet Response
\`\`\`
$(cat "$sonnet_response_file" 2>/dev/null || echo "(no response)")
\`\`\`

## Judge Verdict (Sonnet)
$(cat "$judge_result_file" 2>/dev/null || echo "(no verdict)")

## Suggested Fix
Review the skill/command that should handle this prompt and ensure it:
1. Triggers on the given prompt
2. Produces output matching the expected behavior
3. Handles edge cases appropriately
EOF

    printf "  %b📋%b Bug report: tests/reports/${plugin_name}-test${test_num}.md\n" "$BLUE" "$NC"
}

# Main test runner with Haiku-first, Sonnet fallback
run_test() {
    local plugin_dir="$1"
    local prompt="$2"
    local expected="$3"
    local test_num="$4"

    local haiku_response_file sonnet_response_file judge_result_file
    haiku_response_file=$(create_temp_file)
    sonnet_response_file=$(create_temp_file)
    judge_result_file=$(create_temp_file)

    if [[ "$VERBOSE" == "true" ]]; then
        printf "  %b→%b Prompt: %s\n" "$BLUE" "$NC" "$prompt"
        printf "  %b→%b Expected: %s\n" "$BLUE" "$NC" "$expected"
    fi

    # Try with Haiku first (cost-efficient)
    local haiku_result
    run_single_test "$plugin_dir" "$prompt" "$expected" "$test_num" "haiku" \
        "$haiku_response_file" "$judge_result_file"
    haiku_result=$?

    if [[ $haiku_result -eq 0 ]]; then
        printf "  %b✓%b Test %d: PASS (haiku)\n" "$GREEN" "$NC" "$test_num"
        HAIKU_PASSED=$((HAIKU_PASSED + 1))
        return 0
    fi

    # Haiku failed or errored - retry with Sonnet
    if [[ $haiku_result -eq 2 ]]; then
        printf "  %b↻%b Test %d: Haiku timeout, trying sonnet...\n" "$YELLOW" "$NC" "$test_num"
    else
        printf "  %b↻%b Test %d: Haiku failed, trying sonnet...\n" "$YELLOW" "$NC" "$test_num"
    fi

    local sonnet_result
    run_single_test "$plugin_dir" "$prompt" "$expected" "$test_num" "sonnet" \
        "$sonnet_response_file" "$judge_result_file"
    sonnet_result=$?

    if [[ $sonnet_result -eq 0 ]]; then
        printf "  %b✓%b Test %d: PASS (sonnet fallback)\n" "$GREEN" "$NC" "$test_num"
        SONNET_FALLBACK_PASSED=$((SONNET_FALLBACK_PASSED + 1))
        return 0
    fi

    # Both failed - generate bug report
    generate_bug_report "$plugin_dir" "$prompt" "$expected" "$test_num" \
        "$haiku_response_file" "$sonnet_response_file" "$judge_result_file"
    printf "  %b✗%b Test %d: FAIL\n" "$RED" "$NC" "$test_num"

    if [[ "$VERBOSE" == "true" ]]; then
        printf "      Judge said: %s\n" "$(cat "$judge_result_file" | head -1)"
    fi

    return 1
}

run_evaluation() {
    local plugin_dir="$1"
    local plugin_name
    plugin_name=$(basename "$plugin_dir")

    # Tests are stored OUTSIDE plugin directory to prevent data leakage
    # Test agent with plugin access cannot see expected answers
    local script_dir
    script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
    local tests_file="$script_dir/../tests/${plugin_name}.txt"

    local test_num=0
    local passed=0
    local failed=0

    # Model statistics (global for run_test to update)
    HAIKU_PASSED=0
    SONNET_FALLBACK_PASSED=0

    if [[ ! -f "$tests_file" ]]; then
        printf "%b⚠%b No tests found at %s\n" "$YELLOW" "$NC" "$tests_file"
        return 3
    fi

    printf "📋 Running behavioral tests...\n\n"

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Parse prompt|expected
        local prompt expected
        prompt="${line%%|*}"
        expected="${line#*|}"

        # Trim whitespace
        prompt="${prompt#"${prompt%%[![:space:]]*}"}"
        prompt="${prompt%"${prompt##*[![:space:]]}"}"
        expected="${expected#"${expected%%[![:space:]]*}"}"
        expected="${expected%"${expected##*[![:space:]]}"}"

        [[ -z "$prompt" || -z "$expected" ]] && continue

        test_num=$((test_num + 1))

        if [[ "$DRY_RUN" == "true" ]]; then
            printf "  %b○%b Test %d: %s\n" "$BLUE" "$NC" "$test_num" "$prompt"
            printf "      Expected: %s\n" "$expected"
            continue
        fi

        if run_test "$plugin_dir" "$prompt" "$expected" "$test_num"; then
            passed=$((passed + 1))
        else
            failed=$((failed + 1))
        fi
    done < "$tests_file"

    printf '\n'

    if [[ "$DRY_RUN" == "true" ]]; then
        printf "%b○%b Dry run: %d tests found\n" "$BLUE" "$NC" "$test_num"
        return 0
    fi

    if [[ "$test_num" -eq 0 ]]; then
        printf "%b⚠%b No tests found in tests.txt\n" "$YELLOW" "$NC"
        return 3
    fi

    printf '======================================\n'
    printf 'Results: %d passed, %d failed\n' "$passed" "$failed"
    printf '  - Haiku: %d passed\n' "$HAIKU_PASSED"
    printf '  - Sonnet fallback: %d passed\n' "$SONNET_FALLBACK_PASSED"
    if [[ "$failed" -gt 0 ]]; then
        printf '  - Failed: %d (bug reports generated)\n' "$failed"
    fi
    printf '======================================\n'

    if [[ "$failed" -gt 0 ]]; then
        printf "%b✗ %d test(s) failed%b\n" "$RED" "$failed" "$NC"
        return 1
    else
        printf "%b✓ All tests passed!%b\n" "$GREEN" "$NC"
        return 0
    fi
}

# --- Main ---

main() {
    # Globals
    NO_COLOR=false
    VERBOSE=false
    DRY_RUN=false
    TEST_TIMEOUT=60
    PLUGIN_DIR=""
    TIMEOUT_CMD=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-color)
                NO_COLOR=true
                shift
                ;;
            --timeout)
                [[ -z "${2:-}" ]] && die "--timeout requires a value" 2
                TEST_TIMEOUT="$2"
                shift 2
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

    # Validate plugin directory
    if [[ -z "$PLUGIN_DIR" ]]; then
        die "Plugin directory required. Usage: ./tests/eval-plugin.sh <plugin-dir>" 2
    fi

    if [[ ! -d "$PLUGIN_DIR" ]]; then
        die "Plugin directory not found: $PLUGIN_DIR" 2
    fi

    # Setup
    check_dependencies
    setup_colors

    # Header
    printf '======================================\n'
    printf 'Plugin Eval: %s\n' "$(basename "$PLUGIN_DIR")"
    printf '======================================\n'
    printf '\n'

    # Run evaluation
    run_evaluation "$PLUGIN_DIR"
}

main "$@"
