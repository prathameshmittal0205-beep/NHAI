"""
Shared pytest fixtures for the NHAI test suite.

Provides:
  - Synthetic 112x112 face-like images (normal, low-light, corrupted)
  - Mock embedding databases
  - Mock VideoCapture frame sequences
  - Temporary directory helpers
  - Mock MediaPipe landmark objects for liveness tests
"""

import os
import sys
import math
import shutil
import tempfile
import hashlib
import numpy as np
import cv2
import pytest
from unittest.mock import MagicMock, patch
from types import SimpleNamespace

# Ensure the project root is on sys.path so phase modules can be imported
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


# ============================================================
# Image Fixtures
# ============================================================

@pytest.fixture
def sample_face_112():
    """
    Returns a realistic synthetic 112x112 BGR face-like image with
    simple geometric features (skin tone, eye regions, mouth).
    """
    img = np.full((112, 112, 3), (180, 200, 220), dtype=np.uint8)  # skin tone BGR
    # Draw "eye" circles
    cv2.circle(img, (38, 42), 8, (50, 40, 30), -1)   # left eye
    cv2.circle(img, (74, 42), 8, (50, 40, 30), -1)    # right eye
    # Draw "mouth" line
    cv2.ellipse(img, (56, 80), (18, 8), 0, 0, 180, (60, 50, 120), 2)
    # Draw "nose"
    cv2.line(img, (56, 50), (56, 66), (140, 160, 180), 2)
    return img


@pytest.fixture
def sample_face_large():
    """
    Returns a larger 480x640 BGR image with a synthetic face region,
    suitable for testing MediaPipe detection pathways.
    """
    img = np.full((480, 640, 3), (200, 210, 220), dtype=np.uint8)
    # Central face region
    cv2.rectangle(img, (220, 120), (420, 360), (160, 180, 200), -1)
    cv2.circle(img, (280, 200), 12, (40, 35, 30), -1)   # left eye
    cv2.circle(img, (360, 200), 12, (40, 35, 30), -1)    # right eye
    cv2.ellipse(img, (320, 300), (30, 12), 0, 0, 180, (50, 40, 100), 3)
    return img


@pytest.fixture
def low_light_face_112(sample_face_112):
    """
    Returns a very dark (low-light) version of the 112x112 face image.
    Pixel values are scaled to the 5-30 range to simulate evening conditions.
    """
    dark = (sample_face_112.astype(np.float32) * 0.1).clip(0, 30).astype(np.uint8)
    return dark


@pytest.fixture
def corrupted_image_bytes():
    """Returns raw bytes that are NOT a valid image (for corruption tests)."""
    return b'\x00\x01\x02NOTAJPEG\xff\xd8\xff' * 20


@pytest.fixture
def overexposed_face_112():
    """Returns a blown-out / overexposed 112x112 face image."""
    img = np.full((112, 112, 3), 250, dtype=np.uint8)
    cv2.circle(img, (38, 42), 8, (240, 240, 240), -1)
    cv2.circle(img, (74, 42), 8, (240, 240, 240), -1)
    return img


# ============================================================
# Embedding Fixtures
# ============================================================

@pytest.fixture
def mock_embedding_db():
    """
    Returns a dict simulating face_db.npy contents.
    Keys are person IDs, values are L2-normalized 512-dim vectors.
    """
    rng = np.random.RandomState(42)
    db = {}
    for pid in ["person_A", "person_B", "person_C"]:
        emb = rng.randn(512).astype(np.float32)
        emb /= np.linalg.norm(emb)
        db[pid] = emb
    return db


@pytest.fixture
def matching_embedding(mock_embedding_db):
    """
    Returns an embedding that is very close (cosine ~0.98) to person_A,
    simulating a correct match.
    """
    base = mock_embedding_db["person_A"].copy()
    noise = np.random.RandomState(99).randn(512).astype(np.float32) * 0.02
    emb = base + noise
    emb /= np.linalg.norm(emb)
    return emb


@pytest.fixture
def mismatching_embedding():
    """
    Returns a random 512-dim embedding unlikely to match anyone in the DB.
    """
    rng = np.random.RandomState(123)
    emb = rng.randn(512).astype(np.float32)
    emb /= np.linalg.norm(emb)
    return emb


# ============================================================
# VideoCapture Mock Fixtures
# ============================================================

@pytest.fixture
def mock_video_frames(sample_face_large):
    """
    Returns a list of 40 slightly varied frames simulating a webcam feed.
    Each frame has minor brightness jitter to mimic temporal variation.
    """
    frames = []
    rng = np.random.RandomState(7)
    for i in range(40):
        jitter = rng.randint(-5, 6)
        frame = np.clip(sample_face_large.astype(np.int16) + jitter, 0, 255).astype(np.uint8)
        frames.append(frame)
    return frames


