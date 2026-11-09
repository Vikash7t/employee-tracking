import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDeny: () => void;
}

export const ProminentDisclosureModal: React.FC<Props> = ({ visible, onAccept, onDeny }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>📍 Location Access Disclosure</Text>
          <Text style={styles.description}>
            GeoTrack collects location data even when the app is closed or not in use to:
          </Text>
          <Text style={styles.bullet}>• Automatically verify arrival and departure at assigned worksites.</Text>
          <Text style={styles.bullet}>• Ensure continuous shift compliance during your scheduled working hours.</Text>
          <Text style={styles.bullet}>• Eliminate manual punch delays while keeping battery consumption minimal.</Text>
          <Text style={styles.footerNote}>
            Your location is only captured during scheduled shifts and is never sold or used for marketing.
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.denyButton} onPress={onDeny}>
              <Text style={styles.denyText}>Not Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
              <Text style={styles.acceptText}>Agree & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginLeft: 8,
    marginBottom: 4,
  },
  footerNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  denyButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  denyText: {
    color: '#64748b',
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  acceptText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
