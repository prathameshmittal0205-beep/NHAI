/**
 * NHAI Design System — Shared types, constants, and theme values.
 *
 * All UI components reference this file for colors, typography,
 * and shared interfaces to maintain visual consistency.
 */

// ============================================================
// Color Palette — High-Contrast for Outdoor/Sunlight Use
// ============================================================

export const COLORS = {
  // Primary states
  SUCCESS:        '#16A34A',
  SUCCESS_LIGHT:  '#22C55E',
  SUCCESS_BG:     '#052E16',
  FAILURE:        '#DC2626',
  FAILURE_LIGHT:  '#EF4444',
  FAILURE_BG:     '#450A0A',
  TIMEOUT:        '#6B7280',
  TIMEOUT_LIGHT:  '#9CA3AF',
  TIMEOUT_BG:     '#1F2937',

  // Liveness challenge
  AMBER:          '#F59E0B',
  AMBER_LIGHT:    '#FBBF24',
  AMBER_DARK:     '#B45309',
  AMBER_BG:       '#451A03',

  // Sync states
  SYNCED_GREEN:   '#16A34A',
  OFFLINE_AMBER:  '#F59E0B',

  // Neutrals
  WHITE:          '#FFFFFF',
  BLACK:          '#000000',
  DARK_BG:        '#0F172A',
  CARD_BG:        '#1E293B',
  TEXT_PRIMARY:   '#F8FAFC',
  TEXT_SECONDARY: '#94A3B8',
  BORDER:         '#334155',
} as const;

// ============================================================
// Typography — Bold, Sunlight-Readable
// ============================================================

export const FONTS = {
  EXTRA_BOLD: '900' as const,
  BOLD:       '800' as const,
  SEMI_BOLD:  '700' as const,

  SIZE_HERO:    48,
  SIZE_TITLE:   32,
  SIZE_HEADING:  28,
  SIZE_BODY:     18,
  SIZE_CAPTION:  14,
} as const;

// ============================================================
// Challenge Types
// ============================================================

export type ChallengeType = 'blink' | 'smile' | 'head_turn';

export interface ChallengeConfig {
  type: ChallengeType;
  instruction: string;
  icon: string;
  durationSeconds: number;
}

export const CHALLENGE_CONFIGS: Record<ChallengeType, ChallengeConfig> = {
  blink: {
    type: 'blink',
    instruction: 'BLINK YOUR EYES',
    icon: '👁',
    durationSeconds: 5,
  },
  smile: {
    type: 'smile',
    instruction: 'SMILE WIDE',
    icon: '😊',
    durationSeconds: 5,
  },
  head_turn: {
    type: 'head_turn',
    instruction: 'TURN HEAD LEFT',
    icon: '↩',
    durationSeconds: 7,
  },
};

// ============================================================
// Recognition Result
// ============================================================

export type RecognitionStatus = 'success' | 'failure' | 'timeout';

export interface RecognitionData {
  status: RecognitionStatus;
  personnelName?: string;
  personnelId?: string;
  confidenceScore?: number;
  timestamp: string;
}

// ============================================================
// App Flow State
// ============================================================

export type NetworkState = 'online' | 'offline';

export type AppFlowState =
  | 'idle'
  | 'camera_ready'
  | 'liveness_blink'
  | 'liveness_smile'
  | 'liveness_head_turn'
  | 'processing'
  | 'result_success'
  | 'result_failure'
  | 'result_timeout';
