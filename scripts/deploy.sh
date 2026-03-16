#!/bin/bash
# Deploy the binary option contract to Sui testnet
set -e

echo "=== Deploying SUI Binary Option Contract ==="

cd "$(dirname "$0")/../contract"

# Build
echo "Building contract..."
sui move build

# Publish
echo "Publishing to testnet..."
RESULT=$(sui client publish --gas-budget 200000000 --json)

echo "$RESULT" | jq .

# Extract package ID
PACKAGE_ID=$(echo "$RESULT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
echo ""
echo "=== Deployment Complete ==="
echo "Package ID: $PACKAGE_ID"
echo ""
echo "Update your .env files with:"
echo "  PACKAGE_ID=$PACKAGE_ID"
echo ""
echo "Find MARKET_ID and ORACLE_CAP_ID in the created objects above."
