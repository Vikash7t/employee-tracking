import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { useState, useEffect } from 'react';

// Geofence radius (meters)
const GEOFENCE_RADIUS_METERS = 30;

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
  const [employeeId, setEmployeeId] = useState(''); // ✅ New: dynamic employeeId
  const [employeeName,setEmployeeName] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://192.168.100.9:3000/api/office-location');
        if (!res.ok) {
          throw new Error(`Failed to fetch office location: ${res.status}`);
        }
        const data = await res.json();
        if (!data.latitude || !data.longitude) {
          throw new Error('Invalid office location data received.');
        }

        console.log('🏢 Dynamic office location fetched:', data);
        setOfficeCoords({
          latitude: data.latitude,
          longitude: data.longitude,
        });

        try {
          const geocode = await Location.reverseGeocodeAsync({
            latitude: data.latitude,
            longitude: data.longitude,
          });

          if (geocode.length > 0) {
            const addr = geocode[0];
            const readableOfficeAddress = `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}, ${addr.postalCode || ''}`;
            console.log('🏢 Office readable address:', readableOfficeAddress);
            setOfficeAddress(readableOfficeAddress);
          } else {
            console.log('⚠️ No readable address found for office coordinates.');
            setOfficeAddress(null);
          }
        } catch (geoError) {
          console.error('❌ Error reverse geocoding office location:', geoError);
          setOfficeAddress(null);
        }

      } catch (err) {
        console.error('❌ Error fetching office location:', err);
        setErrorMsg('Error fetching reference location.');
      }
    })();
  }, []);

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

      startTracking(employeeId);
    } catch (error) {
      console.error('❌ Error during login:', error);
      setErrorMsg('Error starting location tracking.');
    }
  };

  const handleLogout = () => {
    if (subscriber) {
      subscriber.remove();
      setSubscriber(null);
      console.log('🛑 Tracking stopped.');
      setTrackingStarted(false);
      setLocation(null);
      setAddress(null);
      setLocationStatus(null);
      setDistanceFromOffice(null);
    }
  };

  const startTracking = async (employeeId) => {
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async (loc) => {
          setLocation(loc);

          console.log(
            'Live location:',
            loc.coords,
            'at',
            new Date().toISOString()
          );

          let newStatus = 'Unknown';

          if (officeCoords) {
            const distance = getDistanceMeters(
              loc.coords.latitude,
              loc.coords.longitude,
              officeCoords.latitude,
              officeCoords.longitude
            );

            setDistanceFromOffice(distance);

            console.log(`📏 Distance from office: ${distance.toFixed(2)} meters`);

            if (distance > GEOFENCE_RADIUS_METERS) {
              newStatus = "Employee is outside the workplace";
              setLocationStatus(newStatus);
              if (isInsideOffice) {
                console.log('🚪 Employee just left the office area!');
                setIsInsideOffice(false);
              }
            } else {
              newStatus = "Employee is inside the workplace";
              setLocationStatus(newStatus);
              if (!isInsideOffice) {
                console.log('🏠 Employee just returned to the office area!');
                setIsInsideOffice(true);
              }
            }
          }

          let readableAddress = 'Unknown address';
          try {
            const geocode = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });

            if (geocode.length > 0) {
              const addr = geocode[0];
              readableAddress = `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}, ${addr.postalCode || ''}`;
              console.log('🏠 Readable address:', readableAddress);
              setAddress(readableAddress);
            } else {
              console.log('⚠️ No address found for coordinates.');
              readableAddress = 'Reverse geocoding failed';
              setAddress(null);
            }
          } catch (error) {
            console.error('❌ Error in reverse geocoding:', error);
            readableAddress = 'Reverse geocoding failed';
          }

          sendLocationWithRetry(loc, readableAddress, newStatus, employeeId,employeeName);
        }
      );

      setSubscriber(sub);
      setTrackingStarted(true);
      console.log('✅ Tracking started.');
    } catch (error) {
      console.error('❌ Error starting tracking:', error);
      setErrorMsg('Could not start tracking.');
    }
  };

  let text = trackingStarted
    ? 'Tracking location...'
    : 'Press Login to start tracking.';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = `Lat: ${location.coords.latitude}\nLon: ${location.coords.longitude}`;
    
    if (address) {
      text += `\nyour Address: ${address}`;
    }

    if (distanceFromOffice !== null) {
      text += `\nDistance from office: ${distanceFromOffice.toFixed(2)} meters`;
    }

    if (locationStatus) {
      text += `\nStatus: ${locationStatus}`;
    }
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
          <Text style={styles.text}>Enter your  Name:</Text>
          <TextInput
           style={styles.input}
           placeholder="e.g. vikash singh"
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

const sendLocationWithRetry = async (
  location,
  readableAddress,
  newStatus,
  employeeId,
  employeeName,
  retries = 3,
  delayMs = 3000
) => {
  try {
    const now = new Date();
    const readableTime = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    });

    const res = await fetch('http://192.168.100.9:3000/api/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId,
        employeeName,
        address: readableAddress,
        timestamp: readableTime,
        status: newStatus,
      }),
    });

    if (!res.ok) {
      throw new Error(`Server responded with status ${res.status}`);
    }

    const data = await res.json();
    console.log('✅ Server JSON response:', data);
  } catch (error) {
    console.error(`❌ Error sending location: ${error.message}`);

    if (retries > 0) {
      console.log(
        `🔁 Retrying in ${delayMs / 1000}s... (${retries} attempts left)`
      );
      setTimeout(() => {
        sendLocationWithRetry(
          location,
          readableAddress,
          newStatus,
          employeeId,
          employeeName,
          retries - 1,
          delayMs
        );
      }, delayMs);
    } else {
      console.error('❌ All retry attempts failed. Giving up.');
    }
  }
};

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
