import os
import cv2
import numpy as np
import mediapipe as mp
import albumentations as A
import argparse
import hashlib
import json
import random
import math
import logging
import warnings
from glob import glob
from tqdm import tqdm
from typing import Dict, List, Tuple, Any, Optional

# Suppress UserWarnings from Albumentations regarding ShiftScaleRotate
warnings.filterwarnings("ignore", category=UserWarning)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("Phase1Pipeline")

# Import MediaPipe Face Detection
from mediapipe.python.solutions import face_detection as mp_face_detection

def get_alignment_matrix(
    left_eye: Tuple[int, int],
    right_eye: Tuple[int, int],
    desired_face_width: int = 112,
    desired_face_height: int = 112
) -> np.ndarray:
    """
    Computes an affine transform matrix to align the face based on eye centers.

    Args:
        left_eye: (x, y) coordinates of the left eye in the image.
        right_eye: (x, y) coordinates of the right eye in the image.
        desired_face_width: Desired output face image width in pixels.
        desired_face_height: Desired output face image height in pixels.

    Returns:
        A 2x3 affine transformation matrix.
    """
    # Compute the center of the eyes
    eyes_center = ((left_eye[0] + right_eye[0]) // 2, (left_eye[1] + right_eye[1]) // 2)
    
    # Compute angle between eyes (angle of line connecting eyes relative to horizontal)
    dy = right_eye[1] - left_eye[1]
    dx = right_eye[0] - left_eye[0]
    angle = math.degrees(math.atan2(dy, dx))
    
    # Compute distance between eyes
    dist = math.sqrt(dx**2 + dy**2)
    
    # Desired distance between eyes (assuming eyes are at roughly 35% of the face width)
    desired_dist = desired_face_width * 0.35
    scale = desired_dist / dist if dist > 0 else 1.0
    
    # Get rotation matrix
    M = cv2.getRotationMatrix2D(eyes_center, angle, scale)
    
    # Adjust translation to center the face
    # We want the eyes center to be at (width/2, height * 0.35)
    tX = desired_face_width * 0.5
    tY = desired_face_height * 0.35
    
    M[0, 2] += (tX - eyes_center[0])
    M[1, 2] += (tY - eyes_center[1])
    
    return M

def compute_md5(file_path: str) -> str:
    """
    Computes the MD5 checksum of a file.

    Args:
        file_path: Path to the file.

    Returns:
        The MD5 hex digest string.
    """
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        # Read in chunks of 4096 bytes to avoid loading huge files in memory
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

# ==========================================
# Albumentations Augmentations
# ==========================================

def harsh_sunlight(image: np.ndarray) -> np.ndarray:
    """
    Simulates harsh overhead sunlight with forehead brightness and deep shadows.

    Args:
        image: Input RGB image (112x112, uint8).

    Returns:
        Augmented image (112x112, uint8).
    """
    transform = A.Compose([
        A.RandomShadow(
            shadow_roi=(0.0, 0.0, 1.0, 0.4),  # Foreground/overhead shadow
            num_shadows_limit=(1, 1),
            shadow_dimension=5,
            shadow_intensity_range=(0.45, 0.6),
            p=1.0
        ),
        A.CLAHE(clip_limit=(2.0, 4.0), tile_grid_size=(8, 8), p=1.0),
        A.RandomBrightnessContrast(
            brightness_limit=(0.15, 0.25),
            contrast_limit=(0.15, 0.25),
            p=1.0
        )
    ])
    return transform(image=image)["image"]

def low_light(image: np.ndarray) -> np.ndarray:
    """
    Simulates low-light/evening conditions with gamma reduction and sensor noise.

    Args:
        image: Input RGB image (112x112, uint8).

    Returns:
        Augmented image (112x112, uint8).
    """
    transform = A.Compose([
        A.RandomGamma(gamma_limit=(40, 70), p=1.0),  # Reduce gamma (darken)
        A.GaussNoise(std_range=(0.06, 0.15), p=1.0)  # Visible sensor noise
    ])
    return transform(image=image)["image"]

def motion_blur_shake(image: np.ndarray) -> np.ndarray:
    """
    Simulates camera shake/motion blur during unsteady handheld device capture.

    Args:
        image: Input RGB image (112x112, uint8).

    Returns:
        Augmented image (112x112, uint8).
    """
    transform = A.Compose([
        A.MotionBlur(blur_limit=(3, 7), p=1.0),
        A.ShiftScaleRotate(
            shift_limit=0.06,
            scale_limit=0.05,
            rotate_limit=(-8, 8),  # Moderate rotation limit (low angles)
            border_mode=cv2.BORDER_REFLECT_101,
            p=1.0
        )
    ])
    return transform(image=image)["image"]

def outdoor_haze_dust(image: np.ndarray) -> np.ndarray:
    """
    Simulates outdoor haze, dust, or mild fog with color desaturation.

    Args:
        image: Input RGB image (112x112, uint8).

    Returns:
        Augmented image (112x112, uint8).
    """
    transform = A.Compose([
        A.RandomFog(
            alpha_coef=0.08,
            fog_coef_range=(0.2, 0.45),
            p=1.0
        ),
        A.HueSaturationValue(
            hue_shift_limit=0,
            sat_shift_limit=(-35, -15),  # Mild desaturation
            val_shift_limit=(-12, 0),
            p=1.0
        )
    ])
    return transform(image=image)["image"]

def combined_realistic(image: np.ndarray) -> np.ndarray:
    """
    Applies a combined sequence of realistic outdoor environment augmentations
    with tuned probabilities matching field deployment conditions.

    Args:
        image: Input RGB image (112x112, uint8).

    Returns:
        Augmented image (112x112, uint8).
    """
    transform = A.Compose([
        A.RandomShadow(
            shadow_roi=(0.0, 0.0, 1.0, 0.4),
            num_shadows_limit=(1, 1),
            shadow_dimension=5,
            shadow_intensity_range=(0.4, 0.6),
            p=0.35  # 35% chance of overhead shadows
        ),
        A.CLAHE(clip_limit=(1.5, 3.0), tile_grid_size=(8, 8), p=0.3),
        A.RandomBrightnessContrast(
            brightness_limit=(-0.2, 0.2),
            contrast_limit=(-0.15, 0.15),
            p=0.4
        ),
        A.RandomGamma(gamma_limit=(50, 90), p=0.25),  # 25% low-light probability
        A.GaussNoise(std_range=(0.03, 0.1), p=0.2),
        A.MotionBlur(blur_limit=(3, 5), p=0.25),
        A.ShiftScaleRotate(
            shift_limit=0.05,
            scale_limit=0.04,
            rotate_limit=(-5, 5),
            border_mode=cv2.BORDER_REFLECT_101,
            p=0.3
        ),
        A.RandomFog(
            alpha_coef=0.05,
            fog_coef_range=(0.15, 0.3),
            p=0.15  # 15% haze/dust probability
        ),
        A.HueSaturationValue(
            hue_shift_limit=5,
            sat_shift_limit=(-25, 5),
            val_shift_limit=(-5, 5),
            p=0.25
        )
    ])
    return transform(image=image)["image"]

# ==========================================
# Main Processing & Splitting Logic
# ==========================================

def process_dataset(
    input_dir: str,
    output_dir: str,
    min_images: int = 5,
    seed: int = 42
) -> None:
    """
    Processes the raw dataset by cleaning, aligning, and performing a stratified split.

    Args:
        input_dir: Path to raw input directory containing identity folders.
        output_dir: Path to output directory to save split data and report.
        min_images: Minimum number of valid face images required per identity.
        seed: Random seed for train/val/test splits.
    """
    random.seed(seed)
    
    # Verify input directory
    if not os.path.exists(input_dir):
        raise FileNotFoundError(f"Input directory '{input_dir}' does not exist.")

    # Create output subdirectories
    splits = ["train", "val", "test"]
    for s in splits:
        os.makedirs(os.path.join(output_dir, s), exist_ok=True)

    # Metrics collections
    total_raw_identities = 0
    total_valid_identities = 0
    total_discarded_identities = 0
    total_raw_images = 0
    total_valid_images = 0
    
    split_counts = {"train": 0, "val": 0, "test": 0}
    identity_report: Dict[str, Any] = {}
    
    # Store global unique MD5 file hashes to prevent duplicates
    processed_hashes = set()

    # Locate identity directories
    identity_dirs = [
        d for d in glob(os.path.join(input_dir, "*"))
        if os.path.isdir(d)
    ]
    total_raw_identities = len(identity_dirs)
    logger.info(f"Found {total_raw_identities} raw identity directories in '{input_dir}'")

    # Initialize MediaPipe Face Detection once
    logger.info("Initializing MediaPipe Face Detection...")
    with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as face_detection:
        
        for id_dir in tqdm(identity_dirs, desc="Processing identities"):
            identity_id = os.path.basename(id_dir)
            
            # Find all image paths
            image_extensions = ["*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"]
            img_paths = []
            for ext in image_extensions:
                img_paths.extend(glob(os.path.join(id_dir, ext)))
            
            # Deduplicate image paths just in case
            img_paths = list(set(img_paths))
            total_raw_images += len(img_paths)
            
            valid_aligned_crops = []
            
            for img_path in img_paths:
                try:
                    # 1. Deduplicate by MD5 check
                    file_hash = compute_md5(img_path)
                    if file_hash in processed_hashes:
                        logger.debug(f"Skipping duplicate file: {img_path}")
                        continue
                    
                    # 2. Check for corrupt image / Read image
                    image = cv2.imread(img_path)
                    if image is None or image.size == 0:
                        logger.warning(f"Corrupt or empty image skipped: {img_path}")
                        continue
                    
                    # 3. MediaPipe alignment and cropping
                    # Convert to RGB for MediaPipe
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    h, w, _ = image.shape
                    
                    results = face_detection.process(image_rgb)
                    
                    if not results.detections:
                        logger.debug(f"No face detected in: {img_path}")
                        continue
                    
                    # Track MD5 hash only after successfully reading and verifying
                    processed_hashes.add(file_hash)
                    
                    # Pick the highest confidence face detection
                    detection = max(results.detections, key=lambda d: d.score[0])
                    keypoints = detection.location_data.relative_keypoints
                    
                    # Right eye index 0, Left eye index 1 in MediaPipe landmarks
                    right_eye_pt = keypoints[0]
                    left_eye_pt = keypoints[1]
                    
                    # Convert relative coordinates to pixel coordinates
                    right_eye = (int(right_eye_pt.x * w), int(right_eye_pt.y * h))
                    left_eye = (int(left_eye_pt.x * w), int(left_eye_pt.y * h))
                    
                    # Perform affine alignment and crop to 112x112
                    M = get_alignment_matrix(left_eye, right_eye, 112, 112)
                    aligned_face = cv2.warpAffine(image, M, (112, 112), flags=cv2.INTER_CUBIC)
                    
                    # Store aligned face in memory
                    valid_aligned_crops.append(aligned_face)
                    
                except Exception as e:
                    logger.error(f"Error processing image {img_path}: {str(e)}")
                    continue
            
            N = len(valid_aligned_crops)
            
            # Enforce minimum threshold
            if N < min_images:
                logger.info(
                    f"Discarding identity '{identity_id}': only {N} valid image(s) found (requires minimum {min_images})"
                )
                total_discarded_identities += 1
                continue
            
            total_valid_identities += 1
            total_valid_images += N
            
            # Shuffle crops for stratified splitting
            random.shuffle(valid_aligned_crops)
            
            # Deterministic splitting at 70/15/15 ratio
            # Ensure at least 1 image per split since N >= 5
            n_val = max(1, int(round(0.15 * N)))
            n_test = max(1, int(round(0.15 * N)))
            n_train = N - n_val - n_test
            
            # Allocate sets
            train_crops = valid_aligned_crops[:n_train]
            val_crops = valid_aligned_crops[n_train:n_train + n_val]
            test_crops = valid_aligned_crops[n_train + n_val:]
            
            # Store in map
            crops_split = {
                "train": train_crops,
                "val": val_crops,
                "test": test_crops
            }
            
            # Write to disk and normalize filenames
            # Sequential index across ALL splits of this identity
            idx_counter = 0
            for split_name, crops in crops_split.items():
                split_dir = os.path.join(output_dir, split_name, identity_id)
                os.makedirs(split_dir, exist_ok=True)
                
                for crop in crops:
                    filename = f"{identity_id}_{idx_counter}.jpg"
                    filepath = os.path.join(split_dir, filename)
                    # cv2.imwrite writes in BGR
                    cv2.imwrite(filepath, crop)
                    idx_counter += 1
                    split_counts[split_name] += 1
            
            identity_report[identity_id] = {
                "total_valid_images": N,
                "train_count": n_train,
                "val_count": n_val,
                "test_count": n_test
            }
            
    # Compile final split report
    report = {
        "summary": {
            "total_raw_identities": total_raw_identities,
            "total_valid_identities": total_valid_identities,
            "total_discarded_identities": total_discarded_identities,
            "total_raw_images": total_raw_images,
            "total_valid_images": total_valid_images,
            "train_set_images": split_counts["train"],
            "val_set_images": split_counts["val"],
            "test_set_images": split_counts["test"]
        },
        "identities": identity_report
    }
    
    # Save split report json
    report_path = os.path.join(output_dir, "split_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=4)
        
    logger.info("==========================================")
    logger.info("✓ Phase 1 complete — Data pipeline ready")
    logger.info(f"Report written to: {report_path}")
    logger.info(f"Total Valid Identities: {total_valid_identities} / {total_raw_identities}")
    logger.info(f"Total Valid Images: {total_valid_images}")
    logger.info(f"Split counts: Train={split_counts['train']} | Val={split_counts['val']} | Test={split_counts['test']}")
    logger.info("==========================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Phase 1: Dataset Preparation, Face Alignment & Stratified Split"
    )
    parser.add_argument(
        "--input_dir",
        type=str,
        default="./data/raw",
        help="Path to raw person-labeled images directory"
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="./data/processed",
        help="Path to save processed split face images"
    )
    parser.add_argument(
        "--min_images",
        type=int,
        default=5,
        help="Minimum valid images required per identity"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for stratified splitting"
    )
    
    args = parser.parse_args()
    
    process_dataset(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        min_images=args.min_images,
        seed=args.seed
    )
