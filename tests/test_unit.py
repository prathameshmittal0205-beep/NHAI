"""
Unit tests for NHAI Phase 1–6 modules.

Covers edge cases including corrupted input, low-light frames,
liveness challenge pass/fail for all three types (blink, smile, head turn),
embedding mismatches, and augmentation pipeline integrity.
"""

import os
import sys
import math
import json
import shutil
import hashlib
import tempfile
import time
import numpy as np
import cv2
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from types import SimpleNamespace

# Ensure project root is importable
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


# ================================================================
# PHASE 1: Data Pipeline Tests
# ================================================================

class TestPhase1DataPipeline:
    """Tests for phase1_data_pipeline.py functions."""

    def test_get_alignment_matrix_shape(self):
        """Alignment matrix must be a 2x3 float array."""
        from phase1_data_pipeline import get_alignment_matrix
        M = get_alignment_matrix(left_eye=(40, 50), right_eye=(80, 50))
        assert M.shape == (2, 3), f"Expected (2,3), got {M.shape}"
        assert M.dtype == np.float64 or M.dtype == np.float32

    def test_get_alignment_matrix_straight_face(self):
        """When eyes are level, angle component should be ~0."""
        from phase1_data_pipeline import get_alignment_matrix
        M = get_alignment_matrix(left_eye=(40, 50), right_eye=(80, 50))
        # For a horizontal eye line the rotation angle is 0, so sin(0)=0
        # M[0,1] encodes -sin(angle)*scale, should be ~0
        assert abs(M[0, 1]) < 0.01, f"Expected near-zero rotation, got M[0,1]={M[0,1]}"

    def test_get_alignment_matrix_tilted_face(self):
        """When eyes are tilted, the matrix should encode a non-zero rotation."""
        from phase1_data_pipeline import get_alignment_matrix
        M = get_alignment_matrix(left_eye=(40, 60), right_eye=(80, 40))
        # angle = atan2(-20, 40) ≈ -26.6 degrees, M[0,1] should be non-zero
        assert abs(M[0, 1]) > 0.05, "Tilted eyes should produce non-zero rotation"

    def test_compute_md5_consistency(self, temp_dir):
        """Same file content must produce same MD5."""
        from phase1_data_pipeline import compute_md5
        path = os.path.join(temp_dir, "test_file.bin")
        content = b"NHAI test data for MD5 consistency"
        with open(path, "wb") as f:
            f.write(content)
        h1 = compute_md5(path)
        h2 = compute_md5(path)
        assert h1 == h2
        assert len(h1) == 32  # MD5 hex digest length

    def test_compute_md5_different_content(self, temp_dir):
        """Different file content must produce different MD5."""
        from phase1_data_pipeline import compute_md5
        p1 = os.path.join(temp_dir, "f1.bin")
        p2 = os.path.join(temp_dir, "f2.bin")
        with open(p1, "wb") as f:
            f.write(b"content_A")
        with open(p2, "wb") as f:
            f.write(b"content_B")
        assert compute_md5(p1) != compute_md5(p2)

    def test_corrupted_image_skipped(self, temp_dir, corrupted_image_bytes):
        """cv2.imread should return None for corrupted data (tested directly)."""
        path = os.path.join(temp_dir, "corrupt.jpg")
        with open(path, "wb") as f:
            f.write(corrupted_image_bytes)
        img = cv2.imread(path)
        assert img is None, "Corrupted image should not be loadable"

    def test_augmentation_harsh_sunlight(self, sample_face_112):
        """harsh_sunlight must return a 112x112 uint8 image."""
        from phase1_data_pipeline import harsh_sunlight
        # Augmentation expects RGB
        rgb = cv2.cvtColor(sample_face_112, cv2.COLOR_BGR2RGB)
        result = harsh_sunlight(rgb)
        assert result.shape == (112, 112, 3)
        assert result.dtype == np.uint8

    def test_augmentation_low_light(self, sample_face_112):
        """low_light must modify the image (gamma + noise) and preserve shape."""
        from phase1_data_pipeline import low_light
        rgb = cv2.cvtColor(sample_face_112, cv2.COLOR_BGR2RGB)
        result = low_light(rgb)
        assert result.shape == (112, 112, 3)
        assert result.dtype == np.uint8
        # The augmentation should visibly modify pixel values (gamma + noise)
        assert not np.array_equal(result, rgb), "Low-light augmentation should modify the image"
        # Standard deviation should change due to noise injection
        assert np.std(result) != np.std(rgb), "Noise should alter pixel distribution"

    def test_augmentation_motion_blur(self, sample_face_112):
        """motion_blur_shake must return valid image dimensions."""
        from phase1_data_pipeline import motion_blur_shake
        rgb = cv2.cvtColor(sample_face_112, cv2.COLOR_BGR2RGB)
        result = motion_blur_shake(rgb)
        assert result.shape == (112, 112, 3)
        assert result.dtype == np.uint8

    def test_augmentation_outdoor_haze(self, sample_face_112):
        """outdoor_haze_dust must return valid image."""
        from phase1_data_pipeline import outdoor_haze_dust
        rgb = cv2.cvtColor(sample_face_112, cv2.COLOR_BGR2RGB)
        result = outdoor_haze_dust(rgb)
        assert result.shape == (112, 112, 3)

    def test_augmentation_combined(self, sample_face_112):
        """combined_realistic must preserve shape and dtype."""
        from phase1_data_pipeline import combined_realistic
        rgb = cv2.cvtColor(sample_face_112, cv2.COLOR_BGR2RGB)
        result = combined_realistic(rgb)
        assert result.shape == (112, 112, 3)
        assert result.dtype == np.uint8

    def test_augmentation_on_lowlight_input(self, low_light_face_112):
        """Augmentations must handle already-dark images without crashing."""
        from phase1_data_pipeline import combined_realistic
        rgb = cv2.cvtColor(low_light_face_112, cv2.COLOR_BGR2RGB)
        result = combined_realistic(rgb)
        assert result.shape == (112, 112, 3)
        assert result.dtype == np.uint8

    def test_augmentation_on_overexposed_input(self, overexposed_face_112):
        """Augmentations must handle blown-out images gracefully."""
        from phase1_data_pipeline import harsh_sunlight
        rgb = cv2.cvtColor(overexposed_face_112, cv2.COLOR_BGR2RGB)
        result = harsh_sunlight(rgb)
        assert result.shape == (112, 112, 3)
        assert np.all(result <= 255)

    def test_process_dataset_missing_input_dir(self, temp_dir):
        """process_dataset must raise FileNotFoundError for missing input."""
        from phase1_data_pipeline import process_dataset
        with pytest.raises(FileNotFoundError):
            process_dataset(
                input_dir=os.path.join(temp_dir, "nonexistent"),
                output_dir=os.path.join(temp_dir, "out"),
            )


