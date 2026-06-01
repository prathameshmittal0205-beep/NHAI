import { NativeModules, Platform } from 'react-native';

const { FaceRecognition } = NativeModules;

export interface FaceRecognitionResult {
  verified: boolean;
  name: string;
  employeeId: string;
  confidence: number;
}

/**
 * Executes the INT8 quantized MobileFaceNet TFLite model.
 * Returns the recognized personnel information if verified, or throws an error.
 * 
 * @param base64Frame - The JPEG frame encoded as a base64 string
 */
export const verifyIdentity = async (base64Frame: string): Promise<FaceRecognitionResult> => {
  if (Platform.OS === 'android' && FaceRecognition) {
    return await FaceRecognition.verifyIdentity(base64Frame);
  } else {
    throw new Error('FaceRecognition module is not available on this platform or not linked.');
  }
};

export default {
  verifyIdentity,
};
