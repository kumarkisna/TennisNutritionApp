import { createElement, type ChangeEvent } from 'react';
import { Text, View } from 'react-native';
import { F } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export type DateFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  testID: string;
};

export default function DateField({ label, value, onChangeText, testID }: DateFieldProps) {
  const c = useColors();
  return <View style={{ gap: 6, flex: 1 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>{label}</Text>
    {createElement('input', {
      type: 'date',
      value,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(event.currentTarget.value)) onChangeText(event.currentTarget.value);
      },
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
      },
    })}
  </View>;
}
