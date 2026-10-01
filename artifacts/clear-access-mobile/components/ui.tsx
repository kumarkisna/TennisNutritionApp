import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { errorMessage, n } from '@/lib/format';
import type { Nutrition } from '@/lib/local-api';

export const F = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semi: 'Inter_600SemiBold', bold: 'Inter_700Bold' } as const;
type IconName = keyof typeof Feather.glyphMap;

export const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const success = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
export const warn = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); };

export function Screen({ children, tabs = false, onRefresh, refreshing = false, title }: { children: ReactNode; tabs?: boolean; onRefresh?: () => void; refreshing?: boolean; title?: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  const top = tabs ? (web ? 67 : insets.top + 12) : 16;
  const bottom = tabs ? (web ? 84 + 40 : insets.bottom + 110) : (web ? 34 : insets.bottom) + 32;
  return <View style={{ flex: 1, backgroundColor: c.background }}>
    {!tabs && <Stack.Screen options={{ title: title ?? '', headerStyle: { backgroundColor: c.background }, headerTintColor: c.primary, headerShadowVisible: false, headerTitleStyle: { fontFamily: F.bold, color: c.foreground } }} />}
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom, paddingHorizontal: 20, gap: 16 }}
      bottomOffset={24}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}
    >{children}</KeyboardAwareScrollViewCompat>
  </View>;
}

export function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  const c = useColors();
  return <Text style={{ fontFamily: F.semi, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: light ? c.mint : c.primary }}>{children}</Text>;
}
export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  const c = useColors();
  return <View style={{ gap: 6 }}>
    <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 30, lineHeight: 34, letterSpacing: -1.2, color: c.foreground }}>{children}</Text>
    {sub ? <Text style={{ fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>{sub}</Text> : null}
  </View>;
}
export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const c = useColors();
  return <Text style={[{ fontFamily: F.regular, fontSize: 12.5, lineHeight: 19, color: c.mutedForeground }, style]}>{children}</Text>;
}
export function SectionTitle({ kicker, children, right }: { kicker?: string; children: ReactNode; right?: ReactNode }) {
  const c = useColors();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
    <View style={{ gap: 3, flex: 1 }}>{kicker ? <Eyebrow>{kicker}</Eyebrow> : null}<Text style={{ fontFamily: F.bold, fontSize: 21, letterSpacing: -0.8, color: c.foreground }}>{children}</Text></View>{right}
  </View>;
}

export function Card({ children, style, tone = 'card' }: { children: ReactNode; style?: ViewStyle; tone?: 'card' | 'ink' | 'mint' | 'danger' }) {
  const c = useColors();
  const bg = tone === 'ink' ? c.ink : tone === 'mint' ? c.accent : tone === 'danger' ? c.destructiveSoft : c.card;
  const bd = tone === 'ink' ? c.ink : tone === 'mint' ? c.accentBorder : tone === 'danger' ? c.destructiveBorder : c.border;
  return <View style={[{ backgroundColor: bg, borderColor: bd, borderWidth: 1, borderRadius: 20, padding: 18, gap: 10 }, style]}>{children}</View>;
}

export function Btn({ label, onPress, icon, variant = 'primary', disabled, loading, testID, small }: { label: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; loading?: boolean; testID: string; small?: boolean }) {
  const c = useColors();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.destructiveSoft : c.secondary;
  const fg = variant === 'primary' ? c.primaryForeground : variant === 'danger' ? c.destructive : c.foreground;
  const off = disabled || loading;
  return <Pressable testID={testID} accessibilityRole="button" disabled={off} onPress={() => { tap(); onPress(); }}
    style={({ pressed }) => ({ backgroundColor: bg, borderRadius: 999, minHeight: small ? 38 : 48, paddingHorizontal: small ? 14 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off ? 0.5 : pressed ? 0.8 : 1, borderWidth: variant === 'primary' ? 0 : 1, borderColor: variant === 'danger' ? c.destructiveBorder : c.border, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
    {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Feather name={icon} size={small ? 14 : 16} color={fg} /> : null}
    <Text style={{ fontFamily: F.bold, fontSize: small ? 12 : 14, color: fg }}>{label}</Text>
  </Pressable>;
}
export function IconBtn({ icon, onPress, label, testID, color }: { icon: IconName; onPress: () => void; label: string; testID: string; color?: string }) {
  const c = useColors();
  return <Pressable testID={testID} accessibilityLabel={label} accessibilityRole="button" hitSlop={8} onPress={() => { tap(); onPress(); }}
    style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
    <Feather name={icon} size={18} color={color ?? c.foreground} />
  </Pressable>;
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const c = useColors();
  return <View style={{ gap: 6 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>{label}</Text>
    <TextInput keyboardAppearance={c.isDark ? 'dark' : 'light'} selectionColor={c.primary} placeholderTextColor={c.mutedForeground} {...props}
      style={[{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: c.input, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10, fontFamily: F.medium, fontSize: 15, color: c.foreground }, props.multiline ? { minHeight: 80, textAlignVertical: 'top' } : null]} />
    {hint ? <Muted>{hint}</Muted> : null}
  </View>;
}

export function Chips<T extends string>({ options, value, onChange, testPrefix, disabled }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testPrefix: string; disabled?: boolean }) {
  const c = useColors();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {options.map(o => { const on = o.value === value; return <Pressable key={o.value} testID={`${testPrefix}-${o.value}`} accessibilityRole="button" accessibilityState={{ selected: on, disabled }} disabled={disabled} onPress={() => { tap(); onChange(o.value); }}
      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: on ? c.primary : c.secondary, borderWidth: 1, borderColor: on ? c.primary : c.border, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: on ? c.primaryForeground : c.foreground }}>{o.label}</Text></Pressable>; })}
  </View>;
}

function Shimmer({ height }: { height: number }) {
  const c = useColors();
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, borderRadius: 16, backgroundColor: c.border }, s]} />;
}
export function LoadingBlock({ rows = 3, height = 76 }: { rows?: number; height?: number }) {
  return <View style={{ gap: 12 }} testID="status-content-loading">{Array.from({ length: rows }, (_, i) => <Shimmer key={i} height={height} />)}</View>;
}
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const c = useColors();
  return <View accessibilityRole="alert" testID="status-api-error" style={{ backgroundColor: c.destructiveSoft, borderColor: c.destructiveBorder, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
    <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: c.destructive }}>{errorMessage(error)}</Text>
    {onRetry ? <View style={{ alignSelf: 'flex-start' }}><Btn label="Try again" variant="danger" small icon="refresh-cw" onPress={onRetry} testID="button-retry-request" /></View> : null}
  </View>;
}
export function EmptyState({ icon, title, description, actionLabel, onAction }: { icon: IconName; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  const c = useColors();
  return <View testID="status-empty" style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: c.accentBorder, backgroundColor: c.secondary, borderRadius: 18, padding: 24, gap: 8, alignItems: 'flex-start' }}>
    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.accent, borderWidth: 1, borderColor: c.accentBorder, alignItems: 'center', justifyContent: 'center' }}><Feather name={icon} size={19} color={c.accentForeground} /></View>
    <Text style={{ fontFamily: F.bold, fontSize: 17, letterSpacing: -0.4, color: c.foreground, marginTop: 6 }}>{title}</Text>
    <Muted>{description}</Muted>
    {actionLabel && onAction ? <View style={{ marginTop: 8 }}><Btn label={actionLabel} onPress={onAction} testID="button-empty-action" /></View> : null}
  </View>;
}

