import { useState } from 'react';
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import type { MealEntry, MealTimes, TennisDiet } from '@/lib/local-api';
import { buildPlannedDietHtml } from '@/lib/print-plan';
import { Btn, ErrorBox, warn } from '@/components/ui';

export function PrintDayPlanButton({
  personName,
  date,
  entries,
  mealTimes,
  tennisDiets,
  disabled = false,
}: {
  personName: string;
  date: string;
  entries: MealEntry[];
  mealTimes: MealTimes;
  tennisDiets: TennisDiet[];
  disabled?: boolean;
}) {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function printDayPlan() {
    if (printing || disabled) return;
    setError(null);
    setPrinting(true);
    try {
      const html = buildPlannedDietHtml({ personName, date, entries, mealTimes, tennisDiets });
      if (Platform.OS === 'web') await Print.printToFileAsync({ html });
      else await Print.printAsync({ html });
    } catch (caught) {
      warn();
      setError(caught);
    } finally {
      setPrinting(false);
    }
  }

  return <>
    <Btn
      icon="printer"
      label="Print day plan"
      loading={printing}
      disabled={disabled}
      onPress={() => void printDayPlan()}
      testID="button-print-day-plan"
    />
    {error ? <ErrorBox error={error} /> : null}
  </>;
}