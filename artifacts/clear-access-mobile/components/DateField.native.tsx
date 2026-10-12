import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Btn, Field, Muted } from '@/components/ui';
import type { DateFieldProps } from '@/components/DateField';

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function formatDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DateField({ label, value, onChangeText, testID }: DateFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const update = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) onChangeText(formatDate(selected));
  };
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: parseDate(value), mode: 'date', onChange: update });
    } else setIosOpen(current => !current);
  };
  return <View style={{ gap: 5, flex: 1 }}>
    <Field label={label} value={value} editable={false} testID={testID} />
    <Btn small variant="ghost" label={iosOpen ? 'Hide date picker' : 'Choose date'}
      testID={`${testID}-picker`} onPress={open} />
    {iosOpen ? <View style={{ gap: 4 }}>
      <DateTimePicker mode="date" display="spinner" value={parseDate(value)} onChange={update} />
      <Muted>Choose the saved date to copy times from.</Muted>
      <Btn small label="Done" testID={`${testID}-picker-done`} onPress={() => setIosOpen(false)} />
    </View> : null}
  </View>;
}
