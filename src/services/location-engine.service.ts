import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { StorageService } from './storage.service';
import { ApiClient } from './api-client.service';
import { WorksiteDto } from '@employee-tracking/contracts';

export const LOCATION_TRACKING_TASK = 'GEO_TRACK_LOCATION_TASK';

export interface LocationObservation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  isMocked: boolean;
  timestamp: number;
  nearestWorksiteId?: string;
  distanceToNearestMeters?: number;
  outcome?: 'INSIDE' | 'OUTSIDE' | 'UNCERTAIN';
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Register headless background task
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[LocationEngine] Background tracking error:', error);
    return;
  }

  if (!data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  const isMocked = Boolean(latest.mocked);

  // Load cached worksites to determine nearest worksite
  const worksites: WorksiteDto[] = await StorageService.getCachedWorksites();
  let nearestWorksite: WorksiteDto | undefined;
  let minDistance = Infinity;

  for (const site of worksites) {
    const dist = haversineMeters(
      latest.coords.latitude,
      latest.coords.longitude,
      site.latitude,
      site.longitude,
    );
    if (dist < minDistance) {
      minDistance = dist;
      nearestWorksite = site;
    }
  }

  let outcome: 'INSIDE' | 'OUTSIDE' | 'UNCERTAIN' = 'OUTSIDE';

  // If near worksite or within range, verify presence against backend
  if (nearestWorksite && minDistance <= Math.max(nearestWorksite.radiusMeters * 3, 200)) {
    try {
      const presence = await ApiClient.verifyPresence(
        nearestWorksite.id,
        latest.coords.latitude,
        latest.coords.longitude,
        latest.coords.accuracy || 10,
      );
      outcome = presence.outcome;
    } catch {
      // Offline fallback calculation
      if (minDistance <= nearestWorksite.radiusMeters) {
        outcome = 'INSIDE';
      }
    }
  }

  const observation: LocationObservation = {
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    accuracy: latest.coords.accuracy || 0,
    altitude: latest.coords.altitude,
    speed: latest.coords.speed,
    isMocked,
    timestamp: latest.timestamp,
    nearestWorksiteId: nearestWorksite?.id,
    distanceToNearestMeters: Math.round(minDistance * 100) / 100,
    outcome,
  };

  await StorageService.saveLastLocation(observation);
});

export const LocationEngine = {
  /**
   * Starts the background location foreground-service loop with adaptive parameters.
   */
  async startTracking(tier: 1 | 2 | 3 = 2): Promise<void> {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (isRunning) return;

    let timeInterval = 60000; // 60 seconds
    let distanceInterval = 25; // 25 meters
    let accuracy = Location.Accuracy.High;

    if (tier === 1) {
      timeInterval = 120000; // 2 minutes
      distanceInterval = 50;  // 50 meters
      accuracy = Location.Accuracy.Balanced;
    } else if (tier === 3) {
      timeInterval = 15000;  // 15 seconds
      distanceInterval = 10;  // 10 meters
      accuracy = Location.Accuracy.Highest;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy,
      timeInterval,
      distanceInterval,
      deferredUpdatesInterval: timeInterval,
      deferredUpdatesDistance: distanceInterval,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'GeoTrack Active',
        notificationBody: 'Continuous worksite attendance verification',
        notificationColor: '#2B5C8F',
      },
    });
  },

  async stopTracking(): Promise<void> {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    }
  },

  async isTrackingActive(): Promise<boolean> {
    return Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  },
};
