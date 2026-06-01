/**
 * LivenessPrompt — Animated liveness challenge overlay.
 *
 * Displays one of three challenge types (Blink, Smile, Head Turn)
 * with a countdown ring timer and bold sunlight-readable instructions.
 *
 * Uses React Native Animated API exclusively — no Lottie dependency.
 *
 * Visual spec:
 *   - Amber/yellow (#F59E0B) background during active challenge
 *   - fontSize >= 28, fontWeight: 900 for all instruction text
 *   - Animated SVG ring countdown showing remaining seconds
 *   - Pulsing icon animation per challenge type
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { COLORS, FONTS, ChallengeType, CHALLENGE_CONFIGS } from '../types/theme';

// ============================================================
// Props
// ============================================================

interface LivenessPromptProps {
  challengeType: ChallengeType;
  isActive: boolean;
  onChallengeComplete: (success: boolean) => void;
  onTimeout: () => void;
}

// ============================================================
// Countdown Ring (Pure RN Animated — no SVG needed)
// ============================================================

const CountdownRing: React.FC<{
  totalSeconds: number;
  remainingSeconds: number;
  size: number;
}> = ({ totalSeconds, remainingSeconds, size }) => {
  const progress = remainingSeconds / totalSeconds;
  const ringColor = progress > 0.3 ? COLORS.WHITE : COLORS.FAILURE_LIGHT;

  // We simulate a ring with four quadrant masks using Animated transforms
  // This avoids the react-native-svg dependency entirely
  const borderWidth = 6;
  const innerSize = size - borderWidth * 2;

  return (
    <View style={[styles.ringContainer, { width: size, height: size }]}>
      {/* Background ring (dark) */}
      <View
        style={[
          styles.ringBase,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: 'rgba(0,0,0,0.3)',
          },
        ]}
      />
      {/* Foreground progress ring — simplified with border approach */}
      <View
        style={[
          styles.ringProgress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: ringColor,
            // Clip to show progress using opacity segments
            borderTopColor: progress > 0.75 ? ringColor : 'transparent',
            borderRightColor: progress > 0.5 ? ringColor : 'transparent',
            borderBottomColor: progress > 0.25 ? ringColor : 'transparent',
            borderLeftColor: progress > 0 ? ringColor : 'transparent',
          },
        ]}
      />
      {/* Center text */}
      <View style={[styles.ringCenter, { width: innerSize, height: innerSize }]}>
        <Text style={[styles.ringText, { fontSize: size * 0.35 }]}>
          {remainingSeconds}
        </Text>
        <Text style={[styles.ringLabel, { fontSize: size * 0.12 }]}>
          SEC
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// Animated Challenge Icon
// ============================================================

const AnimatedIcon: React.FC<{ challengeType: ChallengeType; isActive: boolean }> = ({
  challengeType,
  isActive,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) return;

    // Pulse animation for blink/smile
    if (challengeType === 'blink' || challengeType === 'smile') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }

    // Rotate animation for head turn
    if (challengeType === 'head_turn') {
      const rotate = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      rotate.start();
      return () => rotate.stop();
    }
  }, [isActive, challengeType, pulseAnim, rotateAnim]);

  const config = CHALLENGE_CONFIGS[challengeType];

  const iconStyle: any[] = [styles.challengeIcon];

  if (challengeType === 'head_turn') {
    const rotate = rotateAnim.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: ['-30deg', '0deg', '30deg'],
    });
    iconStyle.push({ transform: [{ rotate }] });
  } else {
    iconStyle.push({ transform: [{ scale: pulseAnim }] });
  }

  // Render text-based icons for each challenge type
  const iconContent = challengeType === 'blink'
    ? 'O  O'
    : challengeType === 'smile'
    ? '^^'
    : '<-->';

  return (
    <Animated.View style={iconStyle}>
      <Text style={styles.iconText}>{iconContent}</Text>
      <Text style={styles.iconLabel}>{config.icon}</Text>
    </Animated.View>
  );
};

// ============================================================
// Main Component
// ============================================================

const LivenessPrompt: React.FC<LivenessPromptProps> = ({
  challengeType,
  isActive,
  onChallengeComplete,
  onTimeout,
}) => {
  const config = CHALLENGE_CONFIGS[challengeType];
  const [remainingSeconds, setRemainingSeconds] = useState(config.durationSeconds);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Entry animation
  useEffect(() => {
    if (isActive) {
      setRemainingSeconds(config.durationSeconds);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [isActive, config.durationSeconds, fadeAnim, slideAnim]);

  // Countdown timer
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, onTimeout]);

  if (!isActive) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Amber background overlay */}
      <View style={styles.backgroundOverlay} />

      {/* Content */}
      <View style={styles.content}>
        {/* Challenge instruction */}
        <Text style={styles.instructionLabel}>LIVENESS CHECK</Text>

        {/* Animated icon */}
        <AnimatedIcon challengeType={challengeType} isActive={isActive} />

        {/* Main instruction text */}
        <Text style={styles.instructionText}>
          {config.instruction}
        </Text>

        {/* Countdown ring */}
        <CountdownRing
          totalSeconds={config.durationSeconds}
          remainingSeconds={remainingSeconds}
          size={120}
        />

        {/* Sub-instruction */}
        <Text style={styles.subInstruction}>
          LOOK DIRECTLY AT THE CAMERA
        </Text>
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
    zIndex: 100,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.AMBER,
    opacity: 0.92,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  instructionLabel: {
    fontSize: FONTS.SIZE_BODY,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.AMBER_BG,
    letterSpacing: 4,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  challengeIcon: {
    marginBottom: 20,
    alignItems: 'center',
  },
  iconText: {
    fontSize: 56,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.AMBER_BG,
    textAlign: 'center',
  },
  iconLabel: {
    fontSize: 40,
    marginTop: 4,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: FONTS.SIZE_TITLE,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.BLACK,
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 2,
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subInstruction: {
    fontSize: FONTS.SIZE_BODY,
    fontWeight: FONTS.BOLD,
    color: COLORS.AMBER_DARK,
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 1.5,
  },

  // Countdown ring
  ringContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ringBase: {
    position: 'absolute',
  },
  ringProgress: {
    position: 'absolute',
  },
  ringCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringText: {
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.AMBER_BG,
  },
  ringLabel: {
    fontWeight: FONTS.BOLD,
    color: COLORS.AMBER_DARK,
    letterSpacing: 2,
    marginTop: -2,
  },
});

export default LivenessPrompt;
