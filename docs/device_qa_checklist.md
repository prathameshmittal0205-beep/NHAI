# NHAI Datalake 3.0 — Physical Device QA Checklist

**Target Device:** Mid-range Android (min 3GB RAM)
**Network Condition:** Field-simulated (Offline → Online)

## 1. App Launch & Initialization
- [ ] Install the `app-release.apk` on the test device.
- [ ] Grant required permissions (Camera, Storage).
- [ ] Verify the **SyncStatusBar** appears at the top.
- [ ] Confirm the status shows **SYNCED TO DATALAKE** (if online) or **OFFLINE MODE** (if airplane mode is on).

## 2. Liveness Challenge Flow
- [ ] Tap **START ATTENDANCE**.
- [ ] **Blink Challenge:** Verify the amber UI appears. Blink when prompted. Confirm transition to the next step.
- [ ] **Smile Challenge:** Smile wide. Confirm transition.
- [ ] **Head Turn Challenge:** Turn head left/right. Confirm successful completion of the liveness phase.

## 3. Recognition & Sunlight Readability
- [ ] Take the device outdoors into direct sunlight.
- [ ] Complete the liveness flow.
- [ ] Verify the **Recognition Result** screen renders correctly.
- [ ] **PASS CRITERIA:** The green success screen (#052E16) with white text is easily readable without squinting. Personnel name and ID are clearly visible.

## 4. Failure & Retry Flow
- [ ] Point the camera at a printed photo (spoof attempt) or a person not in the dataset.
- [ ] Complete the liveness challenges (if possible) or wait for timeout.
- [ ] Verify the **Verification Failed** or **Session Timed Out** red/grey screen appears.
- [ ] Tap **TRY AGAIN** and confirm the flow resets to the camera view.

## 5. Offline Buffer & Sync Test
- [ ] **Enable Airplane Mode** on the device.
- [ ] Complete **3 successful attendance verifications**.
- [ ] Look at the SyncStatusBar: It must read **OFFLINE MODE** with a badge showing **3 PENDING**.
- [ ] **Disable Airplane Mode** (reconnect to WiFi/4G).
- [ ] **Observe:** Within 5-10 seconds, the SyncStatusBar should automatically flush and transition to **SYNCED TO DATALAKE**.
- [ ] **AWS Console Check:** Log into the AWS Console (ap-south-1). Open DynamoDB → `NHAIAttendanceLogs` table. Verify all 3 records are present with the correct timestamps.

## 6. Persistence Edge Case
- [ ] Enable Airplane Mode.
- [ ] Complete 1 successful attendance verification.
- [ ] **Force kill the app** (swipe away from recent apps).
- [ ] Relaunch the app.
- [ ] Verify the SyncStatusBar still shows **1 PENDING** (confirming SQLite persistence).
- [ ] Reconnect to the network and verify it flushes.
