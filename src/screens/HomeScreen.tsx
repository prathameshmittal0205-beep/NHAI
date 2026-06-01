/**
 * HomeScreen — Main app screen wiring all UI components together.
 *
 * Flow:
 *   1. SyncStatusBar (sticky top) — always visible
 *   2. Camera view placeholder — simulated camera feed area
 *   3. LivenessPrompt overlay — triggered on "Start Attendance" button
 *   4. RecognitionResult overlay — shown after liveness completes
 *
 * State machine:
 *   idle -> camera_ready -> liveness_blink -> liveness_smile ->
 *   liveness_head_turn -> processing -> result_success | result_failure | result_timeout
 *
 * Visual spec:
 *   - Dark background (#0F172A)
 *   - Bold typography throughout (min fontWeight: 700)
 *   - High-contrast buttons for outdoor readability
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';

import LivenessPrompt from '../components/LivenessPrompt';
import RecognitionResult from '../components/RecognitionResult';
import SyncStatusBar from '../components/SyncStatusBar';
import {
  COLORS,
  FONTS,
  AppFlowState,
  ChallengeType,
  RecognitionData,
  NetworkState,
} from '../types/theme';
import ErrorBoundary from '../components/ErrorBoundary';
import { verifyIdentity } from '../modules/FaceRecognitionModule';
import { SessionCheckpoint } from '../utils/SessionCheckpoint';

// ============================================================
// Constants
// ============================================================

const CHALLENGE_SEQUENCE: ChallengeType[] = ['blink', 'smile', 'head_turn'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// Camera View Placeholder
// ============================================================

const CameraViewPlaceholder: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isActive, pulseAnim]);

  return (
    <View style={styles.cameraContainer}>
      {/* Simulated camera feed background */}
      <View style={styles.cameraFeed}>
        {/* Face outline guide */}
        <Animated.View
          style={[
            styles.faceGuide,
            { opacity: isActive ? pulseAnim : 0.3 },
          ]}
        >
          <View style={styles.faceGuideInner} />
        </Animated.View>

        {/* Corner brackets */}
        <View style={[styles.cornerBracket, styles.topLeft]} />
        <View style={[styles.cornerBracket, styles.topRight]} />
        <View style={[styles.cornerBracket, styles.bottomLeft]} />
        <View style={[styles.cornerBracket, styles.bottomRight]} />

        {/* Camera status text */}
        <Text style={styles.cameraText}>
          {isActive ? 'CAMERA ACTIVE' : 'CAMERA STANDBY'}
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// Start Button
// ============================================================

const StartButton: React.FC<{ onPress: () => void; isVisible: boolean }> = ({
  onPress,
  isVisible,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }).start();

      // Glow pulse
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      glow.start();
      return () => glow.stop();
    } else {
      scaleAnim.setValue(0);
    }
  }, [isVisible, scaleAnim, glowAnim]);

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.startButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
      {/* Glow ring */}
      <Animated.View
        style={[
          styles.startButtonGlow,
          {
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.6],
            }),
          },
        ]}
      />

      <TouchableOpacity
        style={styles.startButton}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.startButtonIcon}>[ ]</Text>
        <Text style={styles.startButtonText}>START ATTENDANCE</Text>
        <Text style={styles.startButtonSub}>Tap to begin verification</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// Processing Indicator
// ============================================================

const ProcessingOverlay: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const spin = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isVisible, rotateAnim, fadeAnim]);

  if (!isVisible) return null;

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.processingContainer, { opacity: fadeAnim }]}>
      <View style={styles.processingBg} />
      <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]}>
        <View style={styles.spinnerDot} />
      </Animated.View>
      <Text style={styles.processingText}>VERIFYING IDENTITY</Text>
      <Text style={styles.processingSubtext}>Please wait...</Text>
    </Animated.View>
  );
};

// ============================================================
// Main HomeScreen
// ============================================================

