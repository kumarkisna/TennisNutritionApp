import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

function NativeTabLayout() {
  const c = useColors();
  return <NativeTabs tintColor={c.primary} backgroundColor={c.card}>
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} /><NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="planner"><NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} /><NativeTabs.Trigger.Label>Planner</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="foods"><NativeTabs.Trigger.Icon sf={{ default: 'fork.knife', selected: 'fork.knife' }} /><NativeTabs.Trigger.Label>Foods</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="meal-history"><NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} /><NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="settings"><NativeTabs.Trigger.Icon sf={{ default: 'slider.horizontal.3', selected: 'slider.horizontal.3' }} /><NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}

function ClassicTabLayout() {
  const c = useColors();
  const dark = c.isDark;
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  const web = Platform.OS === 'web';
  const icon = (sf: string, f: keyof typeof Feather.glyphMap) => ({ color }: { color: import('react-native').ColorValue }) =>
    ios ? <SymbolView name={sf as never} tintColor={color as string} size={24} /> : <Feather name={f} size={22} color={color as string} />;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: c.primary,
    tabBarInactiveTintColor: c.mutedForeground,
    tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    tabBarStyle: { position: 'absolute', backgroundColor: ios ? 'transparent' : c.background, borderTopWidth: web ? 1 : 0, borderTopColor: c.border, elevation: 0, paddingBottom: web ? 0 : insets.bottom, ...(web ? { height: 84 } : {}) },
    tabBarBackground: () => ios ? <BlurView intensity={100} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : web ? <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background }]} /> : null,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Overview', tabBarButtonTestID: 'tab-index', tabBarIcon: icon('house', 'home') }} />
    <Tabs.Screen name="planner" options={{ title: 'Planner', tabBarButtonTestID: 'tab-planner', tabBarIcon: icon('calendar', 'calendar') }} />
    <Tabs.Screen name="foods" options={{ title: 'Foods', tabBarButtonTestID: 'tab-foods', tabBarIcon: icon('fork.knife', 'book-open') }} />
    <Tabs.Screen name="meal-history" options={{ title: 'History', tabBarButtonTestID: 'tab-meal-history', tabBarIcon: icon('clock', 'clock') }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarButtonTestID: 'tab-settings', tabBarIcon: icon('slider.horizontal.3', 'sliders') }} />
  </Tabs>;
}

export default function TabLayout() {
  return isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />;
}
