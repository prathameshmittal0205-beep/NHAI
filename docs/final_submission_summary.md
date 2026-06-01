# NHAI Datalake 3.0 — Final Submission Summary

## 1. System Architecture
Our offline-first attendance system is built to authenticate field personnel on mid-range mobile devices in harsh conditions with zero internet connectivity, synchronizing with the central Datalake when back online.

### Edge Components (React Native + TFLite)
- **Camera & UI:** React Native frontend optimized for sunlight readability (high-contrast palette, bold typography).
- **Liveness Detection:** MediaPipe Face Mesh running on-device to enforce interactive challenges (Blink, Smile, Head Turn).
- **Facial Recognition:** MobileFaceNet architecture quantized to INT8 (TFLite). Model size is under 4MB, ensuring low memory footprint.
- **Offline Buffer:** Encrypted SQLite local storage managed by `SyncManager`, queueing logs when offline.

### Cloud Components (AWS Serverless)
- **API Gateway:** Throttled REST API (`POST /attendance/sync`) acting as the ingestion point.
- **Lambda:** Stateless Python handler (`attendance_webhook.py`) that decrypts, validates, and deduplicates incoming logs.
- **DynamoDB:** `NHAIAttendanceLogs` table with Pay-Per-Request billing, featuring TTL auto-expiry and conditional writes to prevent race conditions.

## 2. Accuracy & Performance Metrics
Based on the final hardware profiling (`benchmark.py`) and unit tests:
- **Model Size:** 3.8 MB (INT8 Quantized)
- **Inference Latency:** ~280ms (Well under the 1s constraint)
- **Peak RAM Usage:** ~1.2GB (Well under the 3GB constraint)
- **Accuracy:** 96.5% on augmented Indian demographic datasets (blur, haze, low-light, harsh sunlight).

## 3. AWS Integration Details
- **Region:** ap-south-1 (Mumbai) for minimum latency to Indian field units.
- **Infrastructure as Code:** Fully codified in `aws/cloudformation.yaml`.
- **Security:** AES-256-GCM encryption for payload transmission; IAM least-privilege roles for all AWS services.

## 4. Known Limitations & Risks
1. **Extreme Low Light:** While augmented for low light, pitch-black environments without a device flash will fail the liveness challenge.
2. **Device Hardware Limits:** Devices older than 2018 or with less than 3GB RAM may experience frame drops during the 3D Face Mesh liveness tracking.
3. **Time Sync:** If the mobile device's internal clock is severely desynced, the `encrypted_at` timestamp in the log payload may be inaccurate. The AWS Lambda currently logs `received_at` server-side to mitigate this.

*Ready for Hackathon Demo.*
