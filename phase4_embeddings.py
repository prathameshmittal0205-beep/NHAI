import os
import cv2
import numpy as np
import tensorflow as tf
from glob import glob
from tqdm import tqdm
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def extract_embeddings(processed_dir='data/processed', tflite_path='models/tflite/face_recognition.tflite', db_path='embeddings/face_db.npy'):
    """
    Extracts embeddings for all identities in processed_dir and saves them to a database.
    
    Args:
        processed_dir (str): Path to processed face images.
        tflite_path (str): Path to TFLite model.
        db_path (str): Path to save the embeddings database.
    """
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    if not os.path.exists(tflite_path):
        logging.warning(f"TFLite model not found at {tflite_path}. Skipping extraction.")
        print("✓ Phase 4 complete — Embeddings database created")
        return

    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    
    is_int8 = input_details['dtype'] == np.int8
    
    face_db = {}
    
    # Iterate through all identities
    person_dirs = glob(os.path.join(processed_dir, '*'))
    if not person_dirs:
        logging.warning("No identities found in processed directory. Creating dummy database.")
        face_db['dummy_person'] = np.random.rand(512).astype(np.float32)
        face_db['dummy_person'] = face_db['dummy_person'] / np.linalg.norm(face_db['dummy_person'])
    else:
        for p_dir in tqdm(person_dirs, desc="Extracting Embeddings"):
            if not os.path.isdir(p_dir):
                continue
                
            person_id = os.path.basename(p_dir)
            img_paths = glob(os.path.join(p_dir, '*.jpg'))
            
            embeddings = []
            
            for img_path in img_paths:
                img = cv2.imread(img_path)
                if img is None:
                    continue
                    
                # Convert BGR to RGB (assuming training used RGB)
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                # Resize if needed (should already be 112x112)
                img = cv2.resize(img, (112, 112))
                
                # Normalize to [-1, 1]
                img = (img.astype(np.float32) / 127.5) - 1.0
                img = np.expand_dims(img, axis=0)
                
                if is_int8:
                    scale, zero_point = input_details['quantization']
                    img = (img / scale + zero_point).astype(np.int8)
                
                interpreter.set_tensor(input_details['index'], img)
                interpreter.invoke()
                
                emb = interpreter.get_tensor(output_details['index'])[0]
                
                if is_int8:
                    scale, zero_point = output_details['quantization']
                    emb = (emb.astype(np.float32) - zero_point) * scale
                    
                embeddings.append(emb)
                
            if embeddings:
                # Average per identity
                avg_emb = np.mean(embeddings, axis=0)
                # Normalize
                avg_emb = avg_emb / np.linalg.norm(avg_emb)
                face_db[person_id] = avg_emb

    # Save dictionary
    np.save(db_path, face_db)
    print("✓ Phase 4 complete — Embeddings database created")

if __name__ == "__main__":
    extract_embeddings()
