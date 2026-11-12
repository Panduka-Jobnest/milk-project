// app/(tabs)/alerts.tsx
import { StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text, View, useTheme } from '@/components/Themed';
import { checkReading, useThresholds } from '@/lib/thresholds';
import { useContainers } from '@/lib/containers';
import { useReadings } from '@/lib/readings';

export default function AlertsScreen() {
  const theme = useTheme();
  const { selected } = useContainers();
  const thresholds = useThresholds();
  const { tempLimit, phMin, phMax } = thresholds;

  // Recent readings of the selected container; abnormal ones are picked using the user's thresholds
  const { readings, loading } = useReadings({ container: selected, max: 200 });

  const alerts = readings.filter((r) => checkReading(r, thresholds).abnormal);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (alerts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyTitle, { color: theme.success }]}>🎉 No alerts</Text>
        <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
          {selected ?? 'Everything'} is running normally
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const time = new Date(item.timestamp).toLocaleString();
          const hasPh = item.ph != null;
          const { tempHigh, phLow, phHigh, phBad } = checkReading(item, thresholds);

          const title =
            tempHigh && phBad ? 'High Temperature & pH'
            : tempHigh ? 'High Temperature'
            : phLow ? 'pH Too Acidic'
            : phHigh ? 'pH Too Alkaline'
            : 'Abnormal Reading';
          const icon = phBad && !tempHigh ? '🧪' : '⚠️';

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.dangerSoft, borderLeftColor: theme.danger },
              ]}
            >
              <View style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
                <Text style={styles.alertIcon}>{icon}</Text>
                <Text style={[styles.alertTitle, { color: theme.danger }]}>{title}</Text>
              </View>

              <View style={[styles.values, { backgroundColor: 'transparent' }]}>
                <View style={[styles.valueBlock, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.valueLabel, { color: theme.textMuted }]}>🌡 Temp</Text>
                  <Text style={[styles.temp, { color: tempHigh ? theme.danger : theme.text }]}>
                    {item.temperature}°C
                  </Text>
                </View>
                {hasPh && (
                  <View style={[styles.valueBlock, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.valueLabel, { color: theme.textMuted }]}>🧪 pH</Text>
                    <Text style={[styles.temp, { color: phBad ? theme.danger : theme.text }]}>
                      {item.ph!.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.limits, { color: theme.textMuted }]}>
                Limit {tempLimit}°C · normal pH {phMin}–{phMax}
              </Text>

              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.deviceId} · {time}
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
    paddingTop: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  values: {
    flexDirection: 'row',
    marginTop: 6,
  },
  valueBlock: {
    marginRight: 28,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  temp: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 2,
  },
  limits: {
    fontSize: 12,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  separator: {
    height: 10,
    backgroundColor: 'transparent',
  },
});