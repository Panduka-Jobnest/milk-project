// app/(tabs)/index.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import LocationMap from '@/components/LocationMap';
import {
  collection,
  query,
  orderBy,
  limit as limitQuery,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

export default function DashboardScreen() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState('—');
  const [lastUpdated, setLastUpdated] = useState('—');
  const [limit, setLimit] = useState(50);
  const [connected, setConnected] = useState(false);

  // 1. Listen to latest reading from Firestore (live)
  useEffect(() => {
    const q = query(
      collection(db, 'readings'),
      orderBy('timestamp', 'desc'),
      limitQuery(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setTemperature(data.temperature ?? null);
        setLatitude(data.latitude ?? null);
        setLongitude(data.longitude ?? null);
        setSpeed(data.speed ?? null);
        setDeviceId(data.deviceId ?? 'unknown');
        setLastUpdated(new Date().toLocaleTimeString());
        setConnected(true);
      } else {
        setConnected(false);
      }
    }, (err) => {
      console.log('⚠️ readings listener error:', err.code);
      setConnected(false);
    });

    return unsubscribe;
  }, []);

  // 2. Listen to user's threshold setting (live)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, 'settings', user.uid);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setLimit(snap.data().temperatureLimit ?? 50);
      }
       }, (err) => {
      console.log('⚠️ settings listener error:', err.code);
    });

    return unsubscribe;
  }, []);

  const isAbnormal = temperature !== null && temperature > limit;
  const statusColor = temperature === null ? 'gray' : isAbnormal ? 'red' : 'green';
  const hasLocation = latitude !== null && longitude !== null;

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.deviceName}>📡 {deviceId}</Text>
      <Text style={[styles.status, { color: connected ? 'green' : 'gray' }]}>
        {connected ? '● Connected' : '● Waiting for data...'}
      </Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>🌡 Temperature</Text>
          <Text style={styles.cardValue}>
            {temperature !== null ? `${temperature} °C` : '—'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>📍 Location</Text>
          <Text style={styles.cardValueSmall}>
            {hasLocation ? `${latitude!.toFixed(6)},\n${longitude!.toFixed(6)}` : '—'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>🚚 Speed</Text>
          <Text style={styles.cardValue}>{speed !== null ? `${speed} km/h` : '—'}</Text>
        </View>

        <View style={[styles.card, { borderColor: statusColor }]}>
          <Text style={styles.cardLabel}>{isAbnormal ? '🔴' : '🟢'} Status</Text>
          <Text style={[styles.cardValue, { color: statusColor }]}>
            {temperature === null ? 'NO DATA' : isAbnormal ? 'ABNORMAL' : 'NORMAL'}
          </Text>
        </View>
      </View>

      <View style={styles.mapCard}>
        {hasLocation ? (
          <LocationMap latitude={latitude!} longitude={longitude!} />
        ) : (
          <Text style={styles.mapPlaceholder}>📍 Waiting for location...</Text>
        )}
      </View>

      <Text style={styles.limitText}>Alert threshold: {limit}°C</Text>
      <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  deviceName: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  status: { fontSize: 14, marginBottom: 30 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: 'transparent',
  },
  card: {
    width: '48%',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e91e63',
    minHeight: 110,
  },
  cardLabel: { fontSize: 14, opacity: 0.7, marginBottom: 8 },
  cardValue: { fontSize: 24, fontWeight: 'bold' },
  cardValueSmall: { fontSize: 15, fontWeight: '600' },
  mapCard: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e91e63',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: { fontSize: 14, opacity: 0.6 },
  limitText: { marginTop: 20, fontSize: 14, opacity: 0.7 },
  lastUpdated: { marginTop: 10, opacity: 0.5, fontSize: 12 },
});