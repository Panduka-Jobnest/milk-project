// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// How notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  // 1. Must be a physical device
  if (!Device.isDevice) {
    console.log('⚠️ Must use physical device');
    return null;
  }

  // 2. Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 3. Ask permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('❌ Permission denied');
    return null;
  }

  // 4. Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Temperature Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0192F6',
      //sound: 'default',
    });
  }

  // 5. Get push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('📋 Project ID:', projectId);

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('📱 Push token:', token);
    return token;
  } catch (err) {
    console.log('❌ Token error:', err);
    return null;
  }
}

// Helper to send a LOCAL test notification (no server needed!)
export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 Test Alert',
      body: 'Temperature is ABNORMAL!',
      sound: 'default',
    },
    trigger: null,  // immediate
  });
  console.log('✅ Test notification sent');
}