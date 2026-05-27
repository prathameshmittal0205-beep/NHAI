# Biometric Security & Anti-Spoof Testing Protocol

This document defines the stress-testing methodologies and evaluation protocols to validate the active liveness detection module of the offline face authentication system. All tests are designed to run locally and comply with the hackathon's offline-only, high-demographic-accuracy constraints.

---

## 1. Active Liveness Challenges

Liveness validation uses **MediaPipe FaceMesh** (468 dense 3D landmarks) to track user movement and features over a randomized challenge sequence:

### A. Blink Detection (Eye Aspect Ratio - EAR)
*   **Formula**: $EAR = \frac{||p_2 - p_6|| + ||p_3 - p_5||}{2 \times ||p_1 - p_4||}$ where landmarks correspond to:
    *   Left Eye: $p_1=33$ (corner), $p_2=160, p_3=158$ (upper), $p_4=133$ (corner), $p_5=153, p_6=144$ (lower).
    *   Right Eye: $p_1=362$ (corner), $p_2=385, p_3=387$ (upper), $p_4=263$ (corner), $p_5=373, p_6=380$ (lower).
*   **Threshold**: $EAR < 0.21$ for a minimum of 2 frames and maximum of 10 frames within a 30-frame window.

### B. Smile Detection (Mouth Aspect Ratio - MAR)
*   **Formula**: $MAR = \frac{||p_{51} - p_{57}||}{||p_{49} - p_{55}||}$ where landmarks correspond to:
    *   Lips: $p_{49}=78$ (left corner), $p_{55}=308$ (right corner), $p_{51}=13$ (upper lip center), $p_{57}=14$ (lower lip center).
*   **Threshold**: $MAR > 0.35$ sustained for at least 10 consecutive frames.

### C. Head Turn Detection (Yaw Angle)
*   **Formula**: Derived from OpenCV's `solvePnP` using 2D landmarks (nose tip, chin, eye corners, mouth corners) matched to a 3D generic facial model.
*   **Threshold**: Absolute Yaw $> 15^\circ$ (left or right, depending on challenge prompt) maintained for 5 frames.

---

## 2. Spoof Attack Testing Procedures

The active challenges must be evaluated against two main physical spoofing vectors: **Printed Photo Attacks** and **Replay/Screen Attacks**.

```
                         SPOOF TESTING FRAMEWORK
                         
      [Printed Photo Attack]                    [Replay/Screen Attack]
     - High-Res A4 Printout                    - High-Res Screen (Phone/Tablet)
     - Flat plane, zero depth                  - Active display refresh (moire)
     - Statics & rigid movement                - Reflections, polarized light
               |                                           |
               +-------------------+-----------------------+
                                   |
                                   v
                      [Active Liveness Validation]
                        - Blink Detection (EAR)
                        - Smile Aspect Ratio (MAR)
                        - 3D Head Pose (Yaw/Pitch)
                                   |
                                   v
                      [Secure Decision Engine]
                         - FAR Target < 0.1%
                         - Rejection if Spoof
```

### A. Printed Photo Attack
*   **Description**: A high-resolution color printout of an authorized user is presented to the system to bypass authentication.
*   **Test Setup**:
    1.  **Printout Specification**: Print a high-resolution frontal portrait of the subject on A4 photographic paper (matte and glossy finishes tested separately) at 300+ DPI.
    2.  **Mounting**: Mount the printout on a rigid, flat board to prevent warping, and attach a rod to control distance/angles.
    3.  **Lighting Conditions**: Test under three lighting setups: direct overhead sunlight (outdoor simulation), low light (<10 lux), and ambient indoor lighting.
    4.  **Distance**: Place the card at distances ranging from 30 cm to 80 cm from the camera.
*   **Test Procedure**:
    1.  Start the authentication challenge.
    2.  Present the printed photo card directly in front of the camera, completely filling the face area.
    3.  Hold the card static for 5 seconds to test static threshold rejection.
    4.  Translate the card (move side-to-side, up-and-down).
    5.  Rotate the card slightly (yaw/pitch) to simulate a head turn, trying to satisfy the head-turn challenge.
*   **Pass/Fail Criteria**:
    *   **FAIL**: The system authenticates the printout, or fails to reject it within 15 seconds.
    *   **PASS**: The system detects the lack of movement (e.g. zero blink, zero smile variance) and flags a liveness failure, or the timeout rejects the attempt.
*   **Security Target**:
    *   **False Acceptance Rate (FAR)**: **< 0.1%** (zero matches allowed in 1,000 trials).

### B. Replay / Screen Attack
*   **Description**: A high-definition video of the authorized user performing the challenges (or a generic loop) is played on a phone or tablet screen and held in front of the authentication camera.
*   **Test Setup**:
    1.  **Replay Device**: Use a high-brightness tablet (e.g., iPad or Galaxy Tab, >400 nits) and a modern smartphone screen.
    2.  **Source Video**: Record a 1080p 60fps video of the authentic user performing eye blinks, smiles, and head turns.
    3.  **Positioning**: Mount the replay device at 30–60 cm from the camera, aligned with the lens.
*   **Test Procedure**:
    1.  Start the authentication challenge.
    2.  Play the prerecorded video loop on the replay device.
    3.  Align the video face with the detection window.
    4.  Attempt to synchronize the replayed video actions (blinking, smiling, turning head) with the randomized prompts displayed by the system.
*   **Pass/Fail Criteria**:
    *   **FAIL**: The system accepts the replayed video and grants access.
    *   **PASS**: The system successfully rejects the video due to passive texture cues, screen moiré patterns (interference), reflection, or lack of 3D depth consistency.
*   **Security Target**:
    *   **False Acceptance Rate (FAR)**: **< 0.1%** (zero matches allowed in 1,000 trials).

---

## 3. Passive Anti-Spoof Safeguards

To prevent replay and print attacks from spoofing the active challenges, the system integrates the following passive defenses:

1.  **3D Depth Inconsistency Check**: Because photos and screens are flat 2D surfaces, when they are rotated, the relative depth of landmarks (e.g., nose tip relative to ears) changes mathematically in a way that differs from a true 3D face. The head turn solver rejects rotation vectors that do not match the expected 3D facial structure.
2.  **Moiré Pattern Detection**: High-frequency grid patterns generated by screen pixels (moiré) are checked in the pre-processing stage using a fast Fourier transform (FFT) or standard Laplacian variance.
3.  **Reflection & Specular Highlights Analysis**: Screens and glossy prints create telltale glare points. The pre-processing pipeline checks for static or overly large bright blobs that do not shift naturally with face shape changes.
