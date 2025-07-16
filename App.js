import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { useState, useEffect, useRef } from 'react';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';



const GEOFENCE_RADIUS_METERS = 30;
const LOCATION_TASK_NAME = 'background-location-task';         


let bgLeftOfficeTimeout = null;
let bgHasLeftOffice = false;                               

// task manager  for background
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background error:", error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      try {
        const storedCoords = await AsyncStorage.getItem('officeCoords');
        const storedEmployeeId = await AsyncStorage.getItem('employeeId');
        const storedEmployeeName = await AsyncStorage.getItem('employeeName');

        if (!storedCoords || !storedEmployeeId || !storedEmployeeName) {
          console.log("❌ Background: Missing data in AsyncStorage");
          return;
        }

        const officeCoords = JSON.parse(storedCoords);

        const distance = getDistanceMeters(
          location.coords.latitude,
          location.coords.longitude,
          officeCoords.latitude,
          officeCoords.longitude
        );

        if (distance > GEOFENCE_RADIUS_METERS) {
          if (!bgLeftOfficeTimeout && !bgHasLeftOffice) {
            console.log("🚪 [BG] Left geofence. Starting 2-min timer...");

            bgLeftOfficeTimeout = setTimeout(async () => {
              await sendLocationWithRetry(
                location,
                await getReadableAddress(location,3,2000),
                "Left workplace (>2 min outside)",
                storedEmployeeId,
                storedEmployeeName
              );
              bgHasLeftOffice = true;
              bgLeftOfficeTimeout = null;
            }, 2 * 60 * 1000);
          }
        } else {
          if (bgLeftOfficeTimeout) {
            console.log("✅ [BG] Returned inside before 2 min. Cancelling timer.");
            clearTimeout(bgLeftOfficeTimeout);
            bgLeftOfficeTimeout = null;
          }

          if (bgHasLeftOffice) {
            console.log("🏠 [BG] Returned to workplace after leaving.");
            await sendLocationWithRetry(
              location,
              await getReadableAddress(location,3,2000),
              "Returned to workplace",
              storedEmployeeId,
              storedEmployeeName
            );
            bgHasLeftOffice = false;
          }
        }
      } catch (err) {
        console.error("❌ Error in background task:", err);
      }
    }
  }
});




