/**
 * RecognitionResult — Full-screen result overlay after liveness + recognition.
 *
 * Three states:
 *   - SUCCESS (#16A34A) — large checkmark, personnel name + ID, confidence score
 *   - FAILURE (#DC2626) — large X, retry button
 *   - TIMEOUT (#6B7280) — clock icon, retry button
 *
 * Visual spec:
 *   - Minimum fontWeight: 700 everywhere
 *   - Large animated result icon (scale-in + fade)
 *   - Personnel info card on success
 *   - Retry button with press feedback on failure/timeout
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { COLORS, FONTS, RecognitionStatus, RecognitionData } from '../types/theme';

// ============================================================
// Props
// ============================================================

interface RecognitionResultProps {
  data: RecognitionData;
  onRetry: () => void;
  onDismiss: () => void;
}

// ============================================================
// Status Config
// ============================================================

const STATUS_CONFIG: Record<RecognitionStatus, {
  bgColor: string;
  accentColor: string;
  icon: string;
  title: string;
  subtitle: string;
}> = {
  success: {
    bgColor: COLORS.SUCCESS_BG,
    accentColor: COLORS.SUCCESS,
    icon: 'V',
    title: 'IDENTITY VERIFIED',
    subtitle: 'Attendance logged successfully',
  },
  failure: {
    bgColor: COLORS.FAILURE_BG,
    accentColor: COLORS.FAILURE,
    icon: 'X',
    title: 'VERIFICATION FAILED',
    subtitle: 'Face not recognized — try again',
  },
  timeout: {
    bgColor: COLORS.TIMEOUT_BG,
    accentColor: COLORS.TIMEOUT,
    icon: '!',
    title: 'SESSION TIMED OUT',
    subtitle: 'Challenge not completed in time',
  },
};

// ============================================================
// Result Icon (Animated)
// ============================================================

const ResultIcon: React.FC<{ status: RecognitionStatus }> = ({ status }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, rotateAnim]);

  const config = STATUS_CONFIG[status];

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-180deg', '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.iconCircle,
        {
          backgroundColor: config.accentColor,
          transform: [{ scale: scaleAnim }, { rotate }],
        },
      ]}
    >
      <Text style={styles.iconSymbol}>
        {config.icon}
      </Text>
    </Animated.View>
  );
};

// ============================================================
// Personnel Info Card (Success only)
// ============================================================

const PersonnelCard: React.FC<{ data: RecognitionData }> = ({ data }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (data.status !== 'success') return null;

  const confidence = data.confidenceScore
    ? (data.confidenceScore * 100).toFixed(1)
    : '--';

  return (
    <Animated.View style={[styles.personnelCard, { opacity: fadeAnim }]}>
      {/* Name */}
      <Text style={styles.personnelName}>
        {data.personnelName || 'Unknown Personnel'}
      </Text>

      {/* ID badge */}
      <View style={styles.idBadge}>
        <Text style={styles.idLabel}>NHAI ID</Text>
        <Text style={styles.idValue}>
          {data.personnelId || 'N/A'}
        </Text>
      </View>

      {/* Confidence + Timestamp row */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>CONFIDENCE</Text>
          <Text style={[styles.metaValue, { color: COLORS.SUCCESS_LIGHT }]}>
            {confidence}%
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>TIME</Text>
          <Text style={styles.metaValue}>
            {new Date(data.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ============================================================
// Retry Button
// ============================================================

const RetryButton: React.FC<{ onPress: () => void; accentColor: string }> = ({
  onPress,
  accentColor,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 600,
      useNativeDriver: true,
    }).start();

    // Subtle pulse to draw attention
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [fadeAnim, pulseAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[styles.retryButton, { borderColor: accentColor }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.retryText, { color: accentColor }]}>
          TRY AGAIN
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// Main Component
// ============================================================

const RecognitionResult: React.FC<RecognitionResultProps> = ({
  data,
  onRetry,
  onDismiss,
}) => {
  const config = STATUS_CONFIG[data.status];
  const bgFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bgFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [bgFadeAnim]);

  const showRetry = data.status === 'failure' || data.status === 'timeout';

  return (
    <Animated.View style={[styles.container, { opacity: bgFadeAnim }]}>
      <View style={[styles.background, { backgroundColor: config.bgColor }]} />

      <View style={styles.content}>
        {/* Animated result icon */}
        <ResultIcon status={data.status} />

        {/* Title */}
        <Text style={[styles.title, { color: config.accentColor }]}>
          {config.title}
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {config.subtitle}
        </Text>

        {/* Personnel card (success) or retry button (failure/timeout) */}
        {data.status === 'success' && <PersonnelCard data={data} />}
        {showRetry && (
          <RetryButton onPress={onRetry} accentColor={config.accentColor} />
        )}

        {/* Dismiss / Continue */}
        {data.status === 'success' && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissText}>CONTINUE</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// ============================================================
// Styles
// ============================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.97,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },

  // Icon
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    // Glow effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  iconSymbol: {
    fontSize: 64,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
    textAlign: 'center',
  },

  // Title / Subtitle
  title: {
    fontSize: FONTS.SIZE_HEADING,
    fontWeight: FONTS.EXTRA_BOLD,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONTS.SIZE_BODY,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 40,
  },

  // Personnel card
  personnelCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 24,
    width: SCREEN_WIDTH - 64,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 32,
  },
  personnelName: {
    fontSize: 26,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  idBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(22,163,74,0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginBottom: 20,
  },
  idLabel: {
    fontSize: FONTS.SIZE_CAPTION,
    fontWeight: FONTS.BOLD,
    color: COLORS.SUCCESS_LIGHT,
    marginRight: 8,
    letterSpacing: 1,
  },
  idValue: {
    fontSize: FONTS.SIZE_BODY,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaItem: {
    alignItems: 'center',
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 16,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_SECONDARY,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 20,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
  },

  // Retry button
  retryButton: {
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  retryText: {
    fontSize: 20,
    fontWeight: FONTS.EXTRA_BOLD,
    letterSpacing: 3,
    textAlign: 'center',
  },

  // Dismiss button
  dismissButton: {
    backgroundColor: COLORS.SUCCESS,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    shadowColor: COLORS.SUCCESS,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  dismissText: {
    fontSize: 18,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.WHITE,
    letterSpacing: 3,
    textAlign: 'center',
  },
});

export default RecognitionResult;
