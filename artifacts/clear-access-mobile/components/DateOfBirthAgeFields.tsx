import { Field } from '@/components/ui';
import { getAgeOnDate } from '@/lib/planning-targets';
import { today } from '@/lib/format';

export function DateOfBirthAgeFields({
  dateOfBirth,
  onChangeDateOfBirth,
  testPrefix,
}: {
  dateOfBirth: string;
  onChangeDateOfBirth: (value: string) => void;
  testPrefix: string;
}) {
  const trimmedDate = dateOfBirth.trim();
  const age = trimmedDate ? getAgeOnDate(trimmedDate, today()) : null;

  return <>
    <Field
      label="Date of birth"
      value={dateOfBirth}
      onChangeText={onChangeDateOfBirth}
      placeholder="YYYY-MM-DD"
      hint="Optional. Enter a real date in YYYY-MM-DD format; age is calculated automatically."
      maxLength={10}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="numbers-and-punctuation"
      testID={`${testPrefix}-date-of-birth`}
      accessibilityLabel="Date of birth"
    />
    <Field
      label="Age (years)"
      value={age === null ? 'Not set' : String(age)}
      onChangeText={() => {}}
      editable={false}
      hint={trimmedDate && age === null
        ? 'Enter a valid date of birth to calculate age.'
        : 'Calculated automatically from date of birth.'}
      testID={`${testPrefix}-age`}
      accessibilityLabel="Calculated age in years"
    />
  </>;
}
