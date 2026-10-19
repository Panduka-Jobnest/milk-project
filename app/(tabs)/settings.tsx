// app/(tabs)/settings.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function SettingsScreen() {
  const [limit, setLimit] = useState('50');
  const [saving, setSaving] = useState(false);

  // Load current value from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, 'settings', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setLimit(String(snap.data().temperatureLimit ?? 50));
      }
    };
    loadSettings();
  }, []);

  // Save threshold to Firestore
  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const value = parseFloat(limit);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid', 'Please enter a valid number');
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        temperatureLimit: value,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      Alert.alert('Saved ✅', `Threshold set to ${value}°C`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    // Root layout's Stack.Protected switches back to login once auth state changes
    await signOut(auth);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Settings</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Abnormal temperature threshold</Text>
        <Text style={styles.hint}>
          Alert me when temperature exceeds this value
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={limit}
            onChangeText={setLimit}
            keyboardType="numeric"
            placeholder="50"
          />
          <Text style={styles.unit}>°C</Text>
        </View>

        <Pressable
          style={[styles.button, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 18,
  },
  unit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  button: {
    height: 50,
    backgroundColor: '#e91e63',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    height: 50,
    backgroundColor: '#444',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 30,
  },
});