class MockVideoCapture:
    """
    Drop-in replacement for cv2.VideoCapture that yields a fixed frame sequence.
    """
    def __init__(self, frames):
        self._frames = list(frames)
        self._index = 0

    def isOpened(self):
        return True

    def read(self):
        if self._index < len(self._frames):
            frame = self._frames[self._index]
            self._index += 1
            return True, frame
        return False, None

    def release(self):
        pass


@pytest.fixture
def mock_videocapture(mock_video_frames):
    """Returns a MockVideoCapture instance preloaded with 40 frames."""
    return MockVideoCapture(mock_video_frames)


# ============================================================
# Temp Directory Fixtures
# ============================================================

@pytest.fixture
def temp_dir():
    """Provides a temporary directory that is cleaned up after the test."""
    d = tempfile.mkdtemp(prefix="nhai_test_")
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def mock_raw_dataset(temp_dir, sample_face_112):
    """
    Creates a mock raw dataset directory structure with multiple identities:
      temp_dir/raw/
        id_01/  (6 valid images + 1 corrupt)
        id_02/  (3 valid images — below min threshold of 5)
        id_03/  (5 valid images + 1 duplicate)

    Returns the path to the raw directory.
    """
    raw_dir = os.path.join(temp_dir, "raw")

    # Identity 1: 6 unique valid images + 1 corrupt
    id1_dir = os.path.join(raw_dir, "id_01")
    os.makedirs(id1_dir)
    for i in range(6):
        # Add small per-image variation so MD5 hashes differ
        varied = sample_face_112.copy()
        varied[0, 0, 0] = min(255, varied[0, 0, 0] + i)
        cv2.imwrite(os.path.join(id1_dir, f"img_{i}.jpg"), varied)
    # Corrupt file
    with open(os.path.join(id1_dir, "img_corrupt.jpg"), "wb") as f:
        f.write(b"NOT_AN_IMAGE_DATA_12345")

    # Identity 2: only 3 valid images (should be discarded for min_images=5)
    id2_dir = os.path.join(raw_dir, "id_02")
    os.makedirs(id2_dir)
    for i in range(3):
        varied = sample_face_112.copy()
        varied[0, 0, 1] = min(255, varied[0, 0, 1] + i + 50)
        cv2.imwrite(os.path.join(id2_dir, f"img_{i}.jpg"), varied)

    # Identity 3: 5 unique + 1 exact duplicate of img_0
    id3_dir = os.path.join(raw_dir, "id_03")
    os.makedirs(id3_dir)
    for i in range(5):
        varied = sample_face_112.copy()
        varied[0, 0, 2] = min(255, varied[0, 0, 2] + i + 100)
        cv2.imwrite(os.path.join(id3_dir, f"img_{i}.jpg"), varied)
    # Exact copy of img_0 (same pixel content → same MD5)
    shutil.copy2(
        os.path.join(id3_dir, "img_0.jpg"),
        os.path.join(id3_dir, "img_dup.jpg")
    )

    return raw_dir


# ============================================================
# MediaPipe Landmark Mocking Helpers
# ============================================================

def _make_landmark(x, y, z=0.0):
    """Create a SimpleNamespace mimicking a mediapipe NormalizedLandmark."""
    return SimpleNamespace(x=x, y=y, z=z)


