// app/signup.tsx
import { useState } from 'react';
import { StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Text, View, useTheme } from '@/components/Themed';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function SignUpScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Creating the account also signs the user in, so the root layout switches to the tabs
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      await setDoc(
        doc(db, 'users', user.uid),
        {
          name: name.trim(),
          email: user.email,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error: any) {
      Alert.alert('Sign Up Failed', friendlyError(error.code, error.message));
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        <Text style={{ color: theme.tint }}>Temp </Text>
        <Text style={{ color: theme.success }}>Monitor</Text>
      </Text>
      <View style={styles.accent}>
        <View style={[styles.accentBar, { backgroundColor: theme.tint }]} />
        <View style={[styles.accentBarShort, { backgroundColor: theme.success }]} />
      </View>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>Create an account</Text>

      <TextInput
        style={inputStyle}
        placeholder="Full name"
        placeholderTextColor={theme.placeholder}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <TextInput
        style={inputStyle}
        placeholder="Email"
        placeholderTextColor={theme.placeholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={inputStyle}
        placeholder="Password (min 6 characters)"
        placeholderTextColor={theme.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={inputStyle}
        placeholder="Confirm password"
        placeholderTextColor={theme.placeholder}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.primary, opacity: pressed || loading ? 0.85 : 1 },
        ]}
        onPress={handleSignUp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.onPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Sign Up</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.replace('/login')} style={styles.switchLink}>
        <Text style={[styles.switchText, { color: theme.textMuted }]}>
          Already have an account?{' '}
          <Text style={[styles.switchTextBold, { color: theme.success }]}>Login</Text>
        </Text>
      </Pressable>
    </View>
  );
}

function friendlyError(code: string, fallback: string) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please login instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    default:
      return fallback;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  accent: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  accentBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginRight: 6,
  },
  accentBarShort: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 36,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    fontSize: 16,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  switchLink: {
    marginTop: 22,
  },
  switchText: {
    fontSize: 15,
  },
  switchTextBold: {
    fontWeight: '700',
  },
});
