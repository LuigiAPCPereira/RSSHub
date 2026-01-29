#!/usr/bin/env bash
# Bisection script to find which test creates unwanted files/state
# Usage: ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh '.git' 'src/**/*.test.ts'

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 '.git' 'src/**/*.test.ts'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo ""

# Get list of test files
if command -v fd >/dev/null 2>&1; then
  TEST_FILES=$(fd -t f "$TEST_PATTERN" | sort)
else
  # Fallback to finding test files using the provided pattern
  # Attempt to handle path-based patterns by using -wholename (similar to -path but standard in GNU/BSD find)
  # or -name if it looks like a simple filename pattern.
  if [[ "$TEST_PATTERN" == *"/"* ]]; then
    TEST_FILES=$(find . -type f -wholename "$TEST_PATTERN" | sort)
  else
    TEST_FILES=$(find . -type f -name "$TEST_PATTERN" | sort)
  fi
fi

TOTAL=$(echo "$TEST_FILES" | wc -l | tr -d ' ')

echo "Found $TOTAL test files"
echo ""

COUNT=0
while IFS= read -r TEST_FILE; do
  [ -z "$TEST_FILE" ] && continue
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  npm test "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  npm test $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done <<< "$TEST_FILES"

echo ""
echo "✅ No polluter found - all tests clean!"
exit 0
