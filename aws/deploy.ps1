$ErrorActionPreference = "Stop"

$STAGE = if ($args.Count -gt 0) { $args[0] } else { "prod" }
$STACK_NAME = "nhai-attendance-sync-$STAGE"
$TEMPLATE_FILE = "aws/cloudformation.yaml"
$LAMBDA_CODE = "aws/attendance_webhook.py"
$REGION = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "ap-south-1" }

Write-Host "============================================"
Write-Host "  NHAI Datalake 3.0 -- AWS Deployment"
Write-Host "  Stage:    $STAGE"
Write-Host "  Stack:    $STACK_NAME"
Write-Host "  Region:   $REGION"
Write-Host "============================================"

# 1. Validate
Write-Host "[1/4] Validating CloudFormation template..."
aws cloudformation validate-template --template-body "fileb://$TEMPLATE_FILE" --region $REGION | Out-Null
Write-Host "  ✓ Template is valid"

# 2. Package Lambda
Write-Host "[2/4] Packaging Lambda code..."
$LAMBDA_ZIP = "$env:TEMP\nhai-lambda-$STAGE.zip"
if (Test-Path $LAMBDA_ZIP) { Remove-Item $LAMBDA_ZIP }
Compress-Archive -Path $LAMBDA_CODE -DestinationPath $LAMBDA_ZIP
Write-Host "  ✓ Lambda package: $LAMBDA_ZIP"

# 3. Deploy Stack
Write-Host "[3/4] Deploying CloudFormation stack..."
aws cloudformation deploy `
  --template-file $TEMPLATE_FILE `
  --stack-name $STACK_NAME `
  --parameter-overrides "Stage=$STAGE" "LogRetentionDays=90" "LambdaMemoryMB=256" "LambdaTimeoutSeconds=15" `
  --capabilities CAPABILITY_NAMED_IAM `
  --region $REGION `
  --no-fail-on-empty-changeset
Write-Host "  ✓ Stack deployed successfully"

# 4. Update Lambda code
Write-Host "[4/4] Updating Lambda function code..."
$LAMBDA_FUNCTION_NAME = "nhai-attendance-webhook-$STAGE"
aws lambda update-function-code `
  --function-name $LAMBDA_FUNCTION_NAME `
  --zip-file "fileb://$LAMBDA_ZIP" `
  --region $REGION | Out-Null
Write-Host "  ✓ Lambda code updated"

# 5. Output
Write-Host ""
Write-Host "============================================"
Write-Host "  Deployment Complete!"
Write-Host "============================================"
$API_ENDPOINT = aws cloudformation describe-stacks `
  --stack-name $STACK_NAME `
  --region $REGION `
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" `
  --output text
Write-Host "  API Endpoint: $API_ENDPOINT"
Write-Host ""
Write-Host "  Test with:"
Write-Host "    curl -X POST $API_ENDPOINT \`"
Write-Host "      -H 'Content-Type: application/json' \`"
$dateStr = Get-Date -UFormat "%Y-%m-%dT%H:%M:%SZ"
Write-Host "      -d '{""log_id"": ""test-001"", ""ciphertext"": ""dGVzdA=="", ""iv"": ""dGVzdA=="", ""tag"": ""dGVzdA=="", ""encrypted_at"": ""$dateStr""}'"
Write-Host "============================================"

Remove-Item $LAMBDA_ZIP -ErrorAction SilentlyContinue
