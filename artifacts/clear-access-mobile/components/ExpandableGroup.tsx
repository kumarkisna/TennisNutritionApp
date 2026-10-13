import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { sectionDisclosurePreferences } from '@/lib/local-api';
import type { SectionDisclosureKey } from '@/lib/section-disclosure-preferences';
import { useColors } from '@/hooks/useColors';
import { F, Muted, tap } from '@/components/ui';

export function ExpandableGroup({
  preferenceKey,
  title,
  summary,
  children,
  defaultExpanded = true,
}: {
  preferenceKey: SectionDisclosureKey;
  title: string;
  summary?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const c = useColors();
  const testKey = preferenceKey.replace(/:/g, '-');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    sectionDisclosurePreferences.load(preferenceKey).then(savedExpanded => {
      if (active) setExpanded(savedExpanded);
    }).catch(problem => {
      if (active) setError(`Could not load this section's saved display choice. It is open by default. ${problem instanceof Error ? problem.message : String(problem)}`);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [preferenceKey, defaultExpanded]);

  async function toggle() {
    if (!ready || saving) return;
    const next = !expanded;
    setSaving(true);
    setError(null);
    try {
      await sectionDisclosurePreferences.save(preferenceKey, next);
      setExpanded(next);
    } catch (problem) {
      setError(`Could not save this section's display choice; its current state was kept. ${problem instanceof Error ? problem.message : String(problem)}`);
    } finally {
      setSaving(false);
    }
  }

  return <View testID={`expandable-group-${testKey}`} style={{ gap: 8 }}>
    <Pressable
      testID={`button-toggle-group-${testKey}`}
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
      accessibilityHint="This choice is saved on this device."
      accessibilityState={{ expanded, disabled: !ready || saving }}
      disabled={!ready || saving}
      onPress={() => { tap(); void toggle(); }}
      style={({ pressed }) => ({
        minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: c.border,
        borderRadius: c.radius, backgroundColor: pressed ? c.secondary : c.card,
        opacity: !ready || saving ? 0.65 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 15, color: c.foreground }}>{title}</Text>
        {summary ? <Muted>{summary}</Muted> : null}
      </View>
      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.primary} />
    </Pressable>
    {expanded ? <View testID={`group-content-${testKey}`} style={{ gap: 8 }}>{children}</View> : null}
    {error ? <Muted>{error}</Muted> : null}
  </View>;
}
