import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { useState, useEffect } from 'react';

const GEOFENCE_RADIUS_METERS = 30;
const OUTSIDE_THRESHOLD_MINUTES = 2;
const GAP_TIMEOUT_SECONDS = 30;

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [address, setAddress] = useState(null);
  const [isInsideOffice, setIsInsideOffice] = useState(true);
  const [officeCoords, setOfficeCoords] = useState(null);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [subscriber, setSubscriber] = useState(null);
  const [officeAddress, setOfficeAddress] = useState(null);
  const [locationStatus, setLocationStatus] = useState(null);
  const [distanceFromOffice, setDistanceFromOffice] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');

  // Outside tracking
  const [outsideStartTime, setOutsideStartTime] = useState(null);
  const [lastKnownOutsideAddress, setLastKnownOutsideAddress] = useState(null);
  const [outsideReported, setOutsideReported] = useState(false);

  // Gap tracking
  const [lastLocationTime, setLastLocationTime] = useState(null);
  const [gapStartTime, setGapStartTime] = useState(null);
  const [trackingGapActive, setTrackingGapActive] = useState(false);

  // First login ping tracking
  const [hasSentLoginPing, setHasSentLoginPing] = useState(false);

  // Fetch office location once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://employee-tracking-ph3i.onrender.com/api/office-location');
        const data = await res.json();
        setOfficeCoords({
          latitude: data.latitude,
          longitude: data.longitude,
        });

        const geocode = await Location.reverseGeocodeAsync({
          latitude: data.latitude,
          longitude: data.longitude,
        });

        if (geocode.length > 0) {
          const addr = geocode[0];
          const readableOfficeAddress = `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}, ${addr.postalCode || ''}`;
          setOfficeAddress(readableOfficeAddress);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Error fetching reference location.');
      }
    })();
  }, []);

  // Gap detection
  useEffect(() => {
    let interval;
    if (trackingStarted) {
      interval = setInterval(() => {
        if (lastLocationTime) {
          const now = new Date();
          const diff = (now - lastLocationTime) / 1000;
          if (diff > GAP_TIMEOUT_SECONDS && !trackingGapActive) {
            handleGapStart();
          }
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [trackingStarted, lastLocationTime, trackingGapActive]);

  const handleLogin = async () => {
    if (!employeeId.trim() || !employeeName.trim()) {
      setErrorMsg('Please enter your Employee ID and Name.');
      return;
    }

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      startTracking();
    } catch (error) {
      console.error(error);
      setErrorMsg('Error starting location tracking.');
    }
  };

  const handleLogout = () => {
    if (subscriber) {
      subscriber.remove();
      setSubscriber(null);
      setTrackingStarted(false);
      setLocation(null);
      setAddress(null);
      setLocationStatus(null);
      setDistanceFromOffice(null);
      setOutsideStartTime(null);
      setOutsideReported(false);
      setGapStartTime(null);
      setTrackingGapActive(false);
      setHasSentLoginPing(false);
    }
  };

  const startTracking = async () => {
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async (loc) => {
          setLastLocationTime(new Date());

          if (trackingGapActive) {
            handleGapEnd();
          }

          setLocation(loc);

          let newStatus = 'Unknown';

          if (officeCoords) {
            const distance = getDistanceMeters(
              loc.coords.latitude,
              loc.coords.longitude,
              officeCoords.latitude,
              officeCoords.longitude
            );

            setDistanceFromOffice(distance);

            if (distance > GEOFENCE_RADIUS_METERS) {
              // Employee outside
              newStatus = "Employee is outside the workplace";

              if (isInsideOffice) {
                setIsInsideOffice(false);
                setOutsideStartTime(new Date());
                const outsideAddr = await getReadableAddress(loc.coords);
                setLastKnownOutsideAddress(outsideAddr);
              } else {
                if (outsideStartTime) {
                  const diffMinutes = (new Date() - outsideStartTime) / (60 * 1000);
                  if (diffMinutes >= OUTSIDE_THRESHOLD_MINUTES && !outsideReported) {
                    await sendOutsideEvent(
                      employeeId,
                      employeeName,
                      outsideStartTime,
                      lastKnownOutsideAddress
                    );
                    setOutsideReported(true);
                  }
                }
              }
            } else {
              // Employee inside
              newStatus = "Employee is inside the workplace";

              if (!isInsideOffice) {
                const now = new Date();
                if (outsideStartTime) {
                  const durationMs = now - outsideStartTime;
                  const durationMinutes = durationMs / (60 * 1000);

                  await sendEmployeeReturn(
                    employeeId,
                    employeeName,
                    outsideStartTime,
                    now,
                    durationMinutes,
                    lastKnownOutsideAddress
                  );
                }
                setOutsideStartTime(null);
                setOutsideReported(false);
                setIsInsideOffice(true);
              }
            }
          }

          const readableAddress = await getReadableAddress(loc.coords);
          setAddress(readableAddress);

          // Only send the first ping while inside
          if (isInsideOffice) {
            if (!hasSentLoginPing) {
              await sendLocationWithRetry(
                loc,
                readableAddress,
                newStatus,
                employeeId,
                employeeName
              );
              setHasSentLoginPing(true);
            }
          }
        }
      );

      setSubscriber(sub);
      setTrackingStarted(true);
    } catch (error) {
      console.error(error);
      setErrorMsg('Could not start tracking.');
    }
  };

  const handleGapStart = () => {
    setGapStartTime(new Date());
    setTrackingGapActive(true);
  };

  const handleGapEnd = () => {
    const gapEnd = new Date();
    const durationMinutes = (gapEnd - gapStartTime) / (1000 * 60);
    sendTrackingGap(
      employeeId,
      employeeName,
      gapStartTime,
      gapEnd,
      durationMinutes,
      address
    );
    setGapStartTime(null);
    setTrackingGapActive(false);
  };

  let text = trackingStarted
    ? 'Tracking location...'
    : 'Press Login to start tracking.';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = `Lat: ${location.coords.latitude}\nLon: ${location.coords.longitude}`;
    if (address) text += `\nYour Address: ${address}`;
    if (distanceFromOffice !== null)
      text += `\nDistance from office: ${distanceFromOffice.toFixed(2)} meters`;
    if (locationStatus) text += `\nStatus: ${locationStatus}`;
  }

  return (
    <View style={styles.container}>
      {officeAddress && (
        <Text style={styles.text}>
          Office Address: {officeAddress}
        </Text>
      )}
      {!trackingStarted ? (
        <>
          <Text style={styles.text}>Enter your Employee ID:</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. EMP001"
            value={employeeId}
            onChangeText={setEmployeeId}
            autoCapitalize="characters"
          />
          <Text style={styles.text}>Enter your Name:</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Vikash Singh"
            value={employeeName}
            onChangeText={setEmployeeName}
          />
          <Button title="Login" onPress={handleLogin} />
        </>
      ) : (
        <>
          <Text style={styles.text}>{text}</Text>
          <Button title="Logout" onPress={handleLogout} color="#d9534f" />
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    width: '80%',
    marginBottom: 16,
    borderRadius: 4,
  },
});

// Keep your sendLocationWithRetry, sendOutsideEvent, sendEmployeeReturn, sendTrackingGap functions unchanged
