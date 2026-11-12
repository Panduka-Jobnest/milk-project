// app/_layout.tsx
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { registerForPushNotifications } from '@/lib/notifications';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // undefined = auth state not restored yet, null = logged out
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        console.log('👤 Logged in:', user.email);
        try {
          const token = await registerForPushNotifications();
          if (token) {
            await setDoc(
              doc(db, 'users', user.uid),
              {
                email: user.email,
                pushToken: token,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
            console.log('✅ Token saved to Firestore');
          }
        } catch (err) {
          console.log('❌ Error registering notifications:', err);
        }
      } else {
        console.log('👤 Logged out');
      }
    });

    return unsubscribe;
  }, []);

  const ready = loaded && user !== undefined;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return <RootLayoutNav isLoggedIn={!!user} />;
}

// Navigation themes in the brand colours, so headers and the tab bar match the screens
function navTheme(base: typeof DefaultTheme, c: typeof Colors.light) {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.tint,
      background: c.background,
      card: c.card,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };
}

const LightNavTheme = navTheme(DefaultTheme, Colors.light);
const DarkNavTheme = navTheme(DarkTheme, Colors.dark);

function RootLayoutNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkNavTheme : LightNavTheme}>
      <Stack>
        {/* Firestore screens only mount once signed in, so listeners never run unauthenticated */}
        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}