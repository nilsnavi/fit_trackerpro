#!/bin/bash
# Health Check System Test Script
# Tests the complete health check system including liveness and readiness probes

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:18000}"
HEALTH_LIVE_URL="${BACKEND_URL}/health/live"
HEALTH_READY_URL="${BACKEND_URL}/health/ready"

echo "======================================"
echo "FitTracker Pro Health Check Tests"
echo "======================================"
echo ""

# Test colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to check HTTP status
check_endpoint() {
    local url=$1
    local name=$2
    
    echo -n "Checking $name ... "
    
    response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ OK (HTTP $http_code)${NC}"
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        echo ""
        return 0
    else
        echo -e "${RED}✗ FAILED (HTTP $http_code)${NC}"
        echo "Response: $body"
        echo ""
        return 1
    fi
}

# Test liveness probe
# Liveness: confirms the process is alive and not deadlocked.
# Kubernetes/Docker will restart the container if this fails.
echo "1. Testing Liveness Probe (/health/live)"
echo "   Semantic: Is the application process alive? (restart if not)"
echo "==========================================="
check_endpoint "$HEALTH_LIVE_URL" "Liveness Probe (/health/live)" || exit 1

# Test readiness probe
# Readiness: confirms all dependencies (DB, Redis, etc.) are reachable.
# The container will NOT receive traffic until this probe returns 200.
echo "2. Testing Readiness Probe (/health/ready)"
echo "   Semantic: Are all dependencies healthy? (route traffic only if yes)"
echo "==========================================="
if check_endpoint "$HEALTH_READY_URL" "Readiness Probe (/health/ready)"; then
    # Parse readiness response
    status=$(curl -s "$HEALTH_READY_URL" | jq -r '.status')
    
    if [ "$status" = "ready" ]; then
        echo -e "${GREEN}Backend is READY to serve traffic (all dependencies healthy)${NC}"
    else
        echo -e "${YELLOW}Backend is NOT READY — dependencies unhealthy (status: $status)${NC}"
    fi
    echo ""
fi

# Test that readiness probe checks dependencies
echo "3. Checking Health Response Structure"
echo "=========================================="
readiness_response=$(curl -s "$HEALTH_READY_URL")
echo "Full Readiness Response:"
echo "$readiness_response" | jq '.'

# Extract dependencies
dependencies=$(echo "$readiness_response" | jq '.dependencies')
echo ""
echo "Dependency Status:"
echo "$dependencies" | jq 'to_entries[] | "\(.key): \(.value.healthy)"'

# Test /api/v1/system/ready endpoint (if it exists)
echo ""
echo "4. Testing API v1 Endpoints"
echo "=========================================="
if curl -s "${BACKEND_URL}/api/v1/system/ready" >/dev/null 2>&1; then
    check_endpoint "${BACKEND_URL}/api/v1/system/ready" "API v1 Readiness"
else
    echo "Note: /api/v1/system/ready endpoint not found (optional)"
fi

# Test /api/v1/system/live endpoint (if it exists)
if curl -s "${BACKEND_URL}/api/v1/system/live" >/dev/null 2>&1; then
    check_endpoint "${BACKEND_URL}/api/v1/system/live" "API v1 Liveness"
else
    echo "Note: /api/v1/system/live endpoint not found (optional)"
fi

echo ""
echo "======================================"
echo "Health Check Tests Complete"
echo "======================================"