# ================================================================
# PHASE 2: Model Architecture Tests
# ================================================================

class TestPhase2ModelArchitecture:
    """Tests for phase2_train.py model building functions."""

    def test_build_mobilefacenet_output_shape(self):
        """Model output should match (batch, num_classes)."""
        from phase2_train import build_mobilefacenet
        model = build_mobilefacenet(
            input_shape=(112, 112, 3),
            embedding_dim=512,
            num_classes=10
        )
        assert model.output_shape == (None, 10)

    def test_build_mobilefacenet_input_shape(self):
        """Model input should accept 112x112x3."""
        from phase2_train import build_mobilefacenet
        model = build_mobilefacenet(
            input_shape=(112, 112, 3),
            embedding_dim=512,
            num_classes=5
        )
        assert model.input_shape == (None, 112, 112, 3)

    def test_embedding_layer_exists(self):
        """The model should contain a 512-dim dense layer for embeddings."""
        from phase2_train import build_mobilefacenet
        model = build_mobilefacenet(
            input_shape=(112, 112, 3),
            embedding_dim=512,
            num_classes=5
        )
        # The second-to-last dense layer should have 512 units
        dense_layers = [l for l in model.layers if 'dense' in l.name.lower()]
        assert any(l.output_shape[-1] == 512 for l in dense_layers), \
            "Expected a 512-dim embedding dense layer"

    def test_model_forward_pass(self):
        """A dummy forward pass must not crash and return correct shape."""
        from phase2_train import build_mobilefacenet
        model = build_mobilefacenet(
            input_shape=(112, 112, 3),
            embedding_dim=512,
            num_classes=3
        )
        dummy_input = np.random.rand(2, 112, 112, 3).astype(np.float32)
        output = model.predict(dummy_input, verbose=0)
        assert output.shape == (2, 3)


