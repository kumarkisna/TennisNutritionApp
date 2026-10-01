import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_THEME_ID, findTheme, type AppTheme } from '@/constants/colors';
import { createThemePreferences } from '@/lib/theme-preferences';

const preferences = createThemePreferences(AsyncStorage);
type ThemeContextValue = {
  theme: AppTheme; saving: boolean; error: string | null;
  selectTheme: (id: string) => Promise<boolean>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [theme, setTheme] = useState(findTheme(DEFAULT_THEME_ID)!);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    preferences.load().then(id => {
      if (active) setTheme(findTheme(id)!);
    }).catch(problem => {
      if (active) setError(`Could not load your theme: ${problem instanceof Error ? problem.message : String(problem)} Choose a theme in Settings to save a new appearance setting.`);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function selectTheme(id: string) {
    if (busy.current) return false;
    const next = findTheme(id);
    if (!next) { setError('Choose a supported theme.'); return false; }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      // Apply only after the preference is durable; failed writes leave the active theme unchanged.
      await preferences.save(id);
      setTheme(next);
      return true;
    } catch (problem) {
      setError(`Could not save this theme; your active theme was not changed. ${problem instanceof Error ? problem.message : String(problem)}`);
      return false;
    } finally { busy.current = false; setSaving(false); }
  }

  return <ThemeContext.Provider value={{ theme, saving, error, selectTheme }}>
    {loading ? <View style={{ flex: 1, backgroundColor: theme.palette.background, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={theme.palette.primary} />
      <Text style={{ color: theme.palette.foreground }}>Loading your appearance…</Text>
    </View> : <>
      {error ? <View accessibilityRole="alert" testID="status-theme-error" style={{ backgroundColor: theme.palette.destructiveSoft, padding: 12, paddingTop: insets.top + 12 }}>
        <Text style={{ fontFamily: 'Inter_500Medium', color: theme.palette.destructive }}>{error}</Text>
      </View> : null}
      <View style={{ flex: 1, backgroundColor: theme.palette.background }}>{children}</View>
    </>}
  </ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is required for the mobile app.');
  return value;
}