const HomeScreen: React.FC = () => {
  // --- State ---
  const [flowState, setFlowState] = useState<AppFlowState>('idle');
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [networkState, setNetworkState] = useState<NetworkState>('offline');
  const [pendingCount, setPendingCount] = useState(2);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [recognitionData, setRecognitionData] = useState<RecognitionData | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [resumableState, setResumableState] = useState<AppFlowState | null>(null);

  // --- Session Checkpoint Logic ---
  useEffect(() => {
    SessionCheckpoint.load().then((savedState) => {
      if (savedState && savedState !== 'idle') {
        setResumableState(savedState);
      }
    });
  }, []);

  useEffect(() => {
    SessionCheckpoint.save(flowState);
  }, [flowState]);

  const handleResumeSession = useCallback((resume: boolean) => {
    if (resume && resumableState) {
      setFlowState(resumableState);
      const idx = CHALLENGE_SEQUENCE.findIndex(
        c => `liveness_${c}` === resumableState
      );
      if (idx !== -1) setCurrentChallengeIndex(idx);
    } else {
      SessionCheckpoint.clear();
    }
    setResumableState(null);
  }, [resumableState]);

  // --- Derived ---
  const currentChallenge = CHALLENGE_SEQUENCE[currentChallengeIndex];
  const isLivenessActive = flowState.startsWith('liveness_');

  // --- Handlers ---

  const handleStartAttendance = useCallback(() => {
    setFlowState('liveness_blink');
    setCurrentChallengeIndex(0);
  }, []);

  const handleChallengeComplete = useCallback(
    (success: boolean) => {
      if (!success) {
        setRecognitionData({
          status: 'failure',
          timestamp: new Date().toISOString(),
        });
        setFlowState('result_failure');
        return;
      }

      const nextIndex = currentChallengeIndex + 1;
      if (nextIndex < CHALLENGE_SEQUENCE.length) {
        setCurrentChallengeIndex(nextIndex);
        const nextChallenge = CHALLENGE_SEQUENCE[nextIndex];
        setFlowState(`liveness_${nextChallenge}` as AppFlowState);
      } else {
        // All challenges passed — run real recognition via Native Module
        setFlowState('processing');
        
        // In a real implementation, you would capture the base64 frame from the camera here
        const capturedFrameBase64 = "dummy_base64_frame_for_demo";
        
        verifyIdentity(capturedFrameBase64)
          .then((result) => {
            setRecognitionData({
              status: result.verified ? 'success' : 'failure',
              personnelName: result.name,
              personnelId: result.employeeId,
              confidenceScore: result.confidence,
              timestamp: new Date().toISOString(),
            });
            setFlowState(result.verified ? 'result_success' : 'result_failure');
          })
          .catch((e) => {
            console.error("Inference Error: ", e);
            handleTimeout();
          });
      }
    },
    [currentChallengeIndex]
  );

  const handleTimeout = useCallback(() => {
    setRecognitionData({
      status: 'timeout',
      timestamp: new Date().toISOString(),
    });
    setFlowState('result_timeout');
  }, []);

  const handleRetry = useCallback(() => {
    setFlowState('idle');
    setCurrentChallengeIndex(0);
    setRecognitionData(null);
  }, []);

  const handleDismiss = useCallback(() => {
    setFlowState('idle');
    setCurrentChallengeIndex(0);
    setRecognitionData(null);
  }, []);

  // Listen to real network state changes
  useEffect(() => {
    // TODO: Wire up actual SyncManager instance to update networkState and pendingCount
    // const unsubscribe = syncManager.onNetworkChange((state) => {
    //   setNetworkState(state);
    // });
    // return unsubscribe;
  }, []);

  // --- Get current challenge type for LivenessPrompt ---
  const activeChallengeType: ChallengeType =
    flowState === 'liveness_blink' ? 'blink' :
    flowState === 'liveness_smile' ? 'smile' :
    flowState === 'liveness_head_turn' ? 'head_turn' :
    'blink';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.DARK_BG}
        translucent={false}
      />

      {/* 1. Sync Status Bar — Always visible, sticky top */}
      <SyncStatusBar
        networkState={networkState}
        pendingCount={pendingCount}
        lastSyncTime={lastSyncTime}
      />

      {/* 2. Main content area */}
      <View style={styles.mainContent}>
        {/* App title */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>NHAI DATALAKE</Text>
          <Text style={styles.appSubtitle}>ATTENDANCE SYSTEM v3.0</Text>
        </View>

        {/* Camera view */}
        <CameraViewPlaceholder isActive={flowState !== 'idle'} />

        {/* Start button (only visible in idle state) */}
        {!resumableState && (
          <StartButton
            onPress={handleStartAttendance}
            isVisible={flowState === 'idle'}
          />
        )}

        {/* Resume Session Prompt */}
        {resumableState && flowState === 'idle' && (
          <View style={styles.resumeContainer}>
            <Text style={styles.resumeTitle}>RESUME SESSION?</Text>
            <Text style={styles.resumeSub}>An interrupted attendance session was found.</Text>
            <View style={styles.resumeButtonRow}>
              <TouchableOpacity style={[styles.resumeBtn, styles.resumeYes]} onPress={() => handleResumeSession(true)}>
                <Text style={styles.resumeBtnText}>RESUME</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.resumeBtn, styles.resumeNo]} onPress={() => handleResumeSession(false)}>
                <Text style={styles.resumeBtnText}>DISCARD</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step indicator during liveness */}
        {isLivenessActive && (
          <View style={styles.stepIndicator}>
            {CHALLENGE_SEQUENCE.map((challenge, idx) => (
              <View
                key={challenge}
                style={[
                  styles.stepDot,
                  idx < currentChallengeIndex && styles.stepDotDone,
                  idx === currentChallengeIndex && styles.stepDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* 3. Liveness Prompt overlay */}
      <LivenessPrompt
        challengeType={activeChallengeType}
        isActive={isLivenessActive}
        onChallengeComplete={handleChallengeComplete}
        onTimeout={handleTimeout}
      />

      {/* 4. Processing overlay */}
      <ProcessingOverlay isVisible={flowState === 'processing'} />

      {/* 5. Recognition Result overlay */}
      {recognitionData && (
        flowState === 'result_success' ||
        flowState === 'result_failure' ||
        flowState === 'result_timeout'
      ) && (
        <RecognitionResult
          data={recognitionData}
          onRetry={handleRetry}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  );
};

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  mainContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    alignItems: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: FONTS.SIZE_TITLE,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
    letterSpacing: 4,
  },
  appSubtitle: {
    fontSize: FONTS.SIZE_CAPTION,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_SECONDARY,
    letterSpacing: 2,
    marginTop: 4,
  },

  // Camera
  cameraContainer: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_WIDTH - 48,
    maxHeight: 380,
    marginBottom: 32,
  },
  cameraFeed: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  faceGuide: {
    width: 180,
    height: 220,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: COLORS.TEXT_SECONDARY,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuideInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.TEXT_SECONDARY,
  },
  cornerBracket: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: COLORS.AMBER,
    borderWidth: 3,
  },
  topLeft: {
    top: 12,
    left: 12,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 12,
    right: 12,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 12,
    left: 12,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 12,
    right: 12,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  cameraText: {
    position: 'absolute',
    bottom: 16,
    fontSize: 12,
    fontWeight: FONTS.BOLD,
    color: COLORS.TEXT_SECONDARY,
    letterSpacing: 2,
  },

  // Start button
  startButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH - 48,
    height: 100,
    borderRadius: 20,
    backgroundColor: COLORS.AMBER,
  },
  startButton: {
    backgroundColor: COLORS.AMBER,
    paddingVertical: 20,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignItems: 'center',
    width: SCREEN_WIDTH - 48,
    shadowColor: COLORS.AMBER,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  startButtonIcon: {
    fontSize: 28,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.BLACK,
    marginBottom: 4,
  },
  startButtonText: {
    fontSize: 22,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.BLACK,
    letterSpacing: 3,
  },
  startButtonSub: {
    fontSize: FONTS.SIZE_CAPTION,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.AMBER_DARK,
    marginTop: 4,
    letterSpacing: 1,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.BORDER,
    marginHorizontal: 8,
  },
  stepDotActive: {
    backgroundColor: COLORS.AMBER,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stepDotDone: {
    backgroundColor: COLORS.SUCCESS,
  },

  // Processing overlay
  processingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 150,
  },
  processingBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.DARK_BG,
    opacity: 0.95,
  },
  spinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: COLORS.AMBER,
    marginBottom: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  spinnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.AMBER,
    marginTop: -4,
  },
  processingText: {
    fontSize: 20,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
    letterSpacing: 3,
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: FONTS.SIZE_CAPTION,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_SECONDARY,
  },
  resumeContainer: {
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  resumeTitle: {
    color: COLORS.WHITE,
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  resumeSub: {
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 16,
  },
  resumeButtonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  resumeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  resumeYes: {
    backgroundColor: COLORS.SUCCESS,
  },
  resumeNo: {
    backgroundColor: COLORS.FAILURE_BG,
  },
  resumeBtnText: {
    color: COLORS.WHITE,
    fontWeight: 'bold',
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <HomeScreen />
    </ErrorBoundary>
  );
}
