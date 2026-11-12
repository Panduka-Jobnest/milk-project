// app/(tabs)/settings.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, Pressable, TextInput, Alert, ScrollView } from 'react-native';
import { Text, View, useTheme } from '@/components/Themed';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_PH_MAX, DEFAULT_PH_MIN, DEFAULT_TEMP_LIMIT } from '@/constants/Thresholds';

export default function SettingsScreen() {
  const theme = useTheme();
  const [limit, setLimit] = useState(String(DEFAULT_TEMP_LIMIT));
  const [phMin, setPhMin] = useState(String(DEFAULT_PH_MIN));
  const [phMax, setPhMax] = useState(String(DEFAULT_PH_MAX));
  const [saving, setSaving] = useState(false);

  // Load current values from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, 'settings', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setLimit(String(data.temperatureLimit ?? DEFAULT_TEMP_LIMIT));
        setPhMin(String(data.phMin ?? DEFAULT_PH_MIN));
        setPhMax(String(data.phMax ?? DEFAULT_PH_MAX));
      }
    };
    loadSettings();
  }, []);

  // Save thresholds to Firestore
  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const tempValue = parseFloat(limit);
    const phMinValue = parseFloat(phMin);
    const phMaxValue = parseFloat(phMax);

    if (isNaN(tempValue) || tempValue <= 0) {
      Alert.alert('Invalid', 'Please enter a valid temperature');
      return;
    }
    if (isNaN(phMinValue) || isNaN(phMaxValue) || phMinValue < 0 || phMaxValue > 14) {
      Alert.alert('Invalid', 'pH values must be between 0 and 14');
      return;
    }
    if (phMinValue >= phMaxValue) {
      Alert.alert('Invalid', 'Minimum pH must be lower than maximum pH');
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        temperatureLimit: tempValue,
        phMin: phMinValue,
        phMax: phMaxValue,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      Alert.alert(
        'Saved ✅',
        `Temperature limit: ${tempValue}°C\nNormal pH: ${phMinValue} – ${phMaxValue}`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPh = () => {
    setPhMin(String(DEFAULT_PH_MIN));
    setPhMax(String(DEFAULT_PH_MAX));
  };

  const handleLogout = async () => {
    // Root layout's Stack.Protected switches back to login once auth state changes
    await signOut(auth);
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text },
  ];

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>⚙️ Settings</Text>

      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={styles.sectionTitle}>Thresholds</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Readings outside these values are marked abnormal
        </Text>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Text style={styles.label}>🌡 Temperature</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Alert me when temperature exceeds this value
        </Text>
        <View style={[styles.inputRow, { backgroundColor: 'transparent' }]}>
          <TextInput
            style={inputStyle}
            placeholderTextColor={theme.placeholder}
            value={limit}
            onChangeText={setLimit}
            keyboardType="decimal-pad"
            placeholder={String(DEFAULT_TEMP_LIMIT)}
          />
          <Text style={[styles.unit, { color: theme.tint }]}>°C</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={[styles.labelRow, { backgroundColor: 'transparent' }]}>
          <Text style={styles.label}>🧪 pH</Text>
          <Pressable onPress={handleResetPh} hitSlop={8}>
            <Text style={[styles.resetText, { color: theme.tint }]}>Reset to default</Text>
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Normal range for fresh milk (default {DEFAULT_PH_MIN} – {DEFAULT_PH_MAX})
        </Text>
        <View style={[styles.inputRow, { backgroundColor: 'transparent' }]}>
          <View style={[styles.rangeField, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.rangeLabel, { color: theme.textMuted }]}>Min</Text>
            <TextInput
              style={inputStyle}
              placeholderTextColor={theme.placeholder}
              value={phMin}
              onChangeText={setPhMin}
              keyboardType="decimal-pad"
              placeholder={String(DEFAULT_PH_MIN)}
            />
          </View>
          <Text style={[styles.rangeDash, { color: theme.textMuted }]}>–</Text>
          <View style={[styles.rangeField, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.rangeLabel, { color: theme.textMuted }]}>Max</Text>
            <TextInput
              style={inputStyle}
              placeholderTextColor={theme.placeholder}
              value={phMax}
              onChangeText={setPhMax}
              keyboardType="decimal-pad"
              placeholder={String(DEFAULT_PH_MAX)}
            />
          </View>
        </View>

        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {saving ? 'Saving...' : 'Save Thresholds'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.logoutButton, { borderColor: theme.danger }]}
        onPress={handleLogout}
      >
        <Text style={[styles.buttonText, { color: theme.danger }]}>Logout</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 18,
  },
  unit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
    marginBottom: 13,
  },
  rangeField: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  rangeDash: {
    fontSize: 20,
    marginHorizontal: 10,
    marginBottom: 12,
  },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    height: 50,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 30,
  },
});
