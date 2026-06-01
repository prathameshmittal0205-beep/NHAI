import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppFlowState } from '../types/theme';

const SESSION_KEY = '@nhai_attendance_session';

export interface SavedSession {
  flowState: AppFlowState;
  timestamp: number;
}

export const SessionCheckpoint = {
  /**
   * Save the current state of the attendance flow.
   * Only saves intermediate liveness states.
   */
  async save(state: AppFlowState): Promise<void> {
    if (state === 'idle' || state.startsWith('result_')) {
      await this.clear();
      return;
    }
    
    try {
      const session: SavedSession = {
        flowState: state,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save session checkpoint:', e);
    }
  },

  /**
   * Load the previous session if it exists and is less than 15 minutes old.
   */
  async load(): Promise<AppFlowState | null> {
    try {
      const data = await AsyncStorage.getItem(SESSION_KEY);
      if (data) {
        const session: SavedSession = JSON.parse(data);
        const ageMs = Date.now() - session.timestamp;
        
        // Expiry of 15 minutes for mid-flow sessions
        if (ageMs < 15 * 60 * 1000) {
          return session.flowState;
        } else {
          await this.clear();
        }
      }
    } catch (e) {
      console.error('Failed to load session checkpoint:', e);
    }
    return null;
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // ignore
    }
  }
};
