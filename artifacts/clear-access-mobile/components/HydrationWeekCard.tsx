import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useDayActivitiesForDates } from '@/lib/local-api';
import { dateLabel, shiftDate, today } from '@/lib/format';
import { hydrationTotals } from '@/lib/hydration';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Eyebrow, ErrorBox, F, LoadingBlock, Muted } from '@/components/ui';

export function HydrationWeekCard({ personName, personId }: { personName: string; personId: number }) {
  const c = useColors();
  const [weekEnd, setWeekEnd] = useState(today);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDate(weekEnd, i - 6)), [weekEnd]);
  const queries = useDayActivitiesForDates(personId, dates);
  const failed = queries.find(query => query.isError);
  const loading = queries.some(query => query.isLoading);
  const rows = dates.map((date, index) => {
    const log = queries[index]?.data?.hydration;
    const totals = hydrationTotals(log);
    const pending = (log?.entries ?? []).filter(entry => entry.actualMl === null).length;
    return { date, planned: totals.plannedMl, actual: totals.actualMl, pending, entries: log?.entries.length ?? 0 };
  });
  const plannedWeek = rows.reduce((total, row) => total + row.planned, 0);
  const actualWeek = rows.reduce((total, row) => total + row.actual, 0);
  return <Card>
    <Eyebrow>Hydration history · {personName}</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>Planned and recorded · 7 days</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Btn small variant="ghost" label="Previous week" testID="button-hydration-week-previous" onPress={() => setWeekEnd(date => shiftDate(date, -7))} />
      <Muted>{dates[0]} — {dates[6]}</Muted>
      <Btn small variant="ghost" label="Next week" testID="button-hydration-week-next" disabled={weekEnd >= today()} onPress={() => setWeekEnd(date => shiftDate(date, 7))} />
    </View>
    {loading ? <LoadingBlock rows={4} height={30} /> : failed ? <ErrorBox error={failed.error} /> : <>
      <Muted>Week total: {plannedWeek} mL planned · {actualWeek} mL recorded. These are logged amounts, not recommended targets.</Muted>
      {rows.map(row => <View key={row.date} testID={`hydration-week-row-${row.date}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6, borderTopWidth: 1, borderColor: c.border, paddingVertical: 7 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontFamily: F.semi, fontSize: 12 }}>{dateLabel(row.date)}</Text>
          <Muted>{row.entries ? `${row.pending} planned drink${row.pending === 1 ? '' : 's'} not recorded` : 'No drinks planned'}</Muted>
        </View>
        <Text style={{ color: c.foreground, fontFamily: F.medium, fontSize: 12, textAlign: 'right' }}>
          {row.planned} / {row.actual} mL
          {'\n'}planned / recorded
        </Text>
      </View>)}
    </>}
  </Card>;
}
