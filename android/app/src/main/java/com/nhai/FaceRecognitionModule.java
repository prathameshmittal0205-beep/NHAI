package com.nhai;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import org.tensorflow.lite.Interpreter;

import java.io.FileInputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;

public class FaceRecognitionModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "FaceRecognition";
    private Interpreter tflite;
    
    // MobileFaceNet INT8 constants
    private static final int INPUT_IMAGE_SIZE = 112;
    private static final int EMBEDDING_SIZE = 192;
    private static final float THRESHOLD = 0.80f;

    public FaceRecognitionModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    private MappedByteBuffer loadModelFile(Context context) throws Exception {
        AssetFileDescriptor fileDescriptor = context.getAssets().openFd("mobilefacenet.tflite");
        FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
        FileChannel fileChannel = inputStream.getChannel();
        long startOffset = fileDescriptor.getStartOffset();
        long declaredLength = fileDescriptor.getDeclaredLength();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength);
    }

    private void initTFLite() throws Exception {
        if (tflite == null) {
            MappedByteBuffer tfliteModel = loadModelFile(getReactApplicationContext());
            Interpreter.Options options = new Interpreter.Options();
            options.setNumThreads(4);
            tflite = new Interpreter(tfliteModel, options);
        }
    }

    private ByteBuffer convertBitmapToByteBuffer(Bitmap bitmap) {
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(1 * INPUT_IMAGE_SIZE * INPUT_IMAGE_SIZE * 3);
        byteBuffer.order(ByteOrder.nativeOrder());
        int[] intValues = new int[INPUT_IMAGE_SIZE * INPUT_IMAGE_SIZE];
        
        Bitmap resizedBitmap = Bitmap.createScaledBitmap(bitmap, INPUT_IMAGE_SIZE, INPUT_IMAGE_SIZE, true);
        resizedBitmap.getPixels(intValues, 0, resizedBitmap.getWidth(), 0, 0, resizedBitmap.getWidth(), resizedBitmap.getHeight());
        
        int pixel = 0;
        for (int i = 0; i < INPUT_IMAGE_SIZE; ++i) {
            for (int j = 0; j < INPUT_IMAGE_SIZE; ++j) {
                final int val = intValues[pixel++];
                // INT8 quantization
                byteBuffer.put((byte) (((val >> 16) & 0xFF) - 128));
                byteBuffer.put((byte) (((val >> 8) & 0xFF) - 128));
                byteBuffer.put((byte) ((val & 0xFF) - 128));
            }
        }
        return byteBuffer;
    }

    private float cosineSimilarity(byte[] a, byte[] b) {
        float dotProduct = 0.0f;
        float normA = 0.0f;
        float normB = 0.0f;
        for (int i = 0; i < EMBEDDING_SIZE; i++) {
            dotProduct += a[i] * b[i];
            normA += Math.pow(a[i], 2);
            normB += Math.pow(b[i], 2);
        }
        if (normA == 0 || normB == 0) return 0.0f;
        return (float) (dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));
    }

    /**
     * Executes the INT8 quantized MobileFaceNet TFLite model on the provided base64 frame.
     */
    @ReactMethod
    public void verifyIdentity(String base64Frame, Promise promise) {
        try {
            // 1. Init Model
            try {
                initTFLite();
            } catch (Exception e) {
                promise.reject("MODEL_NOT_FOUND", "mobilefacenet.tflite is missing from assets", e);
                return;
            }

            // 2. Decode Base64
            Bitmap bitmap;
            try {
                byte[] decodedString = Base64.decode(base64Frame, Base64.DEFAULT);
                bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
                if (bitmap == null) throw new Exception("Bitmap decode failed");
            } catch (Exception e) {
                promise.reject("INVALID_FRAME", "Failed to decode base64 frame", e);
                return;
            }

            // TODO: Face alignment/detection check could go here. 
            // If no face found by MediaPipe upstream: promise.reject("NO_FACE_DETECTED", "...");

            // 3. Preprocess
            ByteBuffer inputData = convertBitmapToByteBuffer(bitmap);
            byte[][] outputData = new byte[1][EMBEDDING_SIZE];

            // 4. Inference
            tflite.run(inputData, outputData);
            byte[] generatedEmbedding = outputData[0];

            // 5. Compare against local DB
            String dbPath = getReactApplicationContext().getDatabasePath("nhai_sync.db").getPath();
            SQLiteDatabase db = SQLiteDatabase.openDatabase(dbPath, null, SQLiteDatabase.OPEN_READONLY);
            
            Cursor cursor = db.rawQuery("SELECT employee_id, name, embedding FROM personnel_embeddings", null);
            
            float bestMatchScore = 0.0f;
            String bestMatchId = null;
            String bestMatchName = null;

            if (cursor.moveToFirst()) {
                do {
                    String empId = cursor.getString(0);
                    String name = cursor.getString(1);
                    byte[] dbEmbedding = cursor.getBlob(2);

                    float score = cosineSimilarity(generatedEmbedding, dbEmbedding);
                    if (score > bestMatchScore) {
                        bestMatchScore = score;
                        bestMatchId = empId;
                        bestMatchName = name;
                    }
                } while (cursor.moveToNext());
            }
            cursor.close();
            db.close();

            WritableMap result = Arguments.createMap();
            if (bestMatchScore >= THRESHOLD) {
                result.putBoolean("verified", true);
                result.putString("name", bestMatchName);
                result.putString("employeeId", bestMatchId);
                result.putDouble("confidence", bestMatchScore);
            } else {
                result.putBoolean("verified", false);
                result.putString("name", "Unknown");
                result.putString("employeeId", "");
                result.putDouble("confidence", bestMatchScore);
            }

            promise.resolve(result);

        } catch (Exception e) {
            promise.reject("INFERENCE_ERROR", "Failed to run face recognition model", e);
        }
    }
}
