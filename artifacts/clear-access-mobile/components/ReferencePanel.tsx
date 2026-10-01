import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getGetDayActivityQueryKey, useGetDayActivity, useSaveDayActivity, type DayActivityKind, type Nutrition, type Person } from '@/lib/local-api';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Muted, success } from '@/components/ui';
import { n, plannedValue } from '@/lib/format';
import { activityCaloriesPerKg, adolescentProteinReference, calculatePlanningEstimates, getAgeOnDate, getPlanningTargets, nutritionSources, sportsActivities as activities } from '@/lib/planning-targets';

function provenance(source: string | null, reviewedOn: string | null) {
  if (!source && !reviewedOn) return 'No source or professional-review date recorded.';
  return `${source ? `Source note: ${source}. ` : ''}${reviewedOn ? `Professional review date: ${reviewedOn}. ` : ''}User-provided; not verified by this app.`;
}

function Row({ label, unit, expected, actual, note }: { label: string; unit: string; expected: string; actual: string; note?: string }) {
  const c = useColors();
  return <View testID={`comparison-${label.toLowerCase()}`} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, gap: 6 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 14, color: c.foreground }}>{label} <Text style={{ fontFamily: F.regular, fontSize: 11, color: c.mutedForeground }}>({unit})</Text></Text>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}><Eyebrow>Daily reference</Eyebrow><Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>{expected}</Text></View>
      <View style={{ flex: 1, gap: 2 }}><Eyebrow>In planned meals</Eyebrow><Text style={{ fontFamily: F.semi, fontSize: 13, color: actual === 'Not fully reported' ? c.destructive : c.foreground }}>{actual}</Text></View>
    </View>
    {note ? <Muted>{note}</Muted> : null}
  </View>;
}

