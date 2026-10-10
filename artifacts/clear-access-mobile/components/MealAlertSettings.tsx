import { useState } from 'react';
import { Linking, Platform, Switch, Text, View } from 'react-native';
import { useMealReminders } from '@/contexts/MealReminderProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Eyebrow, F, Muted, warn } from '@/components/ui';

export function MealAlertSettings() {
  const c = useColors();
  const m = useMealReminders();
  const [problem, setProblem] = useState<string | null>(null);
  const native = Platform.OS !== 'web' && m.supported;
  const blocked = native && m.enabled && !m.allowed;
  const disabled = m.busy || !m.ready;
  async function set(v: boolean) {
    setProblem(null);
    try { await m.setEnabled(v); } catch (e) { warn(); setProblem(e instanceof Error ? e.message : 'Could not change alerts.'); }
  }
  const status = !m.enabled ? 'Off: meal and hydration alerts are paused.'
    : !m.supported ? 'On, configuration only. Requires the iPhone or Android app for notification delivery.'
    : m.error ? 'On, but device scheduling needs attention. Retry syncing below.'
    : m.allowed ? `On: ${m.upcoming} upcoming ${m.upcoming === 1 ? 'alert' : 'alerts'} scheduled.`
    : 'On, but blocked: notification permission is not allowed.';
  const err = problem ?? m.error;
  return <Card>
    <Eyebrow>Meal & hydration alerts</Eyebrow>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: c.foreground }}>Meal & hydration alerts</Text>
        <Text testID="status-meal-alerts" accessibilityLiveRegion="polite" style={{ fontFamily: F.semi, fontSize: 12.5, color: c.primary }}>{status}</Text>
      </View>
      <Switch testID="switch-meal-alerts-master" accessibilityLabel="Meal and hydration alerts master switch" accessibilityRole="switch" value={m.enabled} disabled={disabled}
        onValueChange={v => void set(v)} trackColor={{ true: c.primary, false: c.border }} />
    </View>
    <Muted>Applies to everyone on this device. Only alerts you enable for upcoming meal dates and times can notify you; they do not repeat daily. Turning this off keeps your per-meal choices.</Muted>
    {!m.supported ? <Muted>Requires the iPhone or Android app for notification delivery. This web view does not send browser notifications.</Muted> : <Muted>Device Do Not Disturb and battery settings can affect delivery. On Android, exact alarm access may need device settings; this app cannot verify that here.</Muted>}
    {m.supported && m.overflow > 0 ? <Text testID="warning-meal-alerts-overflow" style={{ fontFamily: F.medium, fontSize: 12.5, color: c.destructive }}>{m.overflow} later alerts are saved but not yet scheduled. Only the next 60 fit within the device limit; open the app to refresh.</Text> : null}
    {blocked ? <Muted>Permission is blocked. Allow notifications, or open device settings.</Muted> : null}
    {err ? <Text accessibilityRole="alert" testID="error-meal-alerts" style={{ fontFamily: F.medium, fontSize: 12.5, lineHeight: 18, color: c.destructive }}>{err}</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {blocked ? <Btn small label="Allow notifications" icon="bell" testID="button-allow-meal-alerts" disabled={disabled} onPress={() => void set(true)} /> : null}
      {native && (blocked || err) ? <Btn small variant="ghost" label="Open device settings" icon="settings" testID="button-open-os-settings" onPress={() => void Linking.openSettings().catch(() => setProblem('Could not open device settings.'))} /> : null}
      <Btn small variant="ghost" label="Retry sync" icon="refresh-cw" testID="button-retry-meal-alert-sync" disabled={m.busy} onPress={() => { setProblem(null); void m.refresh(); }} />
    </View>
  </Card>;
}
