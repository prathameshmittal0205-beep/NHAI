import os
import json
import numpy as np
from typing import Dict, List, Tuple, Any

def calculate_classification_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Computes standard classification metrics (Accuracy, Precision, Recall, F1).

    Args:
        y_true: Binary ground truth labels (0 or 1).
        y_pred: Binary predictions (0 or 1).

    Returns:
        A dictionary containing accuracy, precision, recall, and f1_score.
    """
    tp = np.sum((y_true == 1) & (y_pred == 1))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    tn = np.sum((y_true == 0) & (y_pred == 0))
    fn = np.sum((y_true == 1) & (y_pred == 0))

    accuracy = float((tp + tn) / len(y_true)) if len(y_true) > 0 else 0.0
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    
    if precision + recall > 0:
        f1_score = float(2 * precision * recall / (precision + recall))
    else:
        f1_score = 0.0

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1_score
    }

def calculate_far_frr(y_true: np.ndarray, y_scores: np.ndarray, threshold: float) -> Tuple[float, float]:
    """
    Computes False Acceptance Rate (FAR) and False Rejection Rate (FRR) for a given threshold.

    Args:
        y_true: Binary ground truth labels (0 = Impostor/Spoof, 1 = Authentic/Live).
        y_scores: Continuous model prediction scores or similarity values.
        threshold: The decision boundary threshold.

    Returns:
        A tuple of (FAR, FRR).
    """
    y_pred = (y_scores >= threshold).astype(int)
    
    # FAR = FP / (FP + TN) (False positives / Total negative samples)
    negatives = np.sum(y_true == 0)
    fp = np.sum((y_true == 0) & (y_pred == 1))
    far = float(fp / negatives) if negatives > 0 else 0.0
    
    # FRR = FN / (TP + FN) (False negatives / Total positive samples)
    positives = np.sum(y_true == 1)
    fn = np.sum((y_true == 1) & (y_pred == 0))
    frr = float(fn / positives) if positives > 0 else 0.0
    
    return far, frr

def compute_roc_eer(
    y_true: np.ndarray, 
    y_scores: np.ndarray, 
    num_thresholds: int = 1000
) -> Dict[str, Any]:
    """
    Generates ROC curve data and computes the Equal Error Rate (EER).

    Args:
        y_true: Binary ground truth labels (0 or 1).
        y_scores: Continuous prediction scores.
        num_thresholds: Number of thresholds to evaluate.

    Returns:
        A dictionary containing EER, EER threshold, and lists of thresholds, FPR (FAR), TPR, and FRR.
    """
    # Create sorted list of thresholds spanning the range of scores
    min_score = float(np.min(y_scores)) if len(y_scores) > 0 else 0.0
    max_score = float(np.max(y_scores)) if len(y_scores) > 0 else 1.0
    
    # Include bounds slightly wider than min/max
    thresholds = np.linspace(min_score - 0.01, max_score + 0.01, num_thresholds)
    
    fpr_list = []
    tpr_list = []
    frr_list = []
    
    min_diff = float("inf")
    eer = 0.0
    eer_threshold = 0.0
    
    for t in thresholds:
        far, frr = calculate_far_frr(y_true, y_scores, t)
        tpr = 1.0 - frr
        
        fpr_list.append(far)
        tpr_list.append(tpr)
        frr_list.append(frr)
        
        # EER is where FAR == FRR
        diff = abs(far - frr)
        if diff < min_diff:
            min_diff = diff
            # Approximate EER as the average of FAR and FRR at the point where they are closest
            eer = (far + frr) / 2.0
            eer_threshold = t
            
    return {
        "eer": float(eer),
        "eer_threshold": float(eer_threshold),
        "thresholds": thresholds.tolist(),
        "fpr": fpr_list,
        "tpr": tpr_list,
        "frr": frr_list
    }

def evaluate_predictions(
    y_true: np.ndarray, 
    y_scores: np.ndarray, 
    output_json_path: str = "metrics.json"
) -> Dict[str, Any]:
    """
    Evaluates predictions, prints performance, and saves report to JSON.

    Args:
        y_true: Binary ground truth labels (0 or 1).
        y_scores: Continuous prediction scores.
        output_json_path: Path to save the final JSON metrics report.

    Returns:
        A dictionary summarizing all evaluation results.
    """
    # 1. Compute ROC and EER
    roc_results = compute_roc_eer(y_true, y_scores)
    eer = roc_results["eer"]
    eer_threshold = roc_results["eer_threshold"]
    
    # 2. Get predictions using EER threshold
    y_pred = (y_scores >= eer_threshold).astype(int)
    
    # 3. Compute standard classification metrics
    class_metrics = calculate_classification_metrics(y_true, y_pred)
    
    # Compile report
    report = {
        "summary": {
            "total_samples": int(len(y_true)),
            "authentic_samples": int(np.sum(y_true == 1)),
            "impostor_samples": int(np.sum(y_true == 0)),
            "accuracy": class_metrics["accuracy"],
            "precision": class_metrics["precision"],
            "recall": class_metrics["recall"],
            "f1_score": class_metrics["f1_score"],
            "eer": eer,
            "eer_threshold": eer_threshold
        },
        "roc_curve": {
            "thresholds": roc_results["thresholds"],
            "fpr": roc_results["fpr"],
            "tpr": roc_results["tpr"],
            "frr": roc_results["frr"]
        }
    }
    
    # Ensure directory exists
    dir_name = os.path.dirname(output_json_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
        
    with open(output_json_path, "w") as f:
        json.dump(report, f, indent=4)
        
    print("==========================================")
    print("Metrics Evaluation Complete")
    print(f"Report saved to: {output_json_path}")
    print(f"Total Samples: {report['summary']['total_samples']}")
    print(f"Accuracy (at EER threshold): {report['summary']['accuracy']:.4f}")
    print(f"F1 Score: {report['summary']['f1_score']:.4f}")
    print(f"Equal Error Rate (EER): {report['summary']['eer']:.4f} (at threshold {report['summary']['eer_threshold']:.4f})")
    print("==========================================")
    
    return report

if __name__ == "__main__":
    # Generate synthetic validation data to verify calculations when run as main
    print("Running verification on synthetic predictions data...")
    
    # Set seed for reproducibility
    np.random.seed(42)
    
    # Simulate 200 samples (100 authentic, 100 impostors/spoof)
    # Authentic scores centered around 0.82
    authentic_scores = np.random.normal(loc=0.82, scale=0.08, size=100)
    # Impostor/spoof scores centered around 0.32
    impostor_scores = np.random.normal(loc=0.32, scale=0.12, size=100)
    
    # Clip scores to [0, 1] range
    authentic_scores = np.clip(authentic_scores, 0.0, 1.0)
    impostor_scores = np.clip(impostor_scores, 0.0, 1.0)
    
    y_true = np.concatenate([np.ones(100), np.zeros(100)]).astype(int)
    y_scores = np.concatenate([authentic_scores, impostor_scores])
    
    # Evaluate
    evaluate_predictions(y_true, y_scores, output_json_path="metrics.json")
