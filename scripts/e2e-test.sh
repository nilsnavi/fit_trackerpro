#!/usr/bin/env bash
#
# E2E Test Runner - Quick setup and execution script
#
# Usage:
#   ./scripts/e2e-test.sh                    # Run all E2E tests
#   ./scripts/e2e-test.sh --golden-path      # Run only golden path
#   ./scripts/e2e-test.sh --regression       # Run only regression
#   ./scripts/e2e-test.sh --ui               # Interactive UI mode
#   ./scripts/e2e-test.sh --headed           # Browser visible mode

set -e

cd "$(dirname "$0")/.."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Ensure we're in the frontend directory
if [ ! -f "frontend/package.json" ]; then
    print_warning "Not found in project root. Changing to frontend directory..."
    cd frontend
fi

MODE="${1:-all}"

print_header "FitTracker Pro E2E Test Runner"
echo "Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_header "Installing dependencies..."
    npm ci --legacy-peer-deps
fi

# Install Playwright browsers if needed
if [ ! -d ".cache/ms-playwright" ] && [ ! -d "../.cache/ms-playwright" ]; then
    print_header "Installing Playwright browsers..."
    npx playwright install chromium
fi

print_header "Running E2E tests (mode: $MODE)"
echo ""

case $MODE in
    --golden-path)
        print_header "Running golden path tests only..."
        npx playwright test --grep @golden-path
        print_success "Golden path tests completed!"
        ;;
    
    --regression)
        print_header "Running regression tests..."
        npx playwright test --grep @regression
        print_success "Regression tests completed!"
        ;;
    
    --workout-flows)
        print_header "Running workout flow tests..."
        npx playwright test --grep @workout-flows
        print_success "Workout flow tests completed!"
        ;;
    
    --ui)
        print_header "Starting UI mode (interactive)..."
        npx playwright test --ui
        ;;
    
    --headed)
        print_header "Running with visible browser..."
        npx playwright test --headed
        print_success "Tests with browser visibility completed!"
        ;;
    
    --debug)
        print_header "Running in debug mode..."
        npx playwright test --debug
        ;;
    
    all|"")
        print_header "Running all E2E tests..."
        npx playwright test
        print_success "All E2E tests completed!"
        ;;
    
    *)
        echo "Unknown mode: $MODE"
        echo ""
        echo "Available modes:"
        echo "  --golden-path   Run only golden path tests (@golden-path tag)"
        echo "  --regression    Run only regression tests (@regression tag)"
        echo "  --workout-flows Run only workout flow tests (@workout-flows tag)"
        echo "  --ui            Interactive UI mode with test inspector"
        echo "  --headed        Run with visible browser (default: headless)"
        echo "  --debug         Debug mode with inspector"
        echo "  all             Run all E2E tests (default)"
        echo ""
        exit 1
        ;;
esac

# Generate and open report
if [ -f "playwright-report/index.html" ]; then
    print_success "Test report generated: playwright-report/"
    echo "To view report, run: npx playwright show-report"
fi

print_success "Done!"
