import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface PermissionsStatus {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  canAskAgain: boolean;
}

export const PermissionsService = {
  /**
   * Evaluates current permission states without prompting the user.
   */
  async checkPermissions(): Promise<PermissionsStatus> {
    const fg = await Location.getForegroundPermissionsAsync();
    let bgGranted = false;

    if (Platform.OS !== 'web') {
      const bg = await Location.getBackgroundPermissionsAsync();
      bgGranted = bg.status === Location.PermissionStatus.GRANTED;
    }

    return {
      foregroundGranted: fg.status === Location.PermissionStatus.GRANTED,
      backgroundGranted: bgGranted,
      canAskAgain: fg.canAskAgain,
    };
  },

  /**
   * Step 1: Request Foreground Location (ACCESS_FINE_LOCATION).
   * Must only be called after showing in-app prominent disclosure.
   */
  async requestForeground(): Promise<boolean> {
    const res = await Location.requestForegroundPermissionsAsync();
    return res.status === Location.PermissionStatus.GRANTED;
  },

  /**
   * Step 2: Request Background Location (ACCESS_BACKGROUND_LOCATION).
   * Must only be requested after foreground permission has been explicitly granted.
   */
  async requestBackground(): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    const fgStatus = await Location.getForegroundPermissionsAsync();
    if (fgStatus.status !== Location.PermissionStatus.GRANTED) {
      throw new Error('Foreground location permission must be granted before requesting background location.');
    }

    const res = await Location.requestBackgroundPermissionsAsync();
    return res.status === Location.PermissionStatus.GRANTED;
  },
};