def _build_mock_landmarks(num_landmarks=478):
    """
    Builds a mock FaceMesh landmark list with 478 landmarks.
    Positions are spread across a synthetic face on a 640x480 canvas.
    """
    lm_list = []
    for i in range(num_landmarks):
        # Default: center of frame (normalized 0-1)
        lm_list.append(_make_landmark(0.5, 0.5, 0.0))

    # Key landmarks for liveness detection:
    # Nose tip (index 1)
    lm_list[1] = _make_landmark(0.50, 0.52)
    # Chin (index 152)
    lm_list[152] = _make_landmark(0.50, 0.75)
    # Left eye left corner (index 226)
    lm_list[226] = _make_landmark(0.38, 0.40)
    # Right eye right corner (index 446)
    lm_list[446] = _make_landmark(0.62, 0.40)
    # Left mouth corner (index 57)
    lm_list[57] = _make_landmark(0.40, 0.65)
    # Right mouth corner (index 287)
    lm_list[287] = _make_landmark(0.60, 0.65)

    # Left eye EAR landmarks (indices: 362, 385, 387, 263, 373, 380)
    lm_list[362] = _make_landmark(0.58, 0.40)  # outer corner
    lm_list[385] = _make_landmark(0.60, 0.38)  # upper 1
    lm_list[387] = _make_landmark(0.62, 0.38)  # upper 2
    lm_list[263] = _make_landmark(0.65, 0.40)  # inner corner
    lm_list[373] = _make_landmark(0.62, 0.42)  # lower 2
    lm_list[380] = _make_landmark(0.60, 0.42)  # lower 1

    # Right eye EAR landmarks (indices: 33, 160, 158, 133, 153, 144)
    lm_list[33] = _make_landmark(0.35, 0.40)
    lm_list[160] = _make_landmark(0.37, 0.38)
    lm_list[158] = _make_landmark(0.39, 0.38)
    lm_list[133] = _make_landmark(0.42, 0.40)
    lm_list[153] = _make_landmark(0.39, 0.42)
    lm_list[144] = _make_landmark(0.37, 0.42)

    # Mouth landmarks for smile (indices: 61, 291, 13, 14)
    lm_list[61] = _make_landmark(0.40, 0.65)   # left corner
    lm_list[291] = _make_landmark(0.60, 0.65)   # right corner
    lm_list[13] = _make_landmark(0.50, 0.62)    # top lip
    lm_list[14] = _make_landmark(0.50, 0.68)    # bottom lip

    return lm_list


@pytest.fixture
def neutral_landmarks():
    """
    Returns mock landmarks representing a neutral face (eyes open, mouth closed).
    EAR should be high (~0.33), MAR should be low (~0.15).
    """
    lm_list = _build_mock_landmarks()
    # Eyes wide open (upper and lower lids far apart)
    # Already set in _build_mock_landmarks defaults
    # Mouth closed
    lm_list[13] = _make_landmark(0.50, 0.645)   # top lip very close to bottom
    lm_list[14] = _make_landmark(0.50, 0.655)   # bottom lip
    mock = SimpleNamespace(landmark=lm_list)
    return mock


@pytest.fixture
def blink_landmarks():
    """
    Returns mock landmarks representing a blink (eyes nearly closed).
    EAR should be very low (<0.21).
    """
    lm_list = _build_mock_landmarks()
    # Squeeze left eye shut (upper and lower lids nearly touching)
    lm_list[385] = _make_landmark(0.60, 0.400)  # upper almost at center
    lm_list[387] = _make_landmark(0.62, 0.400)
    lm_list[373] = _make_landmark(0.62, 0.401)  # lower almost at center
    lm_list[380] = _make_landmark(0.60, 0.401)

    # Squeeze right eye shut
    lm_list[160] = _make_landmark(0.37, 0.400)
    lm_list[158] = _make_landmark(0.39, 0.400)
    lm_list[153] = _make_landmark(0.39, 0.401)
    lm_list[144] = _make_landmark(0.37, 0.401)

    mock = SimpleNamespace(landmark=lm_list)
    return mock


@pytest.fixture
def smile_landmarks():
    """
    Returns mock landmarks representing a wide smile.
    MAR should be > 0.35 (mouth wide open and corners raised).
    """
    lm_list = _build_mock_landmarks()
    # Wide open mouth: large vertical separation between top and bottom lip
    lm_list[13] = _make_landmark(0.50, 0.58)    # top lip high
    lm_list[14] = _make_landmark(0.50, 0.72)    # bottom lip low
    # Corners still at reasonable distance
    lm_list[61] = _make_landmark(0.38, 0.62)
    lm_list[291] = _make_landmark(0.62, 0.62)
    mock = SimpleNamespace(landmark=lm_list)
    return mock


@pytest.fixture
def head_turn_landmarks():
    """
    Returns mock landmarks representing a head turned significantly to the left
    (yaw > 15 degrees). Achieved by shifting nose tip and one eye laterally.
    """
    lm_list = _build_mock_landmarks()
    # Shift nose significantly to the left
    lm_list[1] = _make_landmark(0.35, 0.52)
    # Shift chin to the left
    lm_list[152] = _make_landmark(0.38, 0.75)
    # Left eye shifts left
    lm_list[226] = _make_landmark(0.25, 0.40)
    # Right eye shifts left
    lm_list[446] = _make_landmark(0.50, 0.40)
    # Left mouth corner shifts left
    lm_list[57] = _make_landmark(0.28, 0.65)
    # Right mouth corner shifts left
    lm_list[287] = _make_landmark(0.48, 0.65)
    mock = SimpleNamespace(landmark=lm_list)
    return mock
