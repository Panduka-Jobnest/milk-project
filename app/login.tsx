// app/login.tsx
import { useState } from 'react';
import { StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Text, View, useTheme } from '@/components/Themed';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      // Root layout's Stack.Protected switches to the tabs once auth state changes
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
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
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>Sign in to continue</Text>

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
        placeholder="Password"
        placeholderTextColor={theme.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.primary, opacity: pressed || loading ? 0.85 : 1 },
        ]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.onPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Login</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.replace('/signup')} style={styles.switchLink}>
        <Text style={[styles.switchText, { color: theme.textMuted }]}>
          Don't have an account?{' '}
          <Text style={[styles.switchTextBold, { color: theme.success }]}>Sign Up</Text>
        </Text>
      </Pressable>
    </View>
  );
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
