import { createElement, type ChangeEvent } from 'react';
import { Text, View } from 'react-native';
import { F } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export type MonthFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  testID: string;
};

export default function MonthField({ label, value, onChangeText, testID }: MonthFieldProps) {
  const c = useColors();
  const update = (nextValue: string) => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(nextValue)) onChangeText(nextValue);
  };
  return <View style={{ gap: 6, flex: 1 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>{label}</Text>
    {createElement('input', {
      type: 'month',
      value,
      onChange: (event: ChangeEvent<HTMLInputElement>) => update(event.currentTarget.value),
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
