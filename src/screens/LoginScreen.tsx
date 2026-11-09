import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ApiClient } from '../services/api-client.service';
import { StorageService } from '../services/storage.service';

interface Props {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [orgSlug, setOrgSlug] = useState('acme-corp');
  const [employeeCode, setEmployeeCode] = useState('EMP-001');
  const [password, setPassword] = useState('EmployeePass123!');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!orgSlug || !employeeCode || !password) {
      Alert.alert('Required Fields', 'Please enter Organization Slug, Employee Code, and Password.');
      return;
    }

    setLoading(true);
    try {
      const res = await ApiClient.loginEmployee({
        organizationSlug: orgSlug.trim(),
        employeeCode: employeeCode.trim(),
        password,
        deviceId: Platform.OS + '-' + (Platform.Version || 'default'),
        deviceModel: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
        osVersion: String(Platform.Version),
      });

      await StorageService.saveCredentials({
        token: res.token,
        deviceSecret: res.deviceSecret,
        orgSlug: res.organization.slug,
        employeeCode: res.employeeProfile.employeeCode,
        profileId: res.employeeProfile.id,
      });

      if (res.organization.id) {
        const worksites = await ApiClient.fetchAssignedWorksites(res.organization.id).catch(() => []);
        await StorageService.saveCachedWorksites(worksites);
      }

      onLoginSuccess();
    } catch (err: any) {
      Alert.alert('Authentication Failed', err.message || 'Invalid credentials or organization not found.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.badge}>GeoTrack Enterprise</Text>
        <Text style={styles.title}>Workforce Sign In</Text>
        <Text style={styles.subtitle}>Enter your company credentials to begin your shift</Text>

        <Text style={styles.label}>Organization Slug</Text>
        <TextInput
          style={styles.input}
          value={orgSlug}
          onChangeText={setOrgSlug}
          placeholder="e.g. acme-corp"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Employee Code</Text>
        <TextInput
          style={styles.input}
          value={employeeCode}
          onChangeText={setEmployeeCode}
          placeholder="e.g. EMP-001"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Authenticate & Start Shift</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