export function CaloriesMacros({ calories, protein, carbs, fat, testPrefix, large = false, light = false }: {
  calories: number; protein: number; carbs: number; fat: number; testPrefix: string; large?: boolean; light?: boolean;
}) {
  const c = useColors();
  const text = light ? c.inkForeground : c.foreground;
  const quiet = light ? c.inkSoft : c.mutedForeground;
  const metrics = [
    { key: 'calories', value: calories, label: 'kcal', color: text, precision: 0 },
    { key: 'protein', value: protein, label: 'g protein', color: light ? c.mint : c.primary, precision: 1 },
    { key: 'carbs', value: carbs, label: 'g carbs', color: light ? c.coral : c.primary, precision: 1 },
    { key: 'fat', value: fat, label: 'g fat', color: text, precision: 1 },
  ];
  if (large) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    {metrics.map(metric => <View key={metric.key} style={{ flexBasis: '45%', flexGrow: 1, gap: 3 }}>
      <Text testID={`value-${testPrefix}-${metric.key}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: F.bold, fontSize: 32, letterSpacing: -1, color: metric.color }}>{n(metric.value, metric.precision)}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12, color: quiet }}>{metric.label}</Text>
    </View>)}
  </View>;
  return <View style={{ alignItems: 'flex-end', gap: 3 }}>
    <Text testID={`value-${testPrefix}-calories`} style={{ fontFamily: F.bold, fontSize: 15, color: text }}>{n(calories)} kcal</Text>
    <Text testID={`value-${testPrefix}-protein`} style={{ fontFamily: F.semi, fontSize: 12, color: light ? c.mint : c.primary }}>{n(protein, 1)} g protein</Text>
    <Text testID={`value-${testPrefix}-carbs`} style={{ fontFamily: F.semi, fontSize: 12, color: light ? c.coral : c.primary }}>{n(carbs, 1)} g carbs</Text>
    <Text testID={`value-${testPrefix}-fat`} style={{ fontFamily: F.semi, fontSize: 12, color: text }}>{n(fat, 1)} g fat</Text>
  </View>;
}

export function NutritionGrid({ nutrition, light }: { nutrition: Pick<Nutrition, 'protein' | 'carbs' | 'fat' | 'fiber'>; light?: boolean }) {
  const c = useColors();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {(['protein', 'carbs', 'fat', 'fiber'] as const).map(k => <View key={k} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: light ? c.inkSecondary : c.secondary, borderRadius: 12, padding: 12 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: light ? c.inkSoft : c.mutedForeground }}>{k}</Text>
      <Text testID={`value-${k}`} style={{ fontFamily: F.bold, fontSize: 20, letterSpacing: -0.6, color: light ? c.inkForeground : c.foreground }}>{n(nutrition[k], 1)}<Text style={{ fontSize: 12, fontFamily: F.medium }}> g</Text></Text>
    </View>)}
  </View>;
}
export function FiberNote() {
  return <Muted>Fiber totals include reported values only. Foods without reported fiber may make the actual total higher.</Muted>;
}
export const DISCLAIMER = 'Nutrition values are approximate, including community-submitted products. Verify labels when accuracy matters. Planning targets are estimates, not personalized medical advice.';
export function Text0({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontFamily: F.bold, fontSize: 15, lineHeight: 21, color: c.destructive }}>{children}</Text>;
}
