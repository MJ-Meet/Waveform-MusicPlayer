import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';
import { View, StyleSheet } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';

import { DatabaseService } from '../src/services/DatabaseService';
import { Colors } from '../src/theme/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
  });

  useEffect(() => {
    async function init() {
      // Enable background audio (independent of DB)
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      } catch (e) {
        console.warn('[Waveform] Audio mode init error:', e);
      }

      // Initialize SQLite database
      try {
        await DatabaseService.initialize();
      } catch (e) {
        console.error(
          '[Waveform] Database init failed. ' +
          'SOLUTION: Uninstall and reinstall the app to fix the corrupted SQLite path.\n',
          e
        );
      } finally {
        if (fontsLoaded || fontError) {
          SplashScreen.hideAsync();
        }
      }
    }

    if (fontsLoaded || fontError) {
      init();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="player-modal"
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              contentStyle: { backgroundColor: Colors.background },
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
