import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Btn, Field, Muted } from '@/components/ui';
import type { TimeFieldProps } from '@/components/TimeField';

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  const time = new Date();
  time.setHours(match ? Number(match[1]) : 12, match ? Number(match[2]) : 0, 0, 0);
  return time;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function TimeField({ label, value, onChangeText, testID, editable = true, placeholder }: TimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const update = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) onChangeText(formatTime(selected));
  };
  const open = () => {
    if (!editable) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: parseTime(value), mode: 'time', is24Hour: true, onChange: update });
    } else setIosOpen(current => !current);
  };
  return <View style={{ gap: 6 }}>
    <Field label={label} value={value} onChangeText={onChangeText} placeholder={placeholder ?? 'HH:MM'}
      maxLength={5} keyboardType="numbers-and-punctuation" editable={editable} testID={testID} />
    <Btn small variant="ghost" icon="clock" label={iosOpen ? 'Hide time picker' : 'Choose time'}
      testID={`${testID}-picker`} disabled={!editable} onPress={open} />
    {iosOpen ? <View style={{ gap: 4 }}>
      <DateTimePicker mode="time" display="spinner" value={parseTime(value)} is24Hour locale="en_GB" onChange={update} />
      <Muted>Scroll to choose a 24-hour time, then close the picker.</Muted>
      <Btn small label="Done" testID={`${testID}-picker-done`} onPress={() => setIosOpen(false)} />
    </View> : null}
  </View>;
}
