import { createElement, useEffect, useState, type ChangeEvent } from 'react';
import { Text, View } from 'react-native';
import { F } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export type TimeFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  testID: string;
  editable?: boolean;
  placeholder?: string;
};

function splitTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hour: match[1], minute: match[2] } : { hour: '', minute: '' };
}

export default function TimeField({ label, value, onChangeText, testID, editable = true }: TimeFieldProps) {
  const c = useColors();
  const [draft, setDraft] = useState(() => splitTime(value));
  useEffect(() => setDraft(splitTime(value)), [value]);

  const updatePart = (part: 'hour' | 'minute', nextValue: string) => {
    const next = { ...draft, [part]: nextValue };
    setDraft(next);
    if (!nextValue) {
      onChangeText('');
    } else if (next.hour && next.minute) {
      onChangeText(`${next.hour}:${next.minute}`);
    }
  };

  const options = (count: number, hint: string) => [
    createElement('option', { key: 'empty', value: '' }, hint),
    ...Array.from({ length: count }, (_, index) => {
      const option = String(index).padStart(2, '0');
      return createElement('option', { key: option, value: option }, option);
    }),
  ];

  const selectStyle = {
    boxSizing: 'border-box',
    width: '50%',
    minHeight: 48,
    borderRadius: 12,
    border: `1px solid ${c.input}`,
    backgroundColor: c.card,
    padding: '10px 12px',
    fontFamily: F.medium,
    fontSize: 15,
    color: c.foreground,
    opacity: editable ? 1 : 0.5,
  };

  return <View style={{ gap: 6 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>{label}</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {createElement('select', {
        value: draft.hour,
        disabled: !editable,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => updatePart('hour', event.currentTarget.value),
        'aria-label': `${label} hour, 24-hour format`,
        'data-testid': `${testID}-hour`,
        style: selectStyle,
      }, ...options(24, 'HH'))}
      {createElement('select', {
        value: draft.minute,
        disabled: !editable,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => updatePart('minute', event.currentTarget.value),
        'aria-label': `${label} minute`,
        'data-testid': `${testID}-minute`,
        style: selectStyle,
      }, ...options(60, 'MM'))}
    </View>
    <Text style={{ fontFamily: F.regular, fontSize: 11, color: c.mutedForeground }}>Hours 00–23 · minutes 00–59 (24-hour format)</Text>
  </View>;
}
