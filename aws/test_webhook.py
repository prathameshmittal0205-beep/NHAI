"""
Local test for the NHAI attendance Lambda webhook handler.

Exercises the handler without a real AWS deployment by mocking:
  - DynamoDB Table (get_item, put_item)
  - Lambda context (aws_request_id)

Tests:
  1. Valid new log → 200 stored
  2. Duplicate log_id → 409 conflict
  3. Missing required field → 400
  4. Malformed JSON body → 400
  5. Empty string field → 400
  6. DynamoDB write failure → 500
  7. Race-condition duplicate (ConditionalCheckFailedException) → 409

Run:  python aws/test_webhook.py
"""

import os
import sys
import json
import unittest
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime

# Ensure the aws directory is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Set environment variables before importing the handler
os.environ['TABLE_NAME'] = 'NHAIAttendanceLogs-test'
os.environ['STAGE'] = 'test'
os.environ['LOG_RETENTION_DAYS'] = '90'

import attendance_webhook as webhook


# ============================================================
# Mock DynamoDB Table
# ============================================================

class MockDynamoDBTable:
    """In-memory DynamoDB table mock with get_item and put_item."""

    def __init__(self):
        self.items = {}

    def get_item(self, Key=None, ProjectionExpression=None):
        log_id = Key.get('log_id') if Key else None
        if log_id and log_id in self.items:
            return {'Item': self.items[log_id]}
        return {}

    def put_item(self, Item=None, ConditionExpression=None):
        log_id = Item.get('log_id')
        if ConditionExpression and log_id in self.items:
            raise ConditionalCheckFailedException(
                f"The conditional request failed for log_id: {log_id}"
            )
        self.items[log_id] = Item

    def reset(self):
        self.items = {}


class ConditionalCheckFailedException(Exception):
    """Simulates boto3 DynamoDB ConditionalCheckFailedException."""
    pass


# ============================================================
# Mock Lambda Context
# ============================================================

class MockLambdaContext:
    def __init__(self, request_id='test-request-001'):
        self.aws_request_id = request_id
        self.function_name = 'nhai-attendance-webhook-test'
        self.memory_limit_in_mb = 256
        self.invoked_function_arn = 'arn:aws:lambda:ap-south-1:123456789:function:test'


# ============================================================
# Test Helpers
# ============================================================

def make_event(body_dict=None, body_str=None):
    """Create a mock API Gateway proxy event."""
    if body_str is not None:
        body = body_str
    elif body_dict is not None:
        body = json.dumps(body_dict)
    else:
        body = '{}'

    return {
        'httpMethod': 'POST',
        'path': '/attendance/sync',
        'headers': {'Content-Type': 'application/json'},
        'body': body,
    }


def make_valid_payload(log_id='LOG_001_1234567890'):
    return {
        'log_id': log_id,
        'ciphertext': 'SGVsbG8gV29ybGQ=',  # "Hello World" in base64
        'iv': 'dGVzdGl2MTIz',
        'tag': 'dGVzdHRhZzEyMzQ1Njc4',
        'encrypted_at': '2026-06-01T18:30:00Z',
    }


# ============================================================
# Test Suite
# ============================================================

