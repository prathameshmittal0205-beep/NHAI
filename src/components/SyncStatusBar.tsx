/**
 * SyncStatusBar — Sticky sync status indicator.
 *
 * Shows real-time sync state at the top of every screen:
 *   - OFFLINE: Amber bar — "X pending" with queue count
 *   - SYNCED:  Green bar  — "Synced to Datalake"
 *
 * Subscribes to SyncManager for live updates on flush events.
 * Auto-refreshes every 5 seconds when offline.
 *
 * Visual spec:
 *   - Sticky top bar, always visible
 *   - fontWeight >= 700 everywhere
 *   - Status icon + text + count badge
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { COLORS, FONTS, NetworkState } from '../types/theme';

// ============================================================
// Props
// ============================================================

interface SyncStatusBarProps {
  /** Current network state — 'online' or 'offline' */
  networkState: NetworkState;
  /** Number of pending (unsynced) attendance logs */
  pendingCount: number;
  /** Timestamp of last successful sync (ISO 8601 or null) */
  lastSyncTime?: string | null;
}

// ============================================================
// Pulsing Dot Indicator
// ============================================================

const PulsingDot: React.FC<{ color: string; isActive: boolean }> = ({ color, isActive }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.8,
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
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.3,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      opacityAnim.setValue(1);
    }
  }, [isActive, pulseAnim, opacityAnim]);

  return (
    <View style={styles.dotContainer}>
      {/* Outer pulse ring */}
      <Animated.View
        style={[
          styles.dotPulse,
          {
            backgroundColor: color,
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
      {/* Inner solid dot */}
      <View style={[styles.dotSolid, { backgroundColor: color }]} />
    </View>
  );
};

// ============================================================
// Main Component
// ============================================================

const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  networkState,
  pendingCount,
  lastSyncTime,
}) => {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const bgColorAnim = useRef(new Animated.Value(networkState === 'online' ? 1 : 0)).current;

  const isOnline = networkState === 'online';
  const isSynced = isOnline && pendingCount === 0;

  // Slide in on mount
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // Animate background color transition
  useEffect(() => {
    Animated.timing(bgColorAnim, {
      toValue: isSynced ? 1 : 0,
      duration: 400,
      useNativeDriver: false, // backgroundColor can't use native driver
    }).start();
  }, [isSynced, bgColorAnim]);

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.AMBER_DARK, '#064E3B'], // amber-dark -> green-dark
  });

  const accentColor = isSynced ? COLORS.SYNCED_GREEN : COLORS.OFFLINE_AMBER;

  // Format last sync time
  const syncTimeStr = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.innerContainer}>
        {/* Left: Status dot + text */}
        <View style={styles.leftSection}>
          <PulsingDot
            color={accentColor}
            isActive={!isSynced}
          />

          <View style={styles.textContainer}>
            <Text style={[styles.statusText, { color: accentColor }]}>
              {isSynced ? 'SYNCED TO DATALAKE' : 'OFFLINE MODE'}
            </Text>
            {syncTimeStr && isSynced && (
              <Text style={styles.syncTime}>Last sync: {syncTimeStr}</Text>
            )}
          </View>
        </View>

        {/* Right: Pending count badge */}
        {pendingCount > 0 && (
          <View style={[styles.badge, { backgroundColor: accentColor }]}>
            <Text style={styles.badgeText}>
              {pendingCount}
            </Text>
            <Text style={styles.badgeLabel}>PENDING</Text>
          </View>
        )}

        {/* Right: Synced checkmark */}
        {isSynced && (
          <View style={[styles.checkBadge, { borderColor: COLORS.SYNCED_GREEN }]}>
            <Text style={[styles.checkIcon, { color: COLORS.SYNCED_GREEN }]}>
              OK
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 10,
    paddingHorizontal: 16,
    // Bottom edge shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: FONTS.BOLD,
    letterSpacing: 1.5,
  },
  syncTime: {
    fontSize: 11,
    fontWeight: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
  },

  // Pulsing dot
  dotContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotPulse: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotSolid: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Pending badge
  badge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 56,
  },
  badgeText: {
    fontSize: 18,
    fontWeight: FONTS.EXTRA_BOLD,
    color: COLORS.BLACK,
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: FONTS.BOLD,
    color: COLORS.BLACK,
    letterSpacing: 1,
    marginTop: -2,
  },

  // Synced checkmark
  checkBadge: {
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: FONTS.EXTRA_BOLD,
    letterSpacing: 1,
  },
});

export default SyncStatusBar;
