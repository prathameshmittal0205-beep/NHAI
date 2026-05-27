# ML Architecture Documentation

## Overview
This document details the end-to-end architecture of the Face Recognition and Liveness Detection system. The system uses a lightweight face recognition model optimized for edge devices via TFLite, combined with a robust 3D facial landmark-based liveness detection challenge module.

---

## 1. Data Pipeline & Augmentations (Phase 1)
- **Face Detection:** MediaPipe Face Detection is used for fast and accurate localization.
- **Alignment:** 5-point affine transform based on eye locations. Images are aligned to ensure eye centers are consistently placed horizontally.
- **Preprocessing:** Faces are cropped to 112x112 and normalized to [-1, 1].
- **Augmentation (Albumentations):**
  - `RandomBrightnessContrast` (p=0.5)
  - `CLAHE` (p=0.5) - Contrast Limited Adaptive Histogram Equalization
  - `RandomShadow` (p=0.5)
  - `GaussianBlur` (p=0.5)
  - `CoarseDropout` (p=0.5)

---

## 2. Face Recognition Model (Phase 2 & 3)
### MobileFaceNet (Lightweight)
- **Input:** 112x112x3 RGB image.
- **Architecture Base:** MobileNetV2 style inverted residuals (Linear Bottlenecks).
- **Global Depthwise Convolution:** Used at the end to aggregate spatial features without huge dense layers.
- **Dense Output:** 512-dimensional feature vector.
- **L2 Normalization:** Features are L2 normalized to be mapped onto a unit hypersphere.

### ArcFace Loss
- **Margin:** 0.5 (Angular margin added to the ground truth class).
- **Scale (s):** 64 (Scale factor for logits).
- **Optimizer:** SGD with Momentum (0.9), Weight Decay (5e-4).
- **Learning Rate:** Cosine Decay from 0.1 to 1e-5.

### TFLite & Quantization
- **INT8 Quantization:** Applied post-training using a representative dataset of 200 samples.
- **Size constraint:** Model size is strictly maintained under 20MB.

---

## 3. Liveness Detection Module (Phase 5)
Liveness is ensured through a randomized challenge-response mechanism using **MediaPipe FaceMesh** for 468 dense facial landmarks.

### Metrics Computed
1. **Blink Detection (EAR)**
   - Formula: `(A + B) / (2 * C)` where A, B are vertical distances between eyelids, C is horizontal width.
   - Threshold: EAR < 0.21.
   - Condition: At least 2 frames in a 30-frame window.

2. **Head Turn Detection (Yaw)**
   - Computed via OpenCV's `solvePnP` matching 2D landmarks to an ideal 3D face model.
   - Threshold: Absolute Yaw > 15 degrees.

3. **Smile Detection (MAR & Lip Corner)**
   - Formula: Mouth Aspect Ratio (MAR) > 0.35.
   - Condition: Maintained for at least 10 consecutive frames.

### Challenge System
- Randomized sequence: `['blink', 'smile', 'head_turn']`
- Timeout: 15 seconds to pass all challenges.
- Immediate rejection upon failure or timeout.

---

## 4. Inference Pipeline (Phase 6)
1. **Liveness Validation:** Frames are passed to the liveness detector. 
2. **Preprocessing:** Upon passing liveness, the face is aligned and enhanced via CLAHE (L-channel).
3. **Inference:** Forward pass through the INT8 TFLite model.
4. **Matching:** Cosine similarity against `face_db.npy`.
5. **Decision:** Match if Similarity > 0.65.
