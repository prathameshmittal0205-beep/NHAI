#!/usr/bin/env bash
# ============================================================
# NHAI Datalake 3.0 — One-Click AWS Deployment
#
# Usage:
#   chmod +x aws/deploy.sh
#   ./aws/deploy.sh              # Deploy to prod (default)
#   ./aws/deploy.sh staging      # Deploy to staging
#   ./aws/deploy.sh dev          # Deploy to dev
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Sufficient IAM permissions for CloudFormation, Lambda,
#     API Gateway, DynamoDB, and IAM role creation
# ============================================================

set -euo pipefail

STAGE="${1:-prod}"
STACK_NAME="nhai-attendance-sync-${STAGE}"
TEMPLATE_FILE="aws/cloudformation.yaml"
LAMBDA_CODE="aws/attendance_webhook.py"
REGION="${AWS_DEFAULT_REGION:-ap-south-1}"

echo "============================================"
echo "  NHAI Datalake 3.0 — AWS Deployment"
echo "  Stage:    ${STAGE}"
echo "  Stack:    ${STACK_NAME}"
echo "  Region:   ${REGION}"
echo "============================================"

# 1. Validate the CloudFormation template
echo "[1/4] Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body "file://${TEMPLATE_FILE}" \
  --region "${REGION}" \
  > /dev/null
echo "  ✓ Template is valid"

# 2. Package the Lambda code into a ZIP
echo "[2/4] Packaging Lambda code..."
LAMBDA_ZIP="/tmp/nhai-lambda-${STAGE}.zip"
cd aws
zip -j "${LAMBDA_ZIP}" attendance_webhook.py
cd ..
echo "  ✓ Lambda package: ${LAMBDA_ZIP}"

# 3. Deploy the CloudFormation stack
echo "[3/4] Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file "${TEMPLATE_FILE}" \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides \
    "Stage=${STAGE}" \
    "LogRetentionDays=90" \
    "LambdaMemoryMB=256" \
    "LambdaTimeoutSeconds=15" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${REGION}" \
  --no-fail-on-empty-changeset
echo "  ✓ Stack deployed successfully"

# 4. Update Lambda function code (replace the placeholder)
echo "[4/4] Updating Lambda function code..."
LAMBDA_FUNCTION_NAME="nhai-attendance-webhook-${STAGE}"
aws lambda update-function-code \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --zip-file "fileb://${LAMBDA_ZIP}" \
  --region "${REGION}" \
  > /dev/null
echo "  ✓ Lambda code updated"

# 5. Print the API endpoint
echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)
echo "  API Endpoint: ${API_ENDPOINT}"
echo ""
echo "  Test with:"
echo "    curl -X POST ${API_ENDPOINT} \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"log_id\": \"test-001\", \"ciphertext\": \"dGVzdA==\", \"iv\": \"dGVzdA==\", \"tag\": \"dGVzdA==\", \"encrypted_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'"
echo "============================================"

# Cleanup
rm -f "${LAMBDA_ZIP}"
