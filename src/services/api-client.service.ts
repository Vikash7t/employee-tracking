import { Platform } from 'react-native';
import {
  EmployeeLoginInput,
  EmployeeLoginResponse,
  VerifyPinInput,
  SpatialDistanceCheck,
  WorksiteDto,
} from '@employee-tracking/contracts';
import { StorageService } from './storage.service';

const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Android Emulator points to 10.0.2.2 for host machine localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }
  return 'http://localhost:4000';
};

export const ApiClient = {
  async loginEmployee(input: EmployeeLoginInput): Promise<EmployeeLoginResponse> {
    const res = await fetch(`${getBaseUrl()}/api/v1/auth/login/employee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message || `Login failed with status ${res.status}`);
    }

    return res.json();
  },

  async verifyPin(input: VerifyPinInput): Promise<{ valid: boolean }> {
    const token = await StorageService.getSessionToken();
    const res = await fetch(`${getBaseUrl()}/api/v1/auth/session/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'PIN verification failed' }));
      throw new Error(err.message || 'PIN verification failed');
    }

    return res.json();
  },

  async verifyPresence(
    worksiteId: string,
    latitude: number,
    longitude: number,
    accuracyMeters: number,
  ): Promise<SpatialDistanceCheck> {
    const token = await StorageService.getSessionToken();
    const res = await fetch(`${getBaseUrl()}/api/v1/worksites/${worksiteId}/verify-presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ latitude, longitude, accuracyMeters }),
    });

    if (!res.ok) {
      throw new Error(`Presence check failed with status ${res.status}`);
    }

    return res.json();
  },

  async fetchAssignedWorksites(organizationId: string): Promise<WorksiteDto[]> {
    const token = await StorageService.getSessionToken();
    const res = await fetch(`${getBaseUrl()}/api/v1/worksites?organizationId=${organizationId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch assigned worksites');
    }

    return res.json();
  },

  async syncBatch(events: any[]): Promise<{ acknowledgedEventIds: string[]; rejectedEvents: any[] }> {
    const token = await StorageService.getSessionToken();
    const res = await fetch(`${getBaseUrl()}/api/v1/sync/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });

    if (!res.ok) {
      throw new Error(`Sync batch failed with status ${res.status}`);
    }

    return res.json();
  },
};
