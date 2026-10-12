import { createElement, type ChangeEvent } from 'react';
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

export default function TimeField({ label, value, onChangeText, testID, editable = true }: TimeFieldProps) {
  const c = useColors();
  return <View style={{ gap: 6 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>{label}</Text>
    {createElement('input', {
      type: 'time',
      step: 60,
      value,
      disabled: !editable,
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChangeText(event.currentTarget.value),
      'aria-label': label,
      'data-testid': testID,
      style: {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 48,
        borderRadius: 12,
        border: `1px solid ${c.input}`,
        backgroundColor: c.card,
        padding: '10px 14px',
        fontFamily: F.medium,
        fontSize: 15,
        color: c.foreground,
        opacity: editable ? 1 : 0.5,
      },
    })}
  </View>;
}
