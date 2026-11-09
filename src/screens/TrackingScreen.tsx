import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StorageService } from '../services/storage.service';
import { LocationEngine, LocationObservation } from '../services/location-engine.service';
import { WorksiteDto } from '@employee-tracking/contracts';

interface Props {
  onLogout: () => void;
}

export const TrackingScreen: React.FC<Props> = ({ onLogout }) => {
  const [lastLocation, setLastLocation] = useState<LocationObservation | null>(null);
  const [worksites, setWorksites] = useState<WorksiteDto[]>([]);
  const [trackingActive, setTrackingActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      const loc = await StorageService.getLastLocation();
      if (loc) setLastLocation(loc);
      const isActive = await LocationEngine.isTrackingActive();
      setTrackingActive(isActive);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const cached = await StorageService.getCachedWorksites();
    setWorksites(cached);
    const loc = await StorageService.getLastLocation();
    if (loc) setLastLocation(loc);
    const isActive = await LocationEngine.isTrackingActive();
    setTrackingActive(isActive);
  };

  const toggleTracking = async () => {
    setLoading(true);
    try {
      if (trackingActive) {
        await LocationEngine.stopTracking();
        setTrackingActive(false);
      } else {
        await LocationEngine.startTracking(2);
        setTrackingActive(true);
      }
    } catch (err: any) {
      Alert.alert('Tracking Error', err.message || 'Failed to toggle location tracking');
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'INSIDE':
        return '#16a34a';
      case 'UNCERTAIN':
        return '#d97706';
      default:
        return '#dc2626';
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {lastLocation?.isMocked && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>⚠️ MOCK GPS DETECTED: Untrusted Location</Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Shift Status</Text>
          <View style={[styles.statusPill, { backgroundColor: trackingActive ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={[styles.statusPillText, { color: trackingActive ? '#166534' : '#991b1b' }]}>
              {trackingActive ? '● FOREGROUND ACTIVE' : '○ TRACKING PAUSED'}
            </Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Geofence Presence</Text>
            <Text style={[styles.metricValue, { color: getOutcomeColor(lastLocation?.outcome) }]}>
              {lastLocation?.outcome || 'SCANNING...'}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Distance to Nearest</Text>
            <Text style={styles.metricValue}>
              {lastLocation?.distanceToNearestMeters != null ? `${lastLocation.distanceToNearestMeters}m` : '--'}
            </Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>GPS Accuracy</Text>
            <Text style={styles.metricSub}>
              {lastLocation?.accuracy
                ? `±${Math.round(lastLocation.accuracy)}m ${lastLocation.accuracy <= 50 ? '(Acceptable)' : '(Degraded)'}`
                : '--'}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Assigned Worksites</Text>
            <Text style={styles.metricSub}>{worksites.length} registered</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, trackingActive ? styles.stopButton : styles.startButton]}
          onPress={toggleTracking}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {trackingActive ? 'Pause Shift Tracking' : 'Resume Shift Tracking'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Sign Out of Shift</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
  },
  mockBanner: {
    backgroundColor: '#b91c1c',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  mockBannerText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  startButton: {
    backgroundColor: '#2563eb',
  },
  stopButton: {
    backgroundColor: '#dc2626',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutButton: {
    marginTop: 20,
    alignItems: 'center',
    padding: 12,
  },
  logoutButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
});