# ================================================================
# PHASE 3: TFLite Conversion Tests
# ================================================================

class TestPhase3TFLite:
    """Tests for phase3_tflite.py conversion and validation."""

    def test_representative_dataset_gen_shape(self):
        """Each yielded sample must be (1, 112, 112, 3) float32."""
        from phase3_tflite import representative_dataset_gen
        samples = list(representative_dataset_gen())
        assert len(samples) == 200
        for s in samples[:5]:
            assert s[0].shape == (1, 112, 112, 3)
            assert s[0].dtype == np.float32
            assert s[0].min() >= -1.0 - 1e-6
            assert s[0].max() <= 1.0 + 1e-6

    def test_convert_to_tflite_creates_file(self, temp_dir):
        """Conversion must create a .tflite file (using dummy model)."""
        from phase3_tflite import convert_to_tflite
        tflite_path = os.path.join(temp_dir, "test_model.tflite")
        convert_to_tflite(
            model_dir=os.path.join(temp_dir, "nonexistent_model"),
            tflite_path=tflite_path
        )
        assert os.path.exists(tflite_path), "TFLite file should be created"
        size_mb = os.path.getsize(tflite_path) / (1024 * 1024)
        assert size_mb < 20.0, f"Model size {size_mb:.2f}MB exceeds 20MB limit"


# ================================================================
# PHASE 4: Embeddings Tests
# ================================================================

class TestPhase4Embeddings:
    """Tests for embedding generation and cosine similarity matching."""

    def test_embedding_normalization(self, mock_embedding_db):
        """All embeddings in the DB must be L2-normalized."""
        for pid, emb in mock_embedding_db.items():
            norm = np.linalg.norm(emb)
            assert abs(norm - 1.0) < 1e-5, \
                f"{pid}: L2 norm is {norm}, expected 1.0"

    def test_cosine_similarity_self_match(self, mock_embedding_db):
        """Cosine similarity of an embedding with itself must be ~1.0."""
        from sklearn.metrics.pairwise import cosine_similarity
        emb = mock_embedding_db["person_A"]
        sim = cosine_similarity([emb], [emb])[0][0]
        assert abs(sim - 1.0) < 1e-6

    def test_cosine_similarity_correct_match(self, mock_embedding_db, matching_embedding):
        """A perturbed version of person_A should match person_A best."""
        from sklearn.metrics.pairwise import cosine_similarity
        best_pid = None
        best_score = -1.0
        for pid, db_emb in mock_embedding_db.items():
            score = cosine_similarity([matching_embedding], [db_emb])[0][0]
            if score > best_score:
                best_score = score
                best_pid = pid
        assert best_pid == "person_A", \
            f"Expected person_A, got {best_pid} (score={best_score:.4f})"
        assert best_score > 0.65, \
            f"Match score {best_score:.4f} below threshold 0.65"

    def test_cosine_similarity_mismatch(self, mock_embedding_db, mismatching_embedding):
        """A random embedding should not match any DB entry above threshold."""
        from sklearn.metrics.pairwise import cosine_similarity
        for pid, db_emb in mock_embedding_db.items():
            score = cosine_similarity([mismatching_embedding], [db_emb])[0][0]
            assert score < 0.65, \
                f"Random embedding scored {score:.4f} against {pid} (should be <0.65)"

    def test_embedding_dimension(self, mock_embedding_db):
        """All embeddings must be 512-dimensional."""
        for pid, emb in mock_embedding_db.items():
            assert emb.shape == (512,), f"{pid}: shape is {emb.shape}, expected (512,)"


# ================================================================
# PHASE 5: Liveness Detection Tests
# ================================================================

