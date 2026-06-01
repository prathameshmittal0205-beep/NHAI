/**
 * Integration tests for the React Native offline attendance log buffer.
 *
 * Tests the full SyncManager lifecycle:
 *   1. Offline: generate logs → encrypt → queue (nothing sent)
 *   2. Online:  flush → POST to AWS → buffer cleared
 *   3. Retry:   500 response → logs re-queued for retry
 *   4. Duplicate: 409 response → log removed (conflict resolved)
 *
 * Run with: npx ts-node tests/test_rn_offline_buffer.ts
 *   (or transpile + node, or jest with ts-jest)
 */

import {
  SyncManager,
  AttendanceEncryptor,
  InMemoryBuffer,
  MockNetworkMonitor,
  AttendanceLog,
  EncryptedPayload,
  IHttpClient,
  SyncManagerConfig,
} from '../src/services/SyncManager';

// ============================================================
// Mock HTTP Client — records all POST calls
// ============================================================

class MockHttpClient implements IHttpClient {
  public calls: Array<{ url: string; body: any }> = [];
  public responseOverride: { status: number; data: any } | null = null;
  public perLogResponses: Map<string, { status: number; data: any }> = new Map();

  async post(url: string, body: any): Promise<{ status: number; data: any }> {
    this.calls.push({ url, body });

    // Check per-log overrides first
    const logId = body.log_id;
    if (logId && this.perLogResponses.has(logId)) {
      return this.perLogResponses.get(logId)!;
    }

    // Then check global override
    if (this.responseOverride) {
      return this.responseOverride;
    }

    // Default: success
    return { status: 200, data: { message: 'OK', log_id: logId } };
  }

  reset(): void {
    this.calls = [];
    this.responseOverride = null;
    this.perLogResponses.clear();
  }
}

// ============================================================
// Test Helpers
// ============================================================

function generateTestLog(index: number): AttendanceLog {
  return {
    log_id: `LOG_${String(index).padStart(3, '0')}_${Date.now()}`,
    employee_id: `EMP_${String(index).padStart(3, '0')}`,
    timestamp: new Date().toISOString(),
    location_lat: 28.6139 + index * 0.001,
    location_lng: 77.2090 + index * 0.001,
    liveness_score: 0.95 + Math.random() * 0.05,
    recognition_score: 0.88 + Math.random() * 0.1,
    challenge_type: ['blink', 'smile', 'head_turn'][index % 3],
    device_id: 'NHAI_DEVICE_001',
    model_version: 'mobilefacenet_v1.0_int8',
  };
}

let passed = 0;
let failed = 0;
const total_tests = 7;