export function ReferencePanel({ person, date, totals, summaryLoading, summaryError }: { person: Person; date: string; totals?: Nutrition; summaryLoading: boolean; summaryError: boolean }) {
  const router = useRouter();
  const c = useColors();
  const params = { personId: person.id, date };
  const query = useGetDayActivity(params);
  const save = useSaveDayActivity();
  const client = useQueryClient();
  const activity = query.data?.activityType ?? 'rest';
  const sel = activities[activity];
  const weight = person.weightKg;
  const age = person.dateOfBirth === null ? person.ageYears : getAgeOnDate(person.dateOfBirth, date);
  const targets = getPlanningTargets(person, activity, date);
  const estimates = calculatePlanningEstimates(person, activity, date);

  async function choose(v: DayActivityKind) {
    try {
      const saved = await save.mutateAsync({ data: { ...params, activityType: v } });
      client.setQueryData(getGetDayActivityQueryKey(params), saved);
      success();
    } catch { /* error shown below */ }
  }
  const planned = (k: keyof Nutrition, u: string) => summaryError ? 'Unavailable' : summaryLoading || !totals ? 'Loading' : plannedValue(totals, k, u);
  const calcium: [number, number] | undefined = age === null || age < 12 ? undefined : age <= 18 ? [1000, 1200] : [800, 1000];

  return <Card style={{ gap: 12 }}>
    <Eyebrow>Before you plan / activity references</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 22, letterSpacing: -0.8, color: c.foreground }}>What is planned vs. expected</Text>
    <Muted>For {person.name} on this day. Workbook ranges are not clinical requirements. Energy and fat estimates are app-chosen adult planning heuristics; iron and any saved manual fat goal are kept separate.</Muted>
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground, marginTop: 4 }}>Activity you are planning</Text>
      <Chips testPrefix="select-planned-activity" disabled={query.isLoading || query.isError || save.isPending} value={activity} onChange={v => void choose(v)} options={(Object.keys(activities) as DayActivityKind[]).map(k => ({ value: k, label: activities[k].short }))} />
    <Muted>{sel.label}: {sel.detail}</Muted>
    {query.isError ? <ErrorBox error={query.error} onRetry={() => query.refetch()} /> : null}
    {save.isError ? <ErrorBox error={save.error} /> : null}
    <View style={{ backgroundColor: c.accent, borderRadius: 12, padding: 12, gap: 6 }}>
      <Text style={{ fontFamily: F.medium, fontSize: 13, color: c.foreground }}>Body weight: <Text style={{ fontFamily: F.bold }}>{weight === null ? 'not set' : `${n(weight, 1)} kg`}</Text>   Age: <Text style={{ fontFamily: F.bold }}>{age === null ? 'not set' : `${age} years`}</Text></Text>
      {(weight === null || age === null) ? <View style={{ alignSelf: 'flex-start' }}><Btn small variant="ghost" label="Add details in Settings" onPress={() => router.push('/settings')} testID="link-reference-settings" /></View> : null}
    </View>
    <Row label="Energy" unit="kcal" expected={targets.calories} actual={planned('calories', 'kcal')}
      note={activityCaloriesPerKg[activity] === null ? estimates.unavailableReason ?? undefined : `App-chosen heuristic: ${weight === null ? 'body weight' : `${n(weight, 1)} kg`} × ${activityCaloriesPerKg[activity]} kcal/kg/day, rounded to whole kcal. ${estimates.unavailableReason ?? 'Not an official ISSN or CDC activity rule.'}`} />
    <Row label="Carbohydrates" unit="g" expected={targets.carbs} actual={planned('carbs', 'g')}
      note={activity === 'adolescent_athletes' ? 'The supplied adolescent-athlete reference specifies protein only; no carbohydrate range is inferred.' : sel.carbs ? 'Activity-specific range from the uploaded workbook.' : 'The workbook has no numeric range here; shown instead is the ISSN general-fitness reference of 3–5 g/kg/day, not a workbook or activity-specific requirement.'} />
    <Row label="Protein" unit="g" expected={targets.protein} actual={planned('protein', 'g')}
      note={`${activity === 'adolescent_athletes' ? `${adolescentProteinReference(weight)} ` : activity === 'training_60' || activity === 'training_120' ? 'This is the workbook’s basic protein range, not a sport-specific target. ' : ''}${weight !== null && totals ? `Planned protein: ${n(totals.protein / weight, 2)} g/kg body weight.` : ''}`} />
    <Row label="Calcium" unit="mg" expected={calcium ? `${n(calcium[0])}–${n(calcium[1])} mg / day` : age === null ? 'Add age (workbook covers 12+ only)' : 'Not specified in workbook for under 12'} actual={planned('calciumMg', 'mg')}
      note="If any planned food lacks calcium data, the total is not shown as complete. The workbook lists a separate post-menopausal range that is not inferred from age." />
    <Row label="Fat" unit="g" expected={targets.fat} actual={planned('fat', 'g')}
      note={`App-chosen estimate: 30% of estimated energy ÷ 9 kcal/g; the ISSN review's fat range of 20–35% energy is context, not a requirement. ${person.fatGoalG === null ? 'No saved manual fat goal.' : `Separate saved manual fat goal: ${n(person.fatGoalG, 1)} g/day. ${provenance(person.fatGoalSource, person.fatGoalReviewedOn)}`} This personal goal does not override the automatic estimate. The workbook’s fat ranges depend on person groups; we do not infer one.`} />
    <Row label="Iron" unit="mg" expected={person.ironGoalMg === null ? 'No personal goal set' : `${n(person.ironGoalMg, 1)} mg / day (your goal)`} actual={planned('ironMg', 'mg')}
      note={`The workbook’s iron cells were saved as dates; we do not use them as targets. If any food lacks iron data, the planned total is not fully reported. ${person.ironGoalMg === null ? '' : provenance(person.ironGoalSource, person.ironGoalReviewedOn)} Set or clear your goal in Settings.`} />
    <Row label="Fiber" unit="g" expected="No quantitative range in workbook" actual={planned('fiber', 'g')} note="Fiber totals include reported values only; a food without fiber data may make the true amount higher." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <Text accessibilityRole="link" onPress={() => void Linking.openURL(nutritionSources.exerciseNutrition)} style={{ color: c.primary, textDecorationLine: 'underline', fontFamily: F.semi, fontSize: 12 }}>ISSN exercise & sport nutrition review</Text>
      <Text accessibilityRole="link" onPress={() => void Linking.openURL(nutritionSources.fatEnergy)} style={{ color: c.primary, textDecorationLine: 'underline', fontFamily: F.semi, fontSize: 12 }}>Fat energy conversion source</Text>
    </View>
    <Muted>References depend on the activity category you select, not on a measured training load. Food data may be incomplete or inaccurate. Especially for adolescents, pregnancy or medical conditions, use qualified professional advice instead of these ranges.</Muted>
  </Card>;
}