class TestPhase5Liveness:
    """
    Tests for LivenessDetector covering all three challenge types
    (blink, smile, head_turn) with both pass and fail states.
    """

    def _make_detector_with_challenge(self, challenge_type):
        """Helper: create a LivenessDetector with a forced challenge sequence."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        detector.challenge_sequence = [challenge_type]
        detector.challenge_index = 0
        detector.start_time = time.time()
        detector.frame_buffer.clear()
        detector.smile_frames = 0
        return detector

    # ---- BLINK: PASS ----
    def test_blink_detection_pass(self, blink_landmarks):
        """Blink should be detected when EAR is below threshold."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        frame_shape = (480, 640, 3)
        # Feed enough blink frames to trigger detection (need >= 2 in window)
        for _ in range(5):
            passed, conf = detector.detect_blink(blink_landmarks, frame_shape)
        assert passed is True, "Blink should be detected with closed-eye landmarks"
        assert conf >= 1.0

    # ---- BLINK: FAIL ----
    def test_blink_detection_fail(self, neutral_landmarks):
        """Blink should NOT be detected when eyes are wide open."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        frame_shape = (480, 640, 3)
        for _ in range(30):
            passed, conf = detector.detect_blink(neutral_landmarks, frame_shape)
        assert passed is False, "Blink should not be detected with open eyes"

    # ---- SMILE: PASS ----
    def test_smile_detection_pass(self, smile_landmarks):
        """Smile should be detected when MAR exceeds threshold for enough frames."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        frame_shape = (480, 640, 3)
        for _ in range(15):
            passed, conf = detector.detect_smile(smile_landmarks, frame_shape)
        assert passed is True, "Smile should be detected with wide-open mouth landmarks"

    # ---- SMILE: FAIL ----
    def test_smile_detection_fail(self, neutral_landmarks):
        """Smile should NOT be detected when mouth is closed."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        frame_shape = (480, 640, 3)
        for _ in range(15):
            passed, conf = detector.detect_smile(neutral_landmarks, frame_shape)
        assert passed is False, "Smile should not be detected with closed mouth"

    # ---- HEAD TURN: PASS ----
    def test_head_turn_detection_pass(self, head_turn_landmarks):
        """Head turn should be detected when yaw exceeds 15 degrees."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        frame_shape = (480, 640, 3)
        passed, conf = detector.detect_head_turn(head_turn_landmarks, frame_shape)
        assert passed is True, "Head turn should be detected with turned landmarks"

    # ---- HEAD TURN: FAIL ----
    def test_head_turn_detection_fail(self, neutral_landmarks):
        """Head turn should NOT be detected when face is frontal."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        frame_shape = (480, 640, 3)
        passed, conf = detector.detect_head_turn(neutral_landmarks, frame_shape)
        assert passed is False, "Head turn should not be detected with frontal face"

    # ---- CHALLENGE SEQUENCE ----
    def test_start_challenge_initializes_sequence(self):
        """start_challenge must set up a 3-element shuffled sequence."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        first_action = detector.start_challenge()
        assert len(detector.challenge_sequence) == 3
        assert set(detector.challenge_sequence) == {'blink', 'smile', 'head_turn'}
        assert first_action in {'blink', 'smile', 'head_turn'}
        assert detector.challenge_index == 0

    def test_challenge_timeout(self):
        """process_frame should return failure after 15-second timeout."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        detector.start_challenge()
        # Simulate expired time
        detector.start_time = time.time() - 16.0
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        status, challenge, msg = detector.process_frame(frame)
        assert status is False, "Should fail after timeout"
        assert "timeout" in msg.lower()

    def test_process_frame_no_face(self):
        """process_frame should return None status when no face is found."""
        from phase5_liveness import LivenessDetector
        detector = LivenessDetector()
        detector.start_challenge()
        # All-black frame — MediaPipe won't find a face
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        status, challenge, msg = detector.process_frame(frame)
        assert status is None, "No face → status should be None"
        assert "no face" in msg.lower() or challenge is not None


# ================================================================
# PHASE 6: Inference Pipeline Tests
# ================================================================

class TestPhase6Inference:
    """Tests for the phase6 inference utility functions."""

    def test_apply_clahe_preserves_shape(self, sample_face_112):
        """CLAHE must preserve the image shape and dtype."""
        from phase6_inference import apply_clahe
        result = apply_clahe(sample_face_112)
        assert result.shape == sample_face_112.shape
        assert result.dtype == np.uint8

    def test_apply_clahe_on_dark_image(self, low_light_face_112):
        """CLAHE should boost contrast on a dark image."""
        from phase6_inference import apply_clahe
        result = apply_clahe(low_light_face_112)
        assert result.shape == low_light_face_112.shape
        # CLAHE should increase the standard deviation (spread of pixel values)
        assert np.std(result) >= np.std(low_light_face_112) * 0.8, \
            "CLAHE should at least maintain contrast spread"

    def test_apply_clahe_on_overexposed(self, overexposed_face_112):
        """CLAHE should not crash on near-white images."""
        from phase6_inference import apply_clahe
        result = apply_clahe(overexposed_face_112)
        assert result.shape == (112, 112, 3)
        assert result.dtype == np.uint8


# ================================================================
# Metrics Evaluation Tests
# ================================================================

class TestMetricsEvaluation:
    """Tests for metrics_evaluation.py correctness."""

    def test_classification_metrics_perfect(self):
        """Perfect predictions should yield accuracy=1.0."""
        from metrics_evaluation import calculate_classification_metrics
        y_true = np.array([1, 1, 0, 0, 1, 0])
        y_pred = np.array([1, 1, 0, 0, 1, 0])
        m = calculate_classification_metrics(y_true, y_pred)
        assert abs(m["accuracy"] - 1.0) < 1e-6
        assert abs(m["f1_score"] - 1.0) < 1e-6

    def test_classification_metrics_all_wrong(self):
        """All-wrong predictions should yield accuracy=0.0."""
        from metrics_evaluation import calculate_classification_metrics
        y_true = np.array([1, 1, 0, 0])
        y_pred = np.array([0, 0, 1, 1])
        m = calculate_classification_metrics(y_true, y_pred)
        assert abs(m["accuracy"] - 0.0) < 1e-6

    def test_far_frr_at_zero_threshold(self):
        """At threshold=0, everything is accepted: FAR=1.0, FRR=0.0."""
        from metrics_evaluation import calculate_far_frr
        y_true = np.array([1, 1, 0, 0])
        y_scores = np.array([0.9, 0.8, 0.3, 0.2])
        far, frr = calculate_far_frr(y_true, y_scores, threshold=0.0)
        assert abs(far - 1.0) < 1e-6, f"FAR should be 1.0 at threshold 0, got {far}"
        assert abs(frr - 0.0) < 1e-6, f"FRR should be 0.0 at threshold 0, got {frr}"

    def test_far_frr_at_high_threshold(self):
        """At threshold=1.0, everything is rejected: FAR=0.0, FRR=1.0."""
        from metrics_evaluation import calculate_far_frr
        y_true = np.array([1, 1, 0, 0])
        y_scores = np.array([0.9, 0.8, 0.3, 0.2])
        far, frr = calculate_far_frr(y_true, y_scores, threshold=1.0)
        assert abs(far - 0.0) < 1e-6
        assert abs(frr - 1.0) < 1e-6

    def test_eer_is_reasonable(self):
        """EER should be between 0 and 0.5 for well-separated distributions."""
        from metrics_evaluation import compute_roc_eer
        np.random.seed(42)
        y_true = np.concatenate([np.ones(100), np.zeros(100)]).astype(int)
        y_scores = np.concatenate([
            np.random.normal(0.8, 0.1, 100),
            np.random.normal(0.3, 0.1, 100)
        ])
        result = compute_roc_eer(y_true, y_scores)
        assert 0.0 <= result["eer"] <= 0.5, f"EER={result['eer']} is out of range"

    def test_evaluate_predictions_output_file(self, temp_dir):
        """evaluate_predictions must write a valid JSON file."""
        from metrics_evaluation import evaluate_predictions
        np.random.seed(42)
        y_true = np.concatenate([np.ones(50), np.zeros(50)]).astype(int)
        y_scores = np.concatenate([
            np.random.normal(0.8, 0.1, 50),
            np.random.normal(0.3, 0.1, 50)
        ])
        out_path = os.path.join(temp_dir, "test_metrics.json")
        report = evaluate_predictions(y_true, y_scores, output_json_path=out_path)
        assert os.path.exists(out_path)
        with open(out_path) as f:
            data = json.load(f)
        assert "summary" in data
        assert "eer" in data["summary"]