class TestAttendanceWebhook(unittest.TestCase):

    def setUp(self):
        """Reset mock DynamoDB table before each test."""
        self.mock_table = MockDynamoDBTable()
        # Patch the module-level DynamoDB table getter
        self.patcher = patch.object(
            webhook, 'get_dynamodb_table',
            return_value=self.mock_table
        )
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        # Reset the cached table reference
        webhook._dynamodb_table = None

    def test_valid_new_log_returns_200(self):
        """A valid new attendance log should be stored and return 200."""
        payload = make_valid_payload('LOG_NEW_001')
        event = make_event(body_dict=payload)
        context = MockLambdaContext()

        response = webhook.lambda_handler(event, context)

        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertEqual(body['log_id'], 'LOG_NEW_001')
        self.assertIn('message', body)
        self.assertIn('LOG_NEW_001', self.mock_table.items)
        print(f"  [PASS] Test 1: Valid new log -> 200 (stored)")

    def test_duplicate_log_returns_409(self):
        """A duplicate log_id should return 409 conflict."""
        payload = make_valid_payload('LOG_DUP_001')

        # Store once
        event1 = make_event(body_dict=payload)
        context1 = MockLambdaContext('req-001')
        r1 = webhook.lambda_handler(event1, context1)
        self.assertEqual(r1['statusCode'], 200)

        # Attempt duplicate
        event2 = make_event(body_dict=payload)
        context2 = MockLambdaContext('req-002')
        r2 = webhook.lambda_handler(event2, context2)

        self.assertEqual(r2['statusCode'], 409)
        body = json.loads(r2['body'])
        self.assertIn('Duplicate', body['error'])
        print(f"  [PASS] Test 2: Duplicate log_id -> 409 (conflict)")

    def test_missing_field_returns_400(self):
        """A payload missing a required field should return 400."""
        payload = make_valid_payload()
        del payload['ciphertext']  # Remove required field

        event = make_event(body_dict=payload)
        context = MockLambdaContext()

        response = webhook.lambda_handler(event, context)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertIn('ciphertext', body['error'])
        print(f"  [PASS] Test 3: Missing field -> 400")

    def test_malformed_json_returns_400(self):
        """Malformed JSON in the body should return 400."""
        event = make_event(body_str='{"log_id": broken json}')
        context = MockLambdaContext()

        response = webhook.lambda_handler(event, context)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertIn('Invalid JSON', body['error'])
        print(f"  [PASS] Test 4: Malformed JSON -> 400")

    def test_empty_field_returns_400(self):
        """An empty string in a required field should return 400."""
        payload = make_valid_payload()
        payload['iv'] = '   '  # whitespace-only

        event = make_event(body_dict=payload)
        context = MockLambdaContext()

        response = webhook.lambda_handler(event, context)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertIn('iv', body['error'])
        print(f"  [PASS] Test 5: Empty field -> 400")

    def test_dynamodb_write_failure_returns_500(self):
        """A DynamoDB write failure (non-duplicate) should return 500."""
        payload = make_valid_payload('LOG_ERR_001')
        event = make_event(body_dict=payload)
        context = MockLambdaContext()

        # Make put_item raise a generic error
        self.mock_table.put_item = MagicMock(
            side_effect=Exception("DynamoDB throttled")
        )

        response = webhook.lambda_handler(event, context)

        self.assertEqual(response['statusCode'], 500)
        body = json.loads(response['body'])
        self.assertIn('error', body)
        print(f"  [PASS] Test 6: DynamoDB write failure -> 500")

    def test_race_condition_duplicate_returns_409(self):
        """
        A race-condition duplicate (ConditionalCheckFailedException
        during put_item) should return 409.
        """
        payload = make_valid_payload('LOG_RACE_001')
        event = make_event(body_dict=payload)
        context = MockLambdaContext()

        # Make put_item raise ConditionalCheckFailedException
        self.mock_table.put_item = MagicMock(
            side_effect=ConditionalCheckFailedException("Condition not met")
        )

        response = webhook.lambda_handler(event, context)

        self.assertEqual(response['statusCode'], 409)
        body = json.loads(response['body'])
        self.assertIn('race condition', body['error'].lower())
        print(f"  [PASS] Test 7: Race-condition duplicate -> 409")

    def test_stored_record_has_ttl(self):
        """Stored records must have a TTL field set for automatic expiry."""
        payload = make_valid_payload('LOG_TTL_001')
        event = make_event(body_dict=payload)
        context = MockLambdaContext()

        webhook.lambda_handler(event, context)

        stored = self.mock_table.items.get('LOG_TTL_001')
        self.assertIsNotNone(stored)
        self.assertIn('ttl', stored)
        self.assertIsInstance(stored['ttl'], int)
        # TTL should be ~90 days from now
        self.assertGreater(stored['ttl'], int(datetime.utcnow().timestamp()))
        print(f"  [PASS] Test 8: Stored record has valid TTL")

    def test_stored_record_has_received_at(self):
        """Stored records must have a server-side received_at timestamp."""
        payload = make_valid_payload('LOG_TS_001')
        event = make_event(body_dict=payload)
        context = MockLambdaContext()

        webhook.lambda_handler(event, context)

        stored = self.mock_table.items.get('LOG_TS_001')
        self.assertIsNotNone(stored)
        self.assertIn('received_at', stored)
        self.assertTrue(stored['received_at'].endswith('Z'))
        print(f"  [PASS] Test 9: Stored record has received_at timestamp")


# ============================================================
# Runner
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("  NHAI Attendance Webhook -- Local Test Suite")
    print("=" * 60)
    print()

    # Run tests with verbose output
    unittest.main(verbosity=2)
