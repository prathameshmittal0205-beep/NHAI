"""
NHAI Datalake 3.0 — Attendance Sync Lambda Handler.

Receives encrypted attendance log payloads from mobile devices,
validates them, checks for duplicates, and stores in DynamoDB.

Endpoint: POST /attendance/sync
Expected payload:
    {
        "log_id": "string",
        "ciphertext": "base64_string",
        "iv": "base64_string",
        "tag": "base64_string",
        "encrypted_at": "ISO8601_string"
    }

Responses:
    200 — Log stored successfully
    400 — Invalid payload (missing/malformed fields)
    409 — Duplicate log_id (conflict resolution)
    500 — Internal server error
"""

import os
import json
import time
import logging
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ============================================================
# DynamoDB Client (Lazy initialization)
# ============================================================

_dynamodb_table = None


def get_dynamodb_table():
    """
    Lazily initializes and returns the DynamoDB Table resource.
    Keeps the connection alive across warm Lambda invocations.
    """
    global _dynamodb_table
    if _dynamodb_table is None:
        import boto3
        table_name = os.environ.get('TABLE_NAME', 'NHAIAttendanceLogs-prod')
        dynamodb = boto3.resource('dynamodb')
        _dynamodb_table = dynamodb.Table(table_name)
    return _dynamodb_table


# ============================================================
# Payload Validation
# ============================================================

REQUIRED_FIELDS = ['log_id', 'ciphertext', 'iv', 'tag', 'encrypted_at']


def validate_payload(body: Dict[str, Any]) -> Optional[str]:
    """
    Validates the incoming attendance sync payload.

    Args:
        body: Parsed JSON body from the request.

    Returns:
        None if valid, or an error message string if invalid.
    """
    if not isinstance(body, dict):
        return "Payload must be a JSON object"

    for field in REQUIRED_FIELDS:
        if field not in body:
            return f"Missing required field: '{field}'"
        if not isinstance(body[field], str):
            return f"Field '{field}' must be a string"
        if len(body[field].strip()) == 0:
            return f"Field '{field}' must not be empty"

    # Validate log_id format (basic sanity check)
    log_id = body['log_id']
    if len(log_id) > 256:
        return f"Field 'log_id' exceeds maximum length (256 chars)"

    # Validate encrypted_at is a parseable ISO 8601 timestamp
    try:
        datetime.fromisoformat(body['encrypted_at'].replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return f"Field 'encrypted_at' must be a valid ISO 8601 timestamp"

    # Validate base64 fields have reasonable length
    for field in ['ciphertext', 'iv', 'tag']:
        if len(body[field]) > 1_000_000:  # 1MB max per field
            return f"Field '{field}' exceeds maximum size (1MB)"

    return None


# ============================================================
# Duplicate Detection
# ============================================================

def check_duplicate(table, log_id: str) -> bool:
    """
    Checks if a log_id already exists in DynamoDB.

    Args:
        table: DynamoDB Table resource.
        log_id: The log identifier to check.

    Returns:
        True if the log_id already exists, False otherwise.
    """
    try:
        response = table.get_item(
            Key={'log_id': log_id},
            ProjectionExpression='log_id'
        )
        return 'Item' in response
    except Exception as e:
        logger.error(f"DynamoDB GetItem error for {log_id}: {str(e)}")
        # On error, assume not duplicate (allow write attempt, PutItem will handle)
        return False


# ============================================================
# Store Record
# ============================================================

def store_attendance_log(table, body: Dict[str, Any], retention_days: int) -> None:
    """
    Stores an encrypted attendance log record in DynamoDB.

    Adds server-side metadata: received_at timestamp and TTL.

    Args:
        table: DynamoDB Table resource.
        body: Validated payload.
        retention_days: Number of days before TTL expiry.
    """
    ttl_timestamp = int(
        (datetime.utcnow() + timedelta(days=retention_days)).timestamp()
    )

    item = {
        'log_id': body['log_id'],
        'ciphertext': body['ciphertext'],
        'iv': body['iv'],
        'tag': body['tag'],
        'encrypted_at': body['encrypted_at'],
        'received_at': datetime.utcnow().isoformat() + 'Z',
        'ttl': ttl_timestamp,
    }

    # Conditional put to prevent race-condition duplicates
    table.put_item(
        Item=item,
        ConditionExpression='attribute_not_exists(log_id)'
    )


# ============================================================
# Response Builders
# ============================================================

def build_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builds an API Gateway proxy response.
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-NHAI-Service': 'attendance-sync',
        },
        'body': json.dumps(body),
    }


# ============================================================
# Lambda Handler
# ============================================================

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda entry point.

    Processes a POST /attendance/sync request:
      1. Parse and validate the payload
      2. Check for duplicate log_id in DynamoDB
      3. Store the new record with TTL
      4. Return appropriate response (200/400/409/500)

    Args:
        event: API Gateway proxy event.
        context: Lambda context object.

    Returns:
        API Gateway proxy response dict.
    """
    request_id = getattr(context, 'aws_request_id', 'local-test')
    logger.info(f"Processing request {request_id}")

    try:
        # 1. Parse body
        raw_body = event.get('body', '{}')
        if isinstance(raw_body, str):
            try:
                body = json.loads(raw_body)
            except json.JSONDecodeError:
                return build_response(400, {
                    'error': 'Invalid JSON in request body',
                    'request_id': request_id,
                })
        else:
            body = raw_body

        # 2. Validate
        validation_error = validate_payload(body)
        if validation_error:
            logger.warning(f"Validation failed: {validation_error}")
            return build_response(400, {
                'error': validation_error,
                'request_id': request_id,
            })

        log_id = body['log_id']
        logger.info(f"Processing log_id: {log_id}")

        # 3. Get DynamoDB table
        table = get_dynamodb_table()

        # 4. Check for duplicate
        if check_duplicate(table, log_id):
            logger.info(f"Duplicate detected: {log_id}")
            return build_response(409, {
                'error': 'Duplicate log_id',
                'log_id': log_id,
                'message': 'This attendance log has already been recorded',
                'request_id': request_id,
            })

        # 5. Store the record
        retention_days = int(os.environ.get('LOG_RETENTION_DAYS', '90'))
        try:
            store_attendance_log(table, body, retention_days)
        except Exception as e:
            # ConditionalCheckFailedException means race-condition duplicate
            if 'ConditionalCheckFailedException' in str(type(e).__name__):
                logger.info(f"Race-condition duplicate caught: {log_id}")
                return build_response(409, {
                    'error': 'Duplicate log_id (race condition)',
                    'log_id': log_id,
                    'request_id': request_id,
                })
            raise  # Re-raise other DynamoDB errors

        # 6. Success
        logger.info(f"Log stored successfully: {log_id}")
        return build_response(200, {
            'message': 'Attendance log stored successfully',
            'log_id': log_id,
            'request_id': request_id,
        })

    except Exception as e:
        logger.error(f"Internal error: {str(e)}\n{traceback.format_exc()}")
        return build_response(500, {
            'error': 'Internal server error',
            'message': str(e),
            'request_id': request_id,
        })
