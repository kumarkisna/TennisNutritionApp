import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { themes } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeProvider';
import { useColors } from '@/hooks/useColors';
import { Card, Chips, Eyebrow, F, Field, Muted, success, tap, warn } from './ui';

export function ThemePicker() {
  const c = useColors();
  const { theme, selectTheme, saving } = useTheme();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'all' | 'light' | 'dark'>('all');
  const visible = themes.filter(option => (mode === 'all' || option.mode === mode) &&
    option.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <Card>
    <Eyebrow>Appearance / {themes.length} themes</Eyebrow>
    <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 22, color: c.foreground }}>Make it yours.</Text>
    <Muted>Applies throughout the app and saves on this device. It does not change anyone’s foods, plans, or nutrition settings.</Muted>
    <Text testID="value-selected-theme" accessibilityLiveRegion="polite" style={{ fontFamily: F.semi, fontSize: 13, color: c.primary }}>
      {saving ? 'Saving your theme…' : `Current theme: ${theme.name}`}
    </Text>
    <Field label="Find a theme" value={search} onChangeText={setSearch} placeholder="Search by name"
      autoCapitalize="none" autoCorrect={false} testID="input-theme-search" />
    <Chips value={mode} onChange={setMode} testPrefix="filter-themes"
      options={[{ value: 'all', label: 'All' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
    <Text testID="value-theme-count" style={{ fontFamily: F.medium, fontSize: 12, color: c.mutedForeground }}>
      {visible.length} of {themes.length} themes
    </Text>
    {visible.length === 0 ? <Muted>No matching themes. Try another name or filter.</Muted> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {visible.map(option => {
        const selected = theme.id === option.id;
        const p = option.palette;
        return <Pressable key={option.id} testID={`select-theme-${option.id}`} accessibilityRole="button"
          accessibilityLabel={`${option.name}, ${option.mode} theme`}
          accessibilityState={{ selected, disabled: saving }}
          disabled={saving}
          onPress={async () => { tap(); if (await selectTheme(option.id)) success(); else warn(); }}
          style={({ pressed }) => ({
            flexBasis: '46%', flexGrow: 1, minHeight: 115, padding: 12, borderRadius: 14,
            borderWidth: 2, borderColor: selected ? c.primary : c.border,
            backgroundColor: p.background, opacity: saving ? 0.65 : pressed ? 0.8 : 1, gap: 7,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 5 }}>
              {[p.primary, p.foreground, p.card].map((color, index) => <View key={index} style={{
                width: 16, height: 16, borderRadius: 8, backgroundColor: color, borderWidth: 1, borderColor: p.border,
              }} />)}
            </View>
            {selected ? <Feather name="check-circle" size={18} color={p.primary} /> : null}
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 12.5, lineHeight: 17, color: p.foreground }}>{option.name}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: p.mutedForeground }}>
            {selected ? 'Selected' : option.mode === 'dark' ? 'Dark' : 'Light'}
          </Text>
        </Pressable>;
      })}
    </View>
  </Card>;
}