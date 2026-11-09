import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorksiteDto } from '@employee-tracking/contracts';

const KEYS = {
  SESSION_TOKEN: 'geotrack_session_token',
  DEVICE_SECRET: 'geotrack_device_secret',
  PIN_HASH: 'geotrack_pin_hash',
  DEVICE_ID: 'geotrack_device_id',
  ORG_SLUG: 'geotrack_org_slug',
  EMPLOYEE_CODE: 'geotrack_employee_code',
  EMPLOYEE_PROFILE_ID: 'geotrack_profile_id',
  CACHED_WORKSITES: 'geotrack_cached_worksites',
  LAST_LOCATION: 'geotrack_last_location',
};

export const StorageService = {
  // Encrypted Credential Storage (Android Keystore / iOS Keychain)
  async saveCredentials(data: {
    token: string;
    deviceSecret?: string;
    orgSlug: string;
    employeeCode: string;
    profileId: string;
  }): Promise<void> {
    await SecureStore.setItemAsync(KEYS.SESSION_TOKEN, data.token);
    if (data.deviceSecret) {
      await SecureStore.setItemAsync(KEYS.DEVICE_SECRET, data.deviceSecret);
    }
    await SecureStore.setItemAsync(KEYS.ORG_SLUG, data.orgSlug);
    await SecureStore.setItemAsync(KEYS.EMPLOYEE_CODE, data.employeeCode);
    await SecureStore.setItemAsync(KEYS.EMPLOYEE_PROFILE_ID, data.profileId);
  },

  async getSessionToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.SESSION_TOKEN);
  },

  async getDeviceSecret(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.DEVICE_SECRET);
  },

  async getProfileId(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.EMPLOYEE_PROFILE_ID);
  },

  async clearCredentials(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.SESSION_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.DEVICE_SECRET);
    await SecureStore.deleteItemAsync(KEYS.EMPLOYEE_PROFILE_ID);
  },

  // Non-sensitive App Cache (AsyncStorage)
  async saveCachedWorksites(worksites: WorksiteDto[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CACHED_WORKSITES, JSON.stringify(worksites));
  },

  async getCachedWorksites(): Promise<WorksiteDto[]> {
    const raw = await AsyncStorage.getItem(KEYS.CACHED_WORKSITES);
    return raw ? JSON.parse(raw) : [];
  },

  async saveLastLocation(location: any): Promise<void> {
    await AsyncStorage.setItem(KEYS.LAST_LOCATION, JSON.stringify(location));
  },

  async getLastLocation(): Promise<any | null> {
    const raw = await AsyncStorage.getItem(KEYS.LAST_LOCATION);
    return raw ? JSON.parse(raw) : null;
  },
};