export default function App() {
  const gpsGapStartRef = useRef(null);
  const internetGapStartRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [address, setAddress] = useState(null);
  const [officeCoords, setOfficeCoords] = useState(null);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [subscriber, setSubscriber] = useState(null);
  const [officeAddress, setOfficeAddress] = useState(null);
  const [locationStatus, setLocationStatus] = useState(null);
  const [distanceFromOffice, setDistanceFromOffice] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const employeeIdRef = useRef(null);
  const employeeNameRef = useRef(null);
  const [gpsLastAddress, setGpsLastAddress] = useState(null);
  const [internetLastAddress, setInternetLastAddress] = useState(null);
  const lastGpsStatus = useRef(null); // Tracks the previous GPS ON/OFF state
  const lastInternetStatus = useRef(null); // tracks the previous gps on/off state 


// ✅ Save GPS gap session locally
async function saveGpsGapSession(startTime, lastAddress) {
  const session = {
    startTime,
    endTime: null,
    lastKnownAddress: lastAddress,
  };
  await AsyncStorage.setItem('pendingGPSGap', JSON.stringify(session));
}

// ✅ Remove GPS gap session
async function clearGpsGapSession() {
  await AsyncStorage.removeItem('pendingGPSGap');
}






// ✅ Save Internet gap session locally
async function saveInternetGapSession(startTime, lastAddress) {
  const session = {
    startTime,
    endTime: null,
    lastKnownAddress: lastAddress,
  };
  await AsyncStorage.setItem('pendingInternetGap', JSON.stringify(session));
}

// ✅ Remove Internet gap session
async function clearInternetGapSession() {
  await AsyncStorage.removeItem('pendingInternetGap');
}







  
// testing the connectivity
async function testConnectivity() {
  try {
    const gpsOn = await Location.hasServicesEnabledAsync();
    const netState = await Network.getNetworkStateAsync();
    const netOn = netState.isConnected;

    console.log("🔎 TEST GPS ON:", gpsOn);
    console.log("🔎 TEST INTERNET ON:", netOn);

    alert(`GPS ON: ${gpsOn}\nInternet ON: ${netOn}`);
  } catch (error) {
    console.error("❌ Error testing connectivity:", error);
    alert("Error testing connectivity.");
  }
}




const fetchOfficeLocation = async () => {
  try {
    const res = await fetch('https://employee-tracking-ph3i.onrender.com/api/office-location');
    const data = await res.json();

    if (!data.latitude || !data.longitude) {
      throw new Error('Invalid office location data received.');
    }

    const coords = { latitude: data.latitude, longitude: data.longitude };
    setOfficeCoords(coords);

    const geocode = await Location.reverseGeocodeAsync(data);
    if (geocode.length > 0) {
      const addr = geocode[0];
      const readableOfficeAddress = `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}, ${addr.postalCode || ''}`;
      setOfficeAddress(readableOfficeAddress);
    }

    return coords;
  } catch (err) {
    console.error('❌ Error fetching office location:', err);
    setErrorMsg('Error fetching reference location.');
    return null;
  }
};


useEffect(() => {
    fetchOfficeLocation();
  }, []);



useEffect(() => {
  if (trackingStarted) {
    const interval = setInterval(() => {
      checkConnectivityGaps();
    }, 10000);

    return () => clearInterval(interval);
  }
}, [trackingStarted]);

 


async function checkConnectivityGaps() {
  const gpsOn = await Location.hasServicesEnabledAsync();
  const netState = await Network.getNetworkStateAsync();
  const netOn = netState.isConnected;

// ✅ Log only if GPS status changed
  if (gpsOn !== lastGpsStatus.current) {
    if (!gpsOn) {
      console.log("🚫 GPS turned off.");
    } else {
      console.log("✅ GPS is ON.");
    }
    lastGpsStatus.current = gpsOn;
  }



  // ✅ Handle GPS OFF
 if (!gpsOn) {
  if (!gpsGapStartRef.current) {
    
    const now = Date.now();
    
 // fallback address logic
 const savedLastAddress = await AsyncStorage.getItem('gpsLastKnownAddress');
    const lastAddress = gpsLastAddress || savedLastAddress  || address || "Unknown";

    gpsGapStartRef.current = now;

    console.log("💡 Saving gap session with address:", lastAddress);
    await saveGpsGapSession(new Date(now).toISOString(), lastAddress);

    await sendGpsGapToBackend(new Date(now), null, lastAddress);
                             }
                     } 


else {
  
if (gpsOn && gpsGapStartRef.current) {
    const start = new Date(gpsGapStartRef.current);
    const end = new Date();

    const durationMinutes = Math.round((end - start) / (1000 * 60));

    console.log("➡️ Closing GPS gap.");
    console.log("📤 Closing GPS gap from", start, "to", end);

    await sendGpsGapToBackend(start, end, gpsLastAddress, durationMinutes);

    gpsGapStartRef.current = null;          // ✅ CLEAR IT!
    setGpsLastAddress(null);
    await clearGpsGapSession();             // ✅ Also clear AsyncStorage
                                      }

        }     





// ✅ Log only if Internet status changed
if (netOn !== lastInternetStatus.current) {
  if (!netOn) {
    console.log("🚫 Internet disconnected.");
  } else {
    console.log("✅ Internet connected.");
  }
  lastInternetStatus.current = netOn;
}



// ✅ Handle Internet OFF
  if (!netOn) {
  if (!internetGapStartRef.current) {
    console.log("🚫 Internet disconnected.");
    const now = Date.now();

    // fallback address logic
    const savedLastAddress = await AsyncStorage.getItem('internetLastKnownAddress');
    const lastAddress = gpsLastAddress || savedLastAddress || address || "Unknown";

    internetGapStartRef.current = now;

    console.log("💡 Saving Internet gap session with address:", lastAddress);

    await saveInternetGapSession(new Date(now).toISOString(), lastAddress);

   console.log("✅ Internet gap saved locally. Will send when internet is back.");
                                }
            }


  else {
  if (internetGapStartRef.current) {
    const start = new Date(internetGapStartRef.current);
    const end = new Date();

    const durationMinutes = Math.round((end - start) / (1000 * 60));

    console.log("➡️ Closing Internet gap.");
    console.log("📤 Closing Internet gap from", start, "to", end);

    await sendInternetGapToBackend(
      
      start,
      end,
      internetLastAddress,
      durationMinutes
      
    );

    internetGapStartRef.current = null;             // ✅ CLEAR IT!
    setInternetLastAddress(null);
    await clearInternetGapSession();           // ✅ Also clear AsyncStorage
                                   }
        }




  // ✅ If a GPS gap started offline, flush it now
  const pendingGap = await AsyncStorage.getItem('pendingGPSGap');
  if (pendingGap && gpsOn) {
    const gap = JSON.parse(pendingGap);
    console.log("📤 Flushing pending GPS gap from offline...");
    const end = new Date();
    const start = new Date(gap.startTime);
    const durationMinutes = Math.round((end - start) / (1000 * 60));
    await sendGpsGapToBackend(start, end, gap.lastKnownAddress, durationMinutes);
    
    await clearGpsGapSession();
    gpsGapStartRef.current = null;
    console.log('✅ pendingGPSGap cleared from AsyncStorage');
  }

// ✅ If an Internet gap started offline, flush it now
  const pendingInternetGap = await AsyncStorage.getItem('pendingInternetGap');
  if (pendingInternetGap && netOn) {
  const gap = JSON.parse(pendingInternetGap);
  console.log("📤 Flushing pending Internet gap from offline...");

  const end = new Date();
  const start = new Date(gap.startTime);
  const durationMinutes = Math.round((end - start) / (1000 * 60));

  await sendInternetGapToBackend(
    
    start,
    end,
     gap.lastKnownAddress,
    durationMinutes );

  await clearInternetGapSession();
  internetGapStartRef.current = null;
  console.log('✅ pendingInternetGap cleared from AsyncStorage');}

}




// handle login page
  const handleLogin = async () => {

       if (!employeeId.trim() || !employeeName.trim()) {
      setErrorMsg('Please enter your Employee ID and Name.');
      return;
    }
    if (!officeCoords || !officeCoords.latitude || !officeCoords.longitude) {
      setErrorMsg("Office coordinates are not loaded yet. Please wait a moment and try again.");
      return;
    }

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let bgStatus = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus.status !== 'granted') {
        setErrorMsg('Background location permission denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const readableAddress = await getReadableAddress(loc,3,2000);
      setGpsLastAddress(readableAddress);
      setInternetLastAddress(readableAddress);


      let newStatus = "Login";

      if (officeCoords) {
        const distance = getDistanceMeters(
          loc.coords.latitude,
          loc.coords.longitude,
          officeCoords.latitude,
          officeCoords.longitude
        );

        if (distance > GEOFENCE_RADIUS_METERS) {
          newStatus = "Login - outside workplace";
        } else {
          newStatus = "Login - inside workplace";
        }
      }



      sendLocationWithRetry(loc, readableAddress, newStatus, employeeId, employeeName);

      await AsyncStorage.setItem('employeeId', employeeId);
      await AsyncStorage.setItem('employeeName', employeeName);
      await AsyncStorage.setItem('officeCoords', JSON.stringify(officeCoords));
      employeeIdRef.current = employeeId;
      employeeNameRef.current = employeeName;

      const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!alreadyStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 10000,
          distanceInterval: 10,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: 'GPS Tracking',
            notificationBody: 'Location tracking in progress',
            notificationColor: '#ff0000',
          },
        });
        console.log('✅ Background tracking started.');
      } else {
        console.log('Background tracking already running, skipping start.');
      }

      setErrorMsg(null);
      startTracking();
    } catch (error) {
      console.error('❌ Error during login:', error);
      setErrorMsg('Error starting location tracking.');
    }
  };

function formatToMySQLDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}



 async function sendGpsGapToBackend(start, end, lastKnownAddress, durationMinutes = null) {
  try {
    const storedEmployeeId = employeeIdRef.current;
    const storedEmployeeName = employeeNameRef.current;

    const body = {
      employeeId: storedEmployeeId,
      employeeName: storedEmployeeName,
      gapType: 'GPS',
      startTimestamp: formatToMySQLDate(start),
      endTimestamp: formatToMySQLDate(end),
      durationMinutes,
      lastKnownAddress
    };

    console.log("➡️ Sending GPS gap to backend:", body);

    const res = await fetch('https://employee-tracking-ph3i.onrender.com/api/track-gap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error("❌ Failed to send GPS gap:", res.status);
    } else {
      console.log("✅ GPS gap saved successfully.");
    }
  } catch (error) {
    console.error("❌ Error sending GPS gap:", error);
  }
}


async function sendInternetGapToBackend(start, end, lastKnownAddress, durationMinutes = null) {
  try {
    const storedEmployeeId = employeeIdRef.current;
    const storedEmployeeName = employeeNameRef.current;

    const body = {
      employeeId: storedEmployeeId,
      employeeName: storedEmployeeName,
      gapType: 'INTERNET',
      startTimestamp: formatToMySQLDate(start),
      endTimestamp: formatToMySQLDate(end),
      durationMinutes,
      lastKnownAddress
    };

    console.log("➡️ Sending INTERNET gap to backend:", body);

    const res = await fetch('https://employee-tracking-ph3i.onrender.com/api/track-gap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error("❌ Failed to send INTERNET gap:", res.status);
    } else {
      console.log("✅ INTERNET gap saved successfully.");
    }
  } catch (error) {
    console.error("❌ Error sending INTERNET gap:", error);
  }
}






  const handleLogout = async () => {
    
    try {
      const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (alreadyStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('🛑 Background tracking stopped.');
      } else {
        console.log('ℹ️ Background tracking was not running.');
      }

      if (subscriber) {
        subscriber.remove();
        setSubscriber(null);
        console.log('✅ Foreground tracking stopped.');
      }

      if (bgLeftOfficeTimeout) {
        clearTimeout(bgLeftOfficeTimeout);
        bgLeftOfficeTimeout = null;
        console.log('✅ Cleared background left-office timeout.');
      }
      bgHasLeftOffice = false;

      await AsyncStorage.multiRemove(['employeeId', 'employeeName', 'officeCoords', 'gpsLastKnownAddress','internetLastKnownAddress','pendingGPSGap',
  'pendingInternetGap']);
      console.log('✅ Cleared AsyncStorage.');

      let loc = location;
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
      }

      const readableAddress = await getReadableAddress(loc,3,2000);

      let newStatus = "Logout";

      if (officeCoords) {
        const distance = getDistanceMeters(
          loc.coords.latitude,
          loc.coords.longitude,
          officeCoords.latitude,
          officeCoords.longitude
        );

        if (distance > GEOFENCE_RADIUS_METERS) {
          newStatus = "Logout - outside workplace";
        } else {
          newStatus = "Logout - inside workplace";
        }
      }

      await sendLocationWithRetry(
        loc,
        readableAddress,
        newStatus,
        employeeId,
        employeeName
      );

      console.log("✅ Logout location data sent.");

      setEmployeeId('');
      setEmployeeName('');
      setLocation(null);
      setAddress(null);
      setLocationStatus(null);
      setDistanceFromOffice(null);
      setTrackingStarted(false);
      setOfficeCoords(null);
      setOfficeAddress(null);
      setErrorMsg(null);
 
const newCoords = await fetchOfficeLocation();
if (newCoords) {
  setOfficeCoords(newCoords);
} else {
  console.log("❌ Could not reload office coordinates after logout.");
}

    } catch (error) {
      console.error("❌ Error during logout:", error);
      setErrorMsg('Error occurred during logout.');
    }
  };



  const startTracking = async () => {
     if (trackingStarted) {
    console.log("⚠️ Tracking already started. Skipping.");
    return;
  }
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 1000,
        },
        async (loc) => {
          setLocation(loc);

          const readableAddress = await getReadableAddress(loc,3,2000);
          setAddress(readableAddress);
           setGpsLastAddress(readableAddress);
           await AsyncStorage.setItem('gpsLastKnownAddress', readableAddress); // ✅ Save to persistent storage

          setInternetLastAddress(readableAddress);
          await AsyncStorage.setItem('internetLastKnownAddress',readableAddress);

          let newStatus = 'Unknown';

          if (officeCoords) {
            const distance = getDistanceMeters(
              loc.coords.latitude,
              loc.coords.longitude,
              officeCoords.latitude,
              officeCoords.longitude
            );

            setDistanceFromOffice(distance);

            newStatus = distance > GEOFENCE_RADIUS_METERS
              ? "Employee is outside the workplace"
              : "Employee is inside the workplace";
          }

          setLocationStatus(newStatus);
        }
      );

      setSubscriber(sub);
      setTrackingStarted(true);
      console.log('✅ Foreground tracking started.');
    } catch (error) {
      console.error('❌ Error starting foreground tracking:', error);
      setErrorMsg('Could not start tracking.');
    }
  };

  return (
    <View style={styles.container}>
      {officeAddress && (
        <Text style={styles.text}>Office Address: {officeAddress}</Text>
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
            placeholder="e.g. john doe"
            value={employeeName}
            onChangeText={setEmployeeName}
          />
           <View style={{ marginBottom: 16 }}>
          <Button
  title={officeCoords ? "Login" : "Loading office location..."}
  onPress={handleLogin}
  disabled={!officeCoords}
/>
</View>

<View   style={{ padding: 16 }}>
<Button
  title="Test GPS / Internet Status"
  onPress={testConnectivity}
/>
</View>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            {location ? (
              `Your Address: ${address || 'Fetching address...'}\n\nStatus: ${locationStatus}\n\nDistance from the office: ${distanceFromOffice?.toFixed(2)} m`
            ) : (
              'Tracking...'
            )}
          </Text>
          <Button title="Logout" onPress={handleLogout} color="#d9534f" />
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}




// 🌍 Helper: get readable address from coordinates
async function getReadableAddress(loc) {
  let readableAddress = 'Unknown address';

  try {
    const geocode = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });

    if (geocode.length > 0) {
      const addr = geocode[0];
      readableAddress = `${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}, ${addr.postalCode || ''}`;
    } else {
      readableAddress = 'Reverse geocoding failed';
    }
  } catch (error) {
    console.error('❌ Error in reverse geocoding:', error);
    readableAddress = 'Reverse geocoding failed';
  }

  return readableAddress;
}






// 📏 Haversine distance formula
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




// 🛰 Send data to backend
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

   // ✅ Generate timestamp in IST (India Standard Time)
  const utcDate = new Date();

const yyyy = utcDate.getUTCFullYear();
const MM = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
const dd = String(utcDate.getUTCDate()).padStart(2, '0');
const hh = String(utcDate.getUTCHours()).padStart(2, '0');
const mm = String(utcDate.getUTCMinutes()).padStart(2, '0');
const ss = String(utcDate.getUTCSeconds()).padStart(2, '0');

const employeeTimestamp = `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;


    const res = await fetch('https://employee-tracking-ph3i.onrender.com/api/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId,
        employeeName,
        address: readableAddress,
        employeeTimestamp, // ✅ send this to backend
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
      console.error('❌ All retry attempts failed.');
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
