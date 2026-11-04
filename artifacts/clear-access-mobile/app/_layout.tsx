import React, { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ActivityIndicator, Animated, Appearance, Platform, StyleSheet, Text, View } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PlannerProvider } from '@/contexts/PlannerProvider';
import { MealReminderProvider } from '@/contexts/MealReminderProvider';
import { MealHistoryPreferencesProvider } from '@/contexts/MealHistoryPreferencesProvider';
import { PlannerLayoutProvider } from '@/contexts/PlannerLayoutProvider';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { useColors } from '@/hooks/useColors';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { APP_NAME, COPYRIGHT_NOTICE } from '@/constants/branding';
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
      <Stack.Screen name="weight" options={{ title: 'Weight progress' }} />
    </Stack>
  );
}

function ThemeReadyApp() {
  const c = useColors();
  const [startupStage, setStartupStage] = useState<'waiting' | 'fading' | 'done'>('waiting');
  const startupOpacity = useRef(new Animated.Value(1)).current;
  const splashHidden = useRef(false);

  useEffect(() => {
    let active = true;
    const applySavedAppearance = async () => {
      if (Platform.OS !== 'web') {
        Appearance.setColorScheme(c.isDark ? 'dark' : 'light');
        try {
          await SystemUI.setBackgroundColorAsync(c.background);
        } catch (error) {
          console.warn('Could not update system background.', error);
        }
      }

      if (!active || splashHidden.current) return;
      try {
        // Keep the native splash visible until the saved palette is ready.
        await SplashScreen.hideAsync();
      } catch (error) {
        console.warn('Could not hide startup splash.', error);
      }
      if (!active) return;
      splashHidden.current = true;
      setStartupStage('fading');
    };

    void applySavedAppearance();
    return () => { active = false; };
  }, [c.background, c.isDark]);

  useEffect(() => {
    if (startupStage !== 'fading') return;
    const timer = setTimeout(() => {
      Animated.timing(startupOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished) setStartupStage('done');
      });
    }, 80);
    return () => {
      clearTimeout(timer);
      startupOpacity.stopAnimation();
    };
  }, [startupOpacity, startupStage]);

  return <View style={{ flex: 1, backgroundColor: c.background }}>
    <StatusBar style={c.isDark ? 'light' : 'dark'} />
    <PlannerLayoutProvider>
      <MealHistoryPreferencesProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <PlannerProvider>
              <MealReminderProvider>
                <RootLayoutNav />
              </MealReminderProvider>
            </PlannerProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </MealHistoryPreferencesProvider>
    </PlannerLayoutProvider>
    {startupStage !== 'done' ? <Animated.View
      testID="theme-startup-transition"
      accessibilityLabel="Applying your saved theme"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: startupStage === 'fading' ? startupOpacity : 1,
          backgroundColor: c.background,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 12,
        },
      ]}
    >
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, textAlign: 'center', color: c.foreground }}>{APP_NAME}</Text>
      <ActivityIndicator accessibilityLabel="Loading theme" color={c.primary} />
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center', color: c.mutedForeground }}>Applying your saved theme…</Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, lineHeight: 14, textAlign: 'center', color: c.mutedForeground }}>{COPYRIGHT_NOTICE}</Text>
    </Animated.View> : null}
  </View>;
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemeReadyApp />
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