function assert(condition: boolean, testName: string, details?: string): void {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}${details ? ' — ' + details : ''}`);
    failed++;
  }
}

// ============================================================
// Test Suite
// ============================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('NHAI Offline Buffer Integration Tests');
  console.log('='.repeat(60));

  const TEST_ENDPOINT = 'https://mock-api.nhai-datalake.in/prod/attendance/sync';
  const config: Partial<SyncManagerConfig> = {
    apiEndpoint: TEST_ENDPOINT,
    maxRetries: 3,
    baseRetryDelayMs: 10,   // Fast retries for testing
    batchSize: 10,
  };

  // ---- TEST 1: Offline queuing — no network calls ----
  console.log('\n--- Test 1: Offline Queuing (5 logs, no network calls) ---');
  {
    const buffer = new InMemoryBuffer();
    const http = new MockHttpClient();
    const network = new MockNetworkMonitor();
    network.setState('offline');

    const sync = new SyncManager(buffer, http, network, config);
    await sync.init();

    const logs: AttendanceLog[] = [];
    for (let i = 0; i < 5; i++) {
      const log = generateTestLog(i);
      logs.push(log);
      await sync.recordAttendance(log);
    }

    const pendingCount = await sync.getPendingCount();
    assert(pendingCount === 5, 'All 5 logs queued locally', `got ${pendingCount}`);
    assert(http.calls.length === 0, 'Zero network calls while offline', `got ${http.calls.length}`);

    sync.destroy();
  }

  // ---- TEST 2: Encrypted payloads are valid ----
  console.log('\n--- Test 2: Encryption Verification ---');
  {
    const encryptor = new AttendanceEncryptor();
    const log = generateTestLog(0);

    const encrypted = await encryptor.encrypt(log);

    assert(
      encrypted.ciphertext.length > 0 && encrypted.iv.length > 0 && encrypted.tag.length > 0,
      'Encrypted payload has ciphertext, IV, and tag'
    );

    // Verify round-trip decryption
    const decrypted = await encryptor.decrypt(encrypted);
    assert(
      decrypted.log_id === log.log_id && decrypted.employee_id === log.employee_id,
      'Decrypt round-trip preserves data',
      `log_id: ${decrypted.log_id}, employee_id: ${decrypted.employee_id}`
    );
  }

  // ---- TEST 3: Online flush — all logs sent and buffer cleared ----
  console.log('\n--- Test 3: Online Flush (5 logs dequeued and POSTed) ---');
  {
    const buffer = new InMemoryBuffer();
    const http = new MockHttpClient();
    const network = new MockNetworkMonitor();
    network.setState('offline');

    const sync = new SyncManager(buffer, http, network, config);
    await sync.init();

    // Queue 5 logs while offline
    for (let i = 0; i < 5; i++) {
      await sync.recordAttendance(generateTestLog(i));
    }

    // Flip to online and manually flush
    network.setState('online');
    const result = await sync.flush();

    assert(
      result.synced_count === 5,
      'All 5 logs synced successfully',
      `synced: ${result.synced_count}`
    );

    const remaining = await sync.getPendingCount();
    assert(
      remaining === 0,
      'Local buffer is empty after flush',
      `remaining: ${remaining}`
    );

    assert(
      http.calls.length === 5,
      'Exactly 5 POST requests made',
      `calls: ${http.calls.length}`
    );

    sync.destroy();
  }

  // ---- TEST 4: Retry logic on 500 error ----
  console.log('\n--- Test 4: Retry Logic (500 → re-queued) ---');
  {
    const buffer = new InMemoryBuffer();
    const http = new MockHttpClient();
    const network = new MockNetworkMonitor();
    network.setState('offline');

    const sync = new SyncManager(buffer, http, network, config);
    await sync.init();

    // Queue 1 log
    await sync.recordAttendance(generateTestLog(99));

    // Set server to return 500
    http.responseOverride = { status: 500, data: { error: 'Internal Server Error' } };

    // Flush should fail but not remove from buffer
    network.setState('online');
    const result = await sync.flush();

    assert(
      result.failed_count > 0,
      'Sync reports failure on 500',
      `failed: ${result.failed_count}`
    );

    const remaining = await sync.getPendingCount();
    assert(
      remaining === 1,
      'Log remains in buffer for retry after 500',
      `remaining: ${remaining}`
    );

    // Now fix the server and retry
    http.responseOverride = null; // Back to 200
    http.calls = [];
    const retryResult = await sync.flush();

    const finalCount = await sync.getPendingCount();
    // After retries, if within maxRetries, it should eventually succeed
    // (retry count was incremented, so it may still work on next flush)
    console.log(`    → After retry: synced=${retryResult.synced_count}, remaining=${finalCount}`);

    sync.destroy();
  }

  // ---- TEST 5: Duplicate detection (409 → removed from buffer) ----
  console.log('\n--- Test 5: Duplicate Detection (409 → cleared) ---');
  {
    const buffer = new InMemoryBuffer();
    const http = new MockHttpClient();
    const network = new MockNetworkMonitor();
    network.setState('offline');

    const sync = new SyncManager(buffer, http, network, config);
    await sync.init();

    const log = generateTestLog(50);
    await sync.recordAttendance(log);

    // Server says "already have this one"
    http.responseOverride = { status: 409, data: { error: 'Duplicate log_id' } };

    network.setState('online');
    await sync.flush();

    const remaining = await sync.getPendingCount();
    assert(
      remaining === 0,
      'Duplicate log removed from buffer on 409',
      `remaining: ${remaining}`
    );

    sync.destroy();
  }

  // ---- SUMMARY ----
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed}/${total_tests} passed, ${failed}/${total_tests} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run
runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
