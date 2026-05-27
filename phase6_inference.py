import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
import os
from sklearn.metrics.pairwise import cosine_similarity
from phase5_liveness import LivenessDetector
from phase1_data_pipeline import get_alignment_matrix

def apply_clahe(img):
    """
    Applies CLAHE on the LAB L-channel of an image.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl,a,b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

def run_inference():
    """
    Main inference loop: Webcam -> Liveness -> Recognition.
    """
    os.makedirs('outputs', exist_ok=True)
    
    # Load embeddings DB
    try:
        face_db = np.load('embeddings/face_db.npy', allow_pickle=True).item()
    except:
        print("Warning: face_db.npy not found. Using dummy DB.")
        face_db = {'dummy': np.random.rand(512)}
        
    # Load TFLite Model
    try:
        interpreter = tf.lite.Interpreter(model_path='models/tflite/face_recognition.tflite')
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()[0]
        output_details = interpreter.get_output_details()[0]
        is_int8 = input_details['dtype'] == np.int8
    except:
        print("Error: TFLite model not found.")
        return

    # Initialize Liveness
    liveness_detector = LivenessDetector()
    current_action = liveness_detector.start_challenge()
    liveness_passed = False
    
    # Initialize MediaPipe Face Detection for alignment
    mp_face_detection = mp.solutions.face_detection
    face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)

    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam. Ensure it's not being used by another application.")
        return

    print("✓ Phase 6 complete — Inference running")
    print(f"Liveness Challenge Started. First action: {current_action}")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            display_frame = frame.copy()
            
            if not liveness_passed:
                status, action, msg = liveness_detector.process_frame(frame)
                
                cv2.putText(display_frame, msg, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                
                if status is True:
                    liveness_passed = True
                    print("Liveness Check Passed!")
                elif status is False:
                    print(f"Liveness Check Failed: {msg}")
                    # Reject immediately
                    cv2.putText(display_frame, "REJECTED: Liveness Failed", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
                    cv2.imwrite('outputs/result.jpg', display_frame)
                    break
                    
            else:
                # Recognition phase
                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_detection.process(image_rgb)
                
                if results.detections:
                    detection = max(results.detections, key=lambda d: d.score[0])
                    bboxC = detection.location_data.relative_bounding_box
                    h, w, _ = frame.shape
                    
                    # Bounding box
                    x, y, bw, bh = int(bboxC.xmin * w), int(bboxC.ymin * h), int(bboxC.width * w), int(bboxC.height * h)
                    
                    # Align and preprocess
                    keypoints = detection.location_data.relative_keypoints
                    right_eye = (int(keypoints[0].x * w), int(keypoints[0].y * h))
                    left_eye = (int(keypoints[1].x * w), int(keypoints[1].y * h))
                    
                    M = get_alignment_matrix(left_eye, right_eye, 112, 112)
                    aligned_face = cv2.warpAffine(frame, M, (112, 112), flags=cv2.INTER_CUBIC)
                    
                    # Apply CLAHE
                    clahe_face = apply_clahe(aligned_face)
                    
                    # Prepare for TFLite
                    rgb_face = cv2.cvtColor(clahe_face, cv2.COLOR_BGR2RGB)
                    norm_face = (rgb_face.astype(np.float32) / 127.5) - 1.0
                    input_tensor = np.expand_dims(norm_face, axis=0)
                    
                    if is_int8:
                        scale, zp = input_details['quantization']
                        input_tensor = (input_tensor / scale + zp).astype(np.int8)
                        
                    interpreter.set_tensor(input_details['index'], input_tensor)
                    interpreter.invoke()
                    
                    emb = interpreter.get_tensor(output_details['index'])[0]
                    
                    if is_int8:
                        scale, zp = output_details['quantization']
                        emb = (emb.astype(np.float32) - zp) * scale
                        
                    emb = emb / np.linalg.norm(emb)
                    
                    # Compare
                    best_match = "Unknown"
                    best_score = 0.0
                    
                    for person_id, db_emb in face_db.items():
                        score = cosine_similarity([emb], [db_emb])[0][0]
                        if score > best_score:
                            best_score = score
                            best_match = person_id
                            
                    if best_score > 0.65:
                        color = (0, 255, 0)
                        label = f"{best_match} ({best_score:.2f})"
                    else:
                        color = (0, 0, 255)
                        label = f"Unknown ({best_score:.2f})"
                        
                    cv2.rectangle(display_frame, (x, y), (x+bw, y+bh), color, 2)
                    cv2.putText(display_frame, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                    
                    cv2.imwrite('outputs/result.jpg', display_frame)
                    
            cv2.imshow('Face Recognition & Liveness', display_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    run_inference()
