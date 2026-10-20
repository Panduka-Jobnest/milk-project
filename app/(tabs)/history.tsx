// app/(tabs)/history.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Reading = {
  id: string;
  temperature: number;
  status: string;
  deviceId: string;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
};

export default function HistoryScreen() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'readings'),
      orderBy('timestamp', 'desc'),
      limit(50)   // last 50 readings
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Reading, 'id'>),
      }));
      setReadings(data);
      setLoading(false);
       }, (err) => {
      console.log('⚠️ history listener error:', err.code);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (readings.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No readings yet</Text>
        <Text style={styles.emptyHint}>
          Data will appear here once your sensor sends it
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={readings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isAbnormal = item.status === 'ABNORMAL';
          const time = new Date(item.timestamp).toLocaleString();
          const hasLocation = item.latitude != null && item.longitude != null;

          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.temp}>{item.temperature}°C</Text>
                <Text style={styles.detail}>
                  🚚 {item.speed != null ? `${item.speed} km/h` : '—'}
                </Text>
                <Text style={styles.detail}>
                  📍 {hasLocation
                    ? `${item.latitude!.toFixed(6)}, ${item.longitude!.toFixed(6)}`
                    : '—'}
                </Text>
                <Text style={styles.meta}>
                  {item.deviceId} · {time}
                </Text>
              </View>
              <Text
                style={[
                  styles.badge,
                  { color: isAbnormal ? 'red' : 'green' },
                ]}
              >
                {isAbnormal ? '🔴 ABNORMAL' : '🟢 NORMAL'}
              </Text>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
  },
  temp: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  detail: {
    fontSize: 13,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
});