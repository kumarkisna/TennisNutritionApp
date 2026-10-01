import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PlannerProvider } from '@/contexts/PlannerProvider';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { useColors } from '@/hooks/useColors';
import { StatusBar } from 'expo-status-bar';
import { Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const c = useColors();
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerStyle: { backgroundColor: c.card },
      headerTintColor: c.primary, headerTitleStyle: { color: c.foreground },
      contentStyle: { backgroundColor: c.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="people" />
      <Stack.Screen name="person-form" />
      <Stack.Screen name="portion" />
      <Stack.Screen name="food-form" />
      <Stack.Screen name="height" options={{ title: 'Height & growth' }} />
    </Stack>
  );
}

function ThemeReadyApp() {
  const c = useColors();
  // Hide once fonts and appearance are ready, even if planner hydration shows an error.
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(c.isDark ? 'dark' : 'light');
    return () => { Appearance.setColorScheme('unspecified'); };
  }, [c.isDark]);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      SystemUI.setBackgroundColorAsync(c.background).catch(error => console.warn('Could not update system background.', error));
    }
  }, [c.background]);
  return <>
    <StatusBar style={c.isDark ? 'light' : 'dark'} />
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PlannerProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </PlannerProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemeReadyApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
