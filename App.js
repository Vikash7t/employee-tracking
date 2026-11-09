import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StorageService } from './src/services/storage.service';
import { PermissionsService } from './src/services/permissions.service';
import { LocationEngine } from './src/services/location-engine.service';
import { ProminentDisclosureModal } from './src/components/ProminentDisclosureModal';
import { LoginScreen } from './src/screens/LoginScreen';
import { TrackingScreen } from './src/screens/TrackingScreen';

export default function App() {
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showDisclosure, setShowDisclosure] = useState(false);

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    try {
      const savedToken = await StorageService.getSessionToken();
      setToken(savedToken);

      if (savedToken) {
        const perms = await PermissionsService.checkPermissions();
        if (!perms.foregroundGranted || !perms.backgroundGranted) {
          setShowDisclosure(true);
        } else {
          await LocationEngine.startTracking(2);
        }
      }
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleAgreeDisclosure = async () => {
    setShowDisclosure(false);
    const fg = await PermissionsService.requestForeground();
    if (fg) {
      await PermissionsService.requestBackground();
      await LocationEngine.startTracking(2);
    }
  };

  const handleLogout = async () => {
    await LocationEngine.stopTracking();
    await StorageService.clearCredentials();
    setToken(null);
  };

  if (checkingAuth) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ProminentDisclosureModal
        visible={showDisclosure}
        onAccept={handleAgreeDisclosure}
        onDeny={() => setShowDisclosure(false)}
      />
      {token ? (
        <TrackingScreen onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={checkInitialState} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
