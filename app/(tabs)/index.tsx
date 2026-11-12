// app/(tabs)/index.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { Text, View, useTheme } from '@/components/Themed';
import LocationMap from '@/components/LocationMap';
import { checkReading, useThresholds } from '@/lib/thresholds';
import { useContainers } from '@/lib/containers';
import { useReadings } from '@/lib/readings';

const OFFLINE_AFTER_MS = 2 * 60 * 1000; // the sensor reports every ~30 s

export default function DashboardScreen() {
  const theme = useTheme();
  const { selected } = useContainers();
  const [now, setNow] = useState(Date.now());

  // 1. Latest reading of the selected container (live)
  const { readings } = useReadings({ container: selected, max: 1 });
  const latest = readings[0];
  const temperature = latest?.temperature ?? null;
  const ph = latest?.ph ?? null;
  const latitude = latest?.latitude ?? null;
  const longitude = latest?.longitude ?? null;
  const speed = latest?.speed ?? null;
  const deviceId = latest?.deviceId ?? '—';
  const readingTime = latest ? new Date(latest.timestamp).getTime() : null;
  const lastUpdated = readingTime ? new Date(readingTime).toLocaleTimeString() : '—';
  const connected = readingTime !== null && now - readingTime < OFFLINE_AFTER_MS;

  // Re-check "connected" as time passes, even when no new reading arrives
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. User's thresholds from Settings decide what counts as abnormal
  const { tempLimit: limit, phMin, phMax } = useThresholds();
  const { tempHigh: tempAbnormal, phBad: phAbnormal, abnormal: isAbnormal } = checkReading({ temperature, ph }, { tempLimit: limit, phMin, phMax });
  const noData = temperature === null && ph === null;
  const statusColor = noData ? theme.textMuted : isAbnormal ? theme.danger : theme.success;
  const statusBg = noData ? theme.card : isAbnormal ? theme.dangerSoft : theme.successSoft;
  const statusReason = tempAbnormal && phAbnormal ? 'Temp & pH' : tempAbnormal ? 'High temperature' : phAbnormal ? 'pH out of range' : '';
  const cardStyle = [styles.card, { backgroundColor: theme.card, borderColor: theme.border }];
  const hasLocation = latitude !== null && longitude !== null;
  const phLabel = ph === null ? '' : ph < phMin ? 'Acidic' : ph > phMax ? 'Alkaline' : 'Fresh';
  const phColor = ph === null ? theme.text : phLabel === 'Fresh' ? theme.success : theme.danger;

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.deviceName}>📦 {selected ?? 'All containers'}</Text>
      <Text style={[styles.deviceIdText, { color: theme.textMuted }]}>📡 {deviceId}</Text>
      <View
        style={[
          styles.statusPill,
          { backgroundColor: connected ? theme.successSoft : theme.primarySoft },
        ]}
      >
        <Text style={[styles.status, { color: connected ? theme.success : theme.textMuted }]}>
          {connected ? '● Connected' : readingTime ? `● Offline · last seen ${lastUpdated}` : '● Waiting for data...'}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={cardStyle}>
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>🌡 Temperature</Text>
          <Text style={[styles.cardValue, { color: theme.tint }]}>
            {temperature !== null ? `${temperature} °C` : '—'}
          </Text>
        </View>

        <View style={cardStyle}>
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>🧪 pH</Text>
          <Text style={[styles.cardValue, { color: phColor }]}>
            {ph !== null ? ph.toFixed(2) : '—'}
          </Text>
          {ph !== null && (
            <Text style={[styles.cardHint, { color: phColor }]}>
              {phLabel} · normal {phMin}–{phMax}
            </Text>
          )}
        </View>

        <View style={cardStyle}>
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>🚚 Speed</Text>
          <Text style={styles.cardValue}>{speed !== null ? `${speed} km/h` : '—'}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: statusBg, borderColor: statusColor }]}>
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>{isAbnormal ? '🔴' : '🟢'} Status</Text>
          <Text style={[styles.cardValue, { color: statusColor }]}>
            {noData ? 'NO DATA' : isAbnormal ? 'ABNORMAL' : 'NORMAL'}
          </Text>
          {statusReason !== '' && (
            <Text style={[styles.cardHint, { color: statusColor }]}>{statusReason}</Text>
          )}
        </View>

        <View style={[cardStyle, styles.cardWide]}>
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>📍 Location</Text>
          <Text style={styles.cardValueSmall}>
            {hasLocation ? `${latitude!.toFixed(6)}, ${longitude!.toFixed(6)}` : '—'}
          </Text>
        </View>
      </View>

      <View style={[styles.mapCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {hasLocation ? (
          <LocationMap latitude={latitude!} longitude={longitude!} />
        ) : (
          <Text style={[styles.mapPlaceholder, { color: theme.textMuted }]}>📍 Waiting for location...</Text>
        )}
      </View>

      <Text style={[styles.limitText, { color: theme.textMuted }]}>
        Alert threshold: <Text style={{ color: theme.tint, fontWeight: '700' }}>{limit}°C</Text>
        {'  ·  '}Normal pH:{' '}
        <Text style={{ color: theme.tint, fontWeight: '700' }}>{phMin}–{phMax}</Text>
      </Text>
      <Text style={[styles.lastUpdated, { color: theme.textMuted }]}>Last updated: {lastUpdated}</Text>
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
  deviceName: { fontSize: 20, fontWeight: '800' },
  deviceIdText: { fontSize: 13, marginTop: 2, marginBottom: 10 },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 26,
  },
  status: { fontSize: 13, fontWeight: '600' },
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
    borderWidth: 1.5,
    minHeight: 110,
  },
  cardLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  cardValue: { fontSize: 24, fontWeight: 'bold' },
  cardValueSmall: { fontSize: 15, fontWeight: '600' },
  cardHint: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  cardWide: { width: '100%', minHeight: 0 },
  mapCard: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: { fontSize: 14 },
  limitText: { marginTop: 20, fontSize: 14 },
  lastUpdated: { marginTop: 8, fontSize: 12 },
});