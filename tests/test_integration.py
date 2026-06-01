"""
Integration tests for the NHAI end-to-end pipeline.

Simulates a full run: camera capture → liveness detection → face recognition → result.
Validates hard constraints:
  - Latency must stay under 1000ms (hard fail)
  - RAM must stay under 3GB (hard fail)
"""

import os
import sys
import time
import numpy as np
import cv2
import psutil
import pytest
from unittest.mock import MagicMock, patch
from types import SimpleNamespace

# Ensure project root is importable
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Hard constraint thresholds
MAX_LATENCY_MS = 1000.0   # 1 second
MAX_RAM_MB = 3072.0        # 3 GB in MB


# ================================================================
# Integration Test: Full Pipeline Simulation
# ================================================================

class TestEndToEndPipeline:
    """
    Integration tests that wire together the major pipeline stages
    without requiring real hardware (webcam, TFLite model, etc).
    """

    def test_pipeline_data_to_augmentation(self, sample_face_112):
        """
        Integration: Raw image → alignment → augmentation → output image.
        Verifies the full Phase 1 chain.
        """
        from phase1_data_pipeline import get_alignment_matrix, combined_realistic

        # Simulate alignment on a larger canvas
        large_img = np.zeros((480, 640, 3), dtype=np.uint8)
        # Place the face in the center
        large_img[184:296, 264:376] = sample_face_112

        left_eye = (290, 220)
        right_eye = (350, 220)
        M = get_alignment_matrix(left_eye, right_eye, 112, 112)
        aligned = cv2.warpAffine(large_img, M, (112, 112), flags=cv2.INTER_CUBIC)
        assert aligned.shape == (112, 112, 3)

        # Run augmentation
        rgb_aligned = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB)
        augmented = combined_realistic(rgb_aligned)
        assert augmented.shape == (112, 112, 3)
        assert augmented.dtype == np.uint8

    def test_pipeline_liveness_full_sequence(self, sample_face_large):
        """
        Integration: Initialize liveness → feed frames → verify all challenges complete
        (using mocked MediaPipe to avoid real face detection dependency).
        """
        from phase5_liveness import LivenessDetector
        from tests.conftest import _build_mock_landmarks, _make_landmark

        detector = LivenessDetector()
        first_action = detector.start_challenge()
        sequence = list(detector.challenge_sequence)

        # Create a mock FaceMesh result that returns appropriate landmarks
        # for each challenge type
        def make_blink_lm():
            lm_list = _build_mock_landmarks()
            # Close eyes
            for idx in [385, 387]:
                lm_list[idx] = _make_landmark(lm_list[idx].x, 0.400)
            for idx in [373, 380]:
                lm_list[idx] = _make_landmark(lm_list[idx].x, 0.401)
            for idx in [160, 158]:
                lm_list[idx] = _make_landmark(lm_list[idx].x, 0.400)
            for idx in [153, 144]:
                lm_list[idx] = _make_landmark(lm_list[idx].x, 0.401)
            return SimpleNamespace(landmark=lm_list)

        def make_smile_lm():
            lm_list = _build_mock_landmarks()
            lm_list[13] = _make_landmark(0.50, 0.58)
            lm_list[14] = _make_landmark(0.50, 0.72)
            lm_list[61] = _make_landmark(0.38, 0.62)
            lm_list[291] = _make_landmark(0.62, 0.62)
            return SimpleNamespace(landmark=lm_list)

        def make_head_turn_lm():
            lm_list = _build_mock_landmarks()
            lm_list[1] = _make_landmark(0.35, 0.52)
            lm_list[152] = _make_landmark(0.38, 0.75)
            lm_list[226] = _make_landmark(0.25, 0.40)
            lm_list[446] = _make_landmark(0.50, 0.40)
            lm_list[57] = _make_landmark(0.28, 0.65)
            lm_list[287] = _make_landmark(0.48, 0.65)
            return SimpleNamespace(landmark=lm_list)

        challenge_to_landmarks = {
            'blink': make_blink_lm,
            'smile': make_smile_lm,
            'head_turn': make_head_turn_lm,
        }

        # Process each challenge in order by mocking face_mesh.process
        for challenge in sequence:
            lm_factory = challenge_to_landmarks[challenge]

            # Feed frames until this challenge passes
            frames_fed = 0
            max_frames = 50  # safety limit
            while frames_fed < max_frames:
                mock_result = SimpleNamespace(
                    multi_face_landmarks=[lm_factory()]
                )
                with patch.object(detector.face_mesh, 'process', return_value=mock_result):
                    status, next_challenge, msg = detector.process_frame(sample_face_large)

                frames_fed += 1
                if status is True:
                    break
                if status is False:
                    pytest.fail(f"Liveness challenge '{challenge}' failed: {msg}")
                # status is None → keep going (challenge in progress or moved to next)
                if next_challenge != challenge:
                    break  # moved to next challenge

        # After processing all challenges, verify final status
        assert detector.challenge_index >= len(detector.challenge_sequence), \
            "All challenges should have been completed"

    def test_pipeline_embedding_match_flow(self, mock_embedding_db, matching_embedding):
        """
        Integration: Generate embedding → search DB → verify match.
        Simulates the recognition output stage.
        """
        from sklearn.metrics.pairwise import cosine_similarity

        # Simulate the recognition flow from phase6
        best_match = "Unknown"
        best_score = 0.0
        THRESHOLD = 0.65

        for person_id, db_emb in mock_embedding_db.items():
            score = cosine_similarity([matching_embedding], [db_emb])[0][0]
            if score > best_score:
                best_score = score
                best_match = person_id

        assert best_score > THRESHOLD, \
            f"Match score {best_score:.4f} below threshold {THRESHOLD}"
        assert best_match == "person_A"

    def test_pipeline_embedding_reject_unknown(self, mock_embedding_db, mismatching_embedding):
        """
        Integration: Unknown person's embedding → search DB → verify rejection.
        """
        from sklearn.metrics.pairwise import cosine_similarity

        best_score = 0.0
        THRESHOLD = 0.65

        for person_id, db_emb in mock_embedding_db.items():
            score = cosine_similarity([mismatching_embedding], [db_emb])[0][0]
            if score > best_score:
                best_score = score

        assert best_score < THRESHOLD, \
            f"Unknown person scored {best_score:.4f} — should be below {THRESHOLD}"


