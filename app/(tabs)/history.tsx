// app/(tabs)/history.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { Text, View, useTheme } from '@/components/Themed';
import LineChart, { ChartPoint } from '@/components/LineChart';
import { checkReading, useThresholds } from '@/lib/thresholds';
import { useContainers } from '@/lib/containers';
import { useReadings } from '@/lib/readings';

type Metric = 'temperature' | 'ph';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// tickMs = spacing of the time labels on the chart's X axis
const RANGES = [
  { key: '1h', label: '1 Hour', ms: HOUR, tickMs: 15 * MIN },
  { key: '6h', label: '6 Hours', ms: 6 * HOUR, tickMs: HOUR },
  { key: '24h', label: '24 Hours', ms: 24 * HOUR, tickMs: 4 * HOUR },
] as const;

const MAX_CHART_POINTS = 150; // the sensor reports every ~30 s, so longer ranges are averaged into buckets

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatClock(t: number) {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Average raw points into evenly spaced time buckets so the line stays readable
function downsample(points: ChartPoint[], start: number, end: number): ChartPoint[] {
  if (points.length <= MAX_CHART_POINTS) return points;
  const size = (end - start) / MAX_CHART_POINTS;
  const buckets: { t: number; v: number; n: number }[] = [];
  for (const p of points) {
    const i = Math.min(Math.max(Math.floor((p.t - start) / size), 0), MAX_CHART_POINTS - 1);
    const b = (buckets[i] ??= { t: 0, v: 0, n: 0 });
    b.t += p.t;
    b.v += p.v;
    b.n += 1;
  }
  return buckets.filter(Boolean).map((b) => ({ t: b.t / b.n, v: b.v / b.n }));
}

export default function HistoryScreen() {
  const theme = useTheme();
  const thresholds = useThresholds();
  const [metric, setMetric] = useState<Metric>('temperature');
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('1h');
  const [now, setNow] = useState(Date.now());
  const { selected } = useContainers();

  const range = RANGES.find((r) => r.key === rangeKey)!;

  // Keep the time window sliding forward
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Live readings of the selected container for the selected range
  const { readings, loading } = useReadings({
    container: selected,
    sinceMs: range.ms,
    max: 3000,
  });

  // Slide the window forward whenever new readings arrive
  useEffect(() => {
    setNow(Date.now());
  }, [readings]);

  const start = now - range.ms;
  const inRange = readings.filter((r) => new Date(r.timestamp).getTime() >= start);

  const isTemp = metric === 'temperature';
  const raw: ChartPoint[] = inRange
    .map((r) => ({ t: new Date(r.timestamp).getTime(), v: isTemp ? r.temperature : r.ph }))
    .filter((p): p is ChartPoint => p.v != null && !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t);
  const chartData = downsample(raw, start, now);

  const formatValue = isTemp ? (v: number) => `${v.toFixed(1)}°C` : (v: number) => v.toFixed(2);
  const referenceLines = isTemp
    ? [{ value: thresholds.tempLimit, label: `Limit ${thresholds.tempLimit}°C` }]
    : [
        { value: thresholds.phMax, label: `Max ${thresholds.phMax}` },
        { value: thresholds.phMin, label: `Min ${thresholds.phMin}` },
      ];

  const values = raw.map((p) => p.v);
  const stats = values.length
    ? {
        latest: values[values.length - 1],
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      }
    : null;
  const isBad = (v: number) =>
    isTemp ? v > thresholds.tempLimit : v < thresholds.phMin || v > thresholds.phMax;

  const header = (
    <View style={styles.header}>
      {/* Metric tabs */}
      <View style={[styles.segment, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {([
          { key: 'temperature', label: '🌡 Temperature' },
          { key: 'ph', label: '🧪 pH Value' },
        ] as const).map((m) => {
          const active = metric === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMetric(m.key)}
              style={[styles.segmentItem, active && { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.segmentText, { color: active ? theme.onPrimary : theme.textMuted }]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Time range tabs */}
      <View style={[styles.rangeRow, { backgroundColor: 'transparent' }]}>
        {RANGES.map((r) => {
          const active = rangeKey === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRangeKey(r.key)}
              style={[
                styles.rangePill,
                {
                  borderColor: active ? theme.tint : theme.border,
                  backgroundColor: active ? theme.primarySoft : theme.card,
                },
              ]}
            >
              <Text style={[styles.rangeText, { color: active ? theme.tint : theme.textMuted }]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Summary stats */}
      {stats && (
        <View style={[styles.statsRow, { backgroundColor: 'transparent' }]}>
          {([
            ['Latest', stats.latest],
            ['Min', stats.min],
            ['Max', stats.max],
            ['Avg', stats.avg],
          ] as const).map(([label, v]) => (
            <View key={label} style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
              <Text style={[styles.statValue, { color: label !== 'Avg' && isBad(v) ? theme.danger : theme.text }]}>
                {formatValue(v)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Chart */}
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {loading ? (
          <View style={[styles.chartEmpty, { backgroundColor: 'transparent' }]}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : chartData.length === 0 ? (
          <View style={[styles.chartEmpty, { backgroundColor: 'transparent' }]}>
            <Text style={{ color: theme.textMuted }}>
              No {isTemp ? 'temperature' : 'pH'} readings in the last {range.label.toLowerCase()}
            </Text>
          </View>
        ) : (
          <LineChart
            data={chartData}
            xDomain={[start, now]}
            xTickStepMs={range.tickMs}
            yAxisTitle={isTemp ? 'Temperature (°C)' : 'pH'}
            includeZero={isTemp}
            color={theme.tint}
            formatValue={formatValue}
            formatTime={formatClock}
            referenceLines={referenceLines}
          />
        )}
        {!loading && chartData.length > 0 && (
          <Text style={[styles.chartNote, { color: theme.textMuted }]}>
            Time  ·  tap the chart to see a value
          </Text>
        )}
      </View>

      <Text style={styles.listTitle}>
        Readings <Text style={{ color: theme.textMuted, fontWeight: '500' }}>({inRange.length})</Text>
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={inRange}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? null : (
            <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
              No readings in the last {range.label.toLowerCase()}
            </Text>
          )
        }
        initialNumToRender={15}
        windowSize={7}
        renderItem={({ item }) => {
          const { tempHigh, phBad, abnormal: isAbnormal } = checkReading(item, thresholds);
          const time = new Date(item.timestamp).toLocaleString();
          const hasLocation = item.latitude != null && item.longitude != null;

          return (
            <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.rowLeft, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.temp, { color: tempHigh ? theme.danger : theme.tint }]}>
                  {item.temperature}°C
                  {item.ph != null && (
                    <Text style={[styles.phInline, { color: phBad ? theme.danger : theme.textMuted }]}>
                      {'   '}🧪 pH {item.ph.toFixed(2)}
                    </Text>
                  )}
                </Text>
                <Text style={styles.detail}>
                  🚚 {item.speed != null ? `${item.speed} km/h` : '—'}
                </Text>
                <Text style={styles.detail}>
                  📍 {hasLocation
                    ? `${item.latitude!.toFixed(6)}, ${item.longitude!.toFixed(6)}`
                    : '—'}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {item.deviceId} · {time}
                </Text>
              </View>
              <Text
                style={[
                  styles.badge,
                  {
                    color: isAbnormal ? theme.danger : theme.success,
                    backgroundColor: isAbnormal ? theme.dangerSoft : theme.successSoft,
                  },
                ]}
              >
                {isAbnormal ? 'ABNORMAL' : 'NORMAL'}
              </Text>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginHorizontal: -4,
  },
  rangePill: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  rangeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    marginHorizontal: -3,
  },
  stat: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  chartCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  chartEmpty: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartNote: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 10,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowLeft: {
    flex: 1,
  },
  temp: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  phInline: {
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  separator: {
    height: 10,
    backgroundColor: 'transparent',
  },
});
