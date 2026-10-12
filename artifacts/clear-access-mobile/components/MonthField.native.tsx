import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Btn, Field, Muted } from '@/components/ui';
import type { MonthFieldProps } from '@/components/MonthField';

function parseMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year, month - 1, 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthField({ label, value, onChangeText, testID }: MonthFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const update = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) onChangeText(formatMonth(selected));
  };
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: parseMonth(value), mode: 'date', onChange: update });
    } else setIosOpen(current => !current);
  };
  return <View style={{ gap: 5, flex: 1 }}>
    <Field label={label} value={value} editable={false} testID={testID} />
    <Btn small variant="ghost" label={iosOpen ? 'Hide month picker' : 'Choose month'}
      testID={`${testID}-picker`} onPress={open} />
    {iosOpen ? <View style={{ gap: 4 }}>
      <DateTimePicker mode="date" display="spinner" value={parseMonth(value)} onChange={update} />
      <Muted>Choose any date in the month, then confirm.</Muted>
      <Btn small label="Done" testID={`${testID}-picker-done`} onPress={() => setIosOpen(false)} />
    </View> : null}
  </View>;
}