# ================================================================
# Hardware Constraint Tests
# ================================================================

class TestHardwareConstraints:
    """
    Validates that the pipeline stages meet the hard latency and RAM limits.
    Uses pytest.fail() for hard failures as required.
    """

    def test_alignment_latency_under_limit(self, sample_face_112):
        """Single alignment operation must complete well under 1 second."""
        from phase1_data_pipeline import get_alignment_matrix

        large_img = np.zeros((480, 640, 3), dtype=np.uint8)
        large_img[184:296, 264:376] = sample_face_112

        start = time.perf_counter()
        for _ in range(100):  # Run 100x and take average
            M = get_alignment_matrix(
                left_eye=(290, 220),
                right_eye=(350, 220)
            )
            _ = cv2.warpAffine(large_img, M, (112, 112), flags=cv2.INTER_CUBIC)
        elapsed_ms = ((time.perf_counter() - start) / 100.0) * 1000.0

        if elapsed_ms > MAX_LATENCY_MS:
            pytest.fail(
                f"HARD FAIL: Alignment latency {elapsed_ms:.2f}ms "
                f"exceeds {MAX_LATENCY_MS}ms limit"
            )

    def test_augmentation_latency_under_limit(self, sample_face_112):
        """Full augmentation pipeline must complete under 1 second per image."""
        from phase1_data_pipeline import combined_realistic

        rgb = cv2.cvtColor(sample_face_112, cv2.COLOR_BGR2RGB)

        start = time.perf_counter()
        for _ in range(50):
            _ = combined_realistic(rgb)
        elapsed_ms = ((time.perf_counter() - start) / 50.0) * 1000.0

        if elapsed_ms > MAX_LATENCY_MS:
            pytest.fail(
                f"HARD FAIL: Augmentation latency {elapsed_ms:.2f}ms "
                f"exceeds {MAX_LATENCY_MS}ms limit"
            )

    def test_liveness_detection_latency(self, neutral_landmarks):
        """Liveness landmark analysis must complete under 1 second per frame."""
        from phase5_liveness import LivenessDetector

        detector = LivenessDetector()
        frame_shape = (480, 640, 3)

        start = time.perf_counter()
        for _ in range(100):
            detector.detect_blink(neutral_landmarks, frame_shape)
            detector.detect_smile(neutral_landmarks, frame_shape)
            detector.detect_head_turn(neutral_landmarks, frame_shape)
        elapsed_ms = ((time.perf_counter() - start) / 100.0) * 1000.0

        if elapsed_ms > MAX_LATENCY_MS:
            pytest.fail(
                f"HARD FAIL: Liveness analysis latency {elapsed_ms:.2f}ms "
                f"exceeds {MAX_LATENCY_MS}ms limit"
            )

    def test_embedding_search_latency(self, mock_embedding_db, matching_embedding):
        """Embedding cosine similarity search over 100 identities must be <1s."""
        from sklearn.metrics.pairwise import cosine_similarity

        # Scale up to 100 identities
        rng = np.random.RandomState(42)
        large_db = {}
        for i in range(100):
            emb = rng.randn(512).astype(np.float32)
            emb /= np.linalg.norm(emb)
            large_db[f"person_{i:03d}"] = emb

        start = time.perf_counter()
        for _ in range(50):
            for pid, db_emb in large_db.items():
                _ = cosine_similarity([matching_embedding], [db_emb])[0][0]
        elapsed_ms = ((time.perf_counter() - start) / 50.0) * 1000.0

        if elapsed_ms > MAX_LATENCY_MS:
            pytest.fail(
                f"HARD FAIL: Embedding search latency {elapsed_ms:.2f}ms "
                f"exceeds {MAX_LATENCY_MS}ms limit"
            )

    def test_clahe_latency(self, sample_face_112):
        """CLAHE preprocessing must complete under 1 second."""
        from phase6_inference import apply_clahe

        start = time.perf_counter()
        for _ in range(200):
            _ = apply_clahe(sample_face_112)
        elapsed_ms = ((time.perf_counter() - start) / 200.0) * 1000.0

        if elapsed_ms > MAX_LATENCY_MS:
            pytest.fail(
                f"HARD FAIL: CLAHE latency {elapsed_ms:.2f}ms "
                f"exceeds {MAX_LATENCY_MS}ms limit"
            )

    def test_current_process_ram_under_3gb(self):
        """
        Current test process RAM must be under 3GB.
        This is a canary check — if loading all modules pushes past 3GB,
        the edge device will fail.
        """
        process = psutil.Process(os.getpid())
        ram_mb = process.memory_info().rss / (1024.0 * 1024.0)

        if ram_mb > MAX_RAM_MB:
            pytest.fail(
                f"HARD FAIL: Process RAM {ram_mb:.2f}MB "
                f"exceeds {MAX_RAM_MB:.0f}MB (3GB) limit"
            )

    def test_concurrent_augmentation_ram(self, sample_face_112):
        """
        Running augmentation in a tight loop must not push RAM over 3GB.
        Tests for memory leaks in the augmentation pipeline.
        """
        from phase1_data_pipeline import combined_realistic

        rgb = cv2.cvtColor(sample_face_112, cv2.COLOR_BGR2RGB)
        process = psutil.Process(os.getpid())

        ram_before = process.memory_info().rss / (1024.0 * 1024.0)

        for _ in range(500):
            _ = combined_realistic(rgb)

        ram_after = process.memory_info().rss / (1024.0 * 1024.0)

        if ram_after > MAX_RAM_MB:
            pytest.fail(
                f"HARD FAIL: RAM after 500 augmentations: {ram_after:.2f}MB "
                f"exceeds {MAX_RAM_MB:.0f}MB (3GB) limit"
            )

        # Also check for excessive growth (potential leak)
        ram_growth = ram_after - ram_before
        if ram_growth > 500.0:  # 500MB growth is suspicious
            pytest.fail(
                f"HARD FAIL: RAM grew by {ram_growth:.2f}MB during augmentation loop — "
                f"possible memory leak"
            )

    def test_metrics_computation_latency(self):
        """EER/ROC computation on 1000 samples must be <1s."""
        from metrics_evaluation import compute_roc_eer

        np.random.seed(42)
        y_true = np.concatenate([np.ones(500), np.zeros(500)]).astype(int)
        y_scores = np.concatenate([
            np.random.normal(0.8, 0.1, 500),
            np.random.normal(0.3, 0.1, 500)
        ])

        start = time.perf_counter()
        _ = compute_roc_eer(y_true, y_scores, num_thresholds=1000)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        if elapsed_ms > MAX_LATENCY_MS:
            pytest.fail(
                f"HARD FAIL: Metrics computation latency {elapsed_ms:.2f}ms "
                f"exceeds {MAX_LATENCY_MS}ms limit"
            )
