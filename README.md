# NHAI Datalake 3.0 — Offline Facial Recognition & Attendance System

> 🌐 **Live Website:** https://facedatalake.vercel.app

An edge-deployed offline facial recognition and liveness detection system built for NHAI field operations.
Sub-second inference. Zero connectivity required. AES-256 encrypted sync to AWS when online.

---

## Architecture

```text
┌─────────────────────┐       Offline       ┌─────────────────────┐
│   React Native App  │ ──────────────────> │   Local SQLite DB   │
│ ─────────────────── │   (Encrypted log)   │ ─────────────────── │
│ - Camera Feed       │                     │ - Queue Buffer      │
│ - Liveness (Mesh)   │                     │ - Embeddings Cache  │
│ - FaceRec (TFLite)  │                     └─────────────────────┘
└─────────────────────┘                                │
          │                                            │
          │ Sync (Online)                              │ Auto-flush
          ▼                                            ▼
┌─────────────────────┐                     ┌─────────────────────┐
│   API Gateway (AWS) │ ──────────────────> │   AWS Lambda        │
│ ─────────────────── │   (POST /sync)      │ ─────────────────── │
│ - Throttling        │                     │ - Decrypt Payload   │
│ - Auth Routing      │                     │ - Validate dedupe   │
└─────────────────────┘                     └─────────────────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────────┐
                                            │    DynamoDB         │
                                            │ ─────────────────── │
                                            │ - NHAIAttendanceLogs│
                                            │ - TTL Expiry        │
                                            └─────────────────────┘
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and Yarn/NPM
- Python 3.9+
- Android Studio & SDK (for physical device deploy)
- AWS CLI configured locally (`aws configure`)

### 1. ML Backend & Testing (Python)
Ensure all Python dependencies are installed:
```bash
pip install -r requirements.txt
```
To run the full suite of unit and integration tests (including RAM & latency benchmarks):
```bash
pytest tests/
```

### 2. React Native App (Frontend & Edge AI)
Install NPM dependencies:
```bash
npm install
```
Start the Metro bundler:
```bash
npm start
```

## Build & Run (Android)
To build the app and deploy it to a physical Android device connected via USB:
```bash
npm run android
```
*Note: iOS is currently unsupported due to the specific JNI bindings in the Android TFLite FaceRecognition module.*

## AWS Deployment
The AWS infrastructure is fully codified as a CloudFormation stack.
To deploy to the `prod` environment:
```bash
./aws/deploy.sh prod
```
*Windows Users: Use `powershell -File aws\deploy.ps1 prod`*

Once deployed, the script will output the API Gateway URL. 
Update `src/config/env.ts` with this URL under the `prod` key.

## Security Features
- **Zero Hardcoded Secrets**: All config is stored in `env.ts`.
- **AES-256-GCM Encryption**: Every attendance log is encrypted on the device using `react-native-quick-crypto` before ever touching the local SQLite disk buffer.
- **Session Checkpointing**: If the app is force-killed during a liveness challenge, the session state is recovered on restart via `AsyncStorage`.

## Known Limitations
1. **Low-Light Failure**: The MobileFaceNet model will struggle in pitch-black environments without device flash.
2. **Device Hardware Limits**: Android devices with <3GB RAM may experience thermal throttling during sustained 3D Face Mesh liveness tracking.
3. **Time Sync**: If the device's clock is fully desynced while offline, the payload `encrypted_at` timestamp will be inaccurate (Lambda logs the server-side `received_at` to compensate).

## 🌐 Live Website

The project has a live interactive website showcasing all features:

**https://facedatalake.vercel.app**

| Page | Description |
|------|-------------|
| `/` | Homepage with architecture diagram and system overview |
| `/demo` | Live in-browser face registration and liveness verification |
| `/dashboard` | Mock attendance dashboard with AWS sync simulation |
| `/about` | Technical deep-dive, build phases, and accuracy metrics |

> Built with Next.js, deployed on Vercel. The demo runs 100% in the browser using face-api.js — no backend required.
