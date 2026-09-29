import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  getGetDayActivityQueryKey,
  useGetDayActivity,
  useSaveDayActivity,
  type DayActivityType,
  type Nutrition,
  type Person,
} from '@workspace/api-client-react';

// Source: the uploaded Sports Nutrition workbook, "Nutrition Master" sheet.
// These are workbook reference ranges, not clinical requirements.
const activities: Record<DayActivityType, {
  label: string;
  detail: string;
  carbs?: [number, number];
  protein: [number, number];
}> = {
  rest: { label: 'Rest or ordinary day', detail: 'Basic nutrition; no numeric carbohydrate range in the workbook', protein: [0.8, 1] },
  low_intensity: { label: 'Low-intensity sport', detail: 'Gentle training', protein: [0.8, 1] },
  training_60: { label: 'Training up to 60 minutes', detail: 'Moderate to high intensity', carbs: [5, 6], protein: [0.8, 1] },
  training_120: { label: 'Training 60–120 minutes', detail: 'Moderate to high intensity, e.g. tennis', carbs: [7, 8], protein: [0.8, 1] },
  endurance: { label: 'Endurance training 2–5 hours', detail: 'Intense endurance exercise', carbs: [8, 10], protein: [1.2, 1.4] },
  extreme: { label: 'Extreme training over 5 hours', detail: 'Intense endurance exercise', carbs: [10, 10], protein: [1.2, 1.4] },
  strength: { label: 'Strength or power training', detail: 'No numeric carbohydrate range for strength in the workbook', protein: [1.6, 1.7] },
};

const format = (value: number, places = 0) =>
  value.toLocaleString(undefined, { maximumFractionDigits: places });

function goalProvenance(source: string | null, reviewedOn: string | null) {
  if (!source && !reviewedOn) return 'No source or professional-review date recorded.';
  return `${source ? `Source note: ${source}. ` : ''}${reviewedOn ? `Professional review date: ${reviewedOn}. ` : ''}User-provided; not verified by this app.`;
}

function RangeRow({ label, expected, actual, unit, note }: {
  label: string;
  expected: string;
  actual: string;
  unit: string;
  note?: string;
}) {
  return <div className="grid gap-2 border-t border-[#e9e4d9] py-4 sm:grid-cols-[1fr_1.2fr_1fr]" data-testid={`comparison-${label.toLowerCase()}`}>
    <div className="font-bold">{label}<span className="ml-1 text-xs font-normal text-[#6d7a79]">({unit})</span></div>
    <div><span className="text-[10px] uppercase tracking-[.12em] text-[#6d7a79] sm:hidden">Daily reference: </span><strong>{expected}</strong></div>
    <div><span className="text-[10px] uppercase tracking-[.12em] text-[#6d7a79] sm:hidden">Planned: </span><strong>{actual}</strong></div>
    {note && <p className="text-xs leading-5 text-[#6d7a79] sm:col-span-3">{note}</p>}
  </div>;
}

export function SportsReferencePanel({ person, date, totals, summaryLoading, summaryError }: {
  person: Person;
  date: string;
  totals?: Nutrition;
  summaryLoading: boolean;
  summaryError: boolean;
}) {
  const params = { personId: person.id, date };
  const query = useGetDayActivity(params);
  const save = useSaveDayActivity();
  const client = useQueryClient();
  const activity = query.data?.activityType ?? 'rest';
  const selected = activities[activity];
  const weight = person.weightKg;
  const age = person.ageYears;

  async function chooseActivity(value: DayActivityType) {
    try {
      const saved = await save.mutateAsync({ data: { ...params, activityType: value } });
      client.setQueryData(getGetDayActivityQueryKey(params), saved);
    } catch {
      // The error stays visible below, and the selector remains at its last saved value.
    }
  }

  function target(range?: [number, number], unit = 'g') {
    if (weight === null) return 'Add body weight to calculate';
    if (!range) return 'Not specified in workbook';
    const [low, high] = range.map(value => value * weight);
    return `${format(low)}${low === high ? '' : `–${format(high)}`} ${unit} / day`;
  }

  function planned(key: keyof Nutrition, unit: string) {
    if (summaryError) return 'Unavailable';
    if (summaryLoading || !totals) return 'Loading…';
    const value = totals[key];
    return value === null ? 'Not fully reported' : `${format(value, 1)} ${unit}`;
  }

  const calciumRange: [number, number] | undefined =
    age === null || age < 12 ? undefined : age <= 18 ? [1000, 1200] : [800, 1000];

  return <section className="workspace-section workspace-card workspace-card-pad" data-testid="section-sports-reference">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="workspace-eyebrow">Before you plan / workbook reference</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em]">What is planned vs. expected</h2>
         <p className="mt-2 text-sm leading-6 text-[#6d7a79]">For {person.name} on this day. Workbook ranges are not clinical requirements. Iron and fat use only goals you explicitly enter in Preferences.</p></div>
      <div className="min-w-56"><label htmlFor="planned-activity" className="workspace-label">Activity you are planning</label>
        <select id="planned-activity" className="workspace-input" value={activity} disabled={query.isLoading || query.isError || save.isPending}
          onChange={event => void chooseActivity(event.target.value as DayActivityType)} data-testid="select-planned-activity">
          {Object.entries(activities).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
        </select>
        <p className="mt-2 text-xs text-[#6d7a79]">{selected.detail}</p></div>
    </div>
    {query.isError && <p role="alert" className="workspace-notice mt-4">Could not load the planned activity. Refresh the page to retry.</p>}
    {save.isError && <p role="alert" className="workspace-notice mt-4">Could not save the activity. Try again.</p>}
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-[#e8f3ed] px-4 py-3 text-sm">
      <span>Body weight: <strong>{weight === null ? 'not set' : `${format(weight, 1)} kg`}</strong></span>
      <span>Age: <strong>{age === null ? 'not set' : `${age} years`}</strong></span>
      {(weight === null || age === null) && <Link href="/settings" className="font-bold text-[#176d61] underline">Add details in Preferences</Link>}
    </div>
    <div className="mt-6 hidden grid-cols-[1fr_1.2fr_1fr] text-[10px] font-bold uppercase tracking-[.12em] text-[#6d7a79] sm:grid">
      <span>Nutrient</span><span>Daily reference</span><span>In planned meals</span>
    </div>
    <RangeRow label="Energy" unit="kcal" expected={`~${format(person.targetCalories)} kcal (your existing estimate)`} actual={planned('calories', 'kcal')} />
    <RangeRow label="Carbohydrates" unit="g" expected={target(selected.carbs)} actual={planned('carbs', 'g')} />
    <RangeRow label="Protein" unit="g" expected={target(selected.protein)} actual={planned('protein', 'g')}
      note={`${activity === 'training_60' || activity === 'training_120' ? 'This is the workbook’s basic protein range, not a sport-specific target. ' : ''}${weight !== null && totals ? `Planned protein: ${format(totals.protein / weight, 2)} g/kg body weight.` : ''}`} />
    <RangeRow label="Calcium" unit="mg" expected={calciumRange ? `${format(calciumRange[0])}–${format(calciumRange[1])} mg / day` : 'Add age (workbook covers 12+ only)'}
      actual={planned('calciumMg', 'mg')} note="If any planned food lacks calcium data, the total is not shown as complete. The workbook lists a separate post-menopausal range that is not inferred from age." />
    <RangeRow label="Fat" unit="g" expected={person.fatGoalG === null ? 'No personal goal set' : `${format(person.fatGoalG, 1)} g / day (your goal)`} actual={planned('fat', 'g')}
      note={`The workbook’s fat ranges depend on person groups; we do not infer one. ${person.fatGoalG === null ? 'Set your own goal in Preferences.' : goalProvenance(person.fatGoalSource, person.fatGoalReviewedOn)} Set or clear your goal in Preferences.`} />
    <RangeRow label="Iron" unit="mg" expected={person.ironGoalMg === null ? 'No personal goal set' : `${format(person.ironGoalMg, 1)} mg / day (your goal)`} actual={planned('ironMg', 'mg')}
      note={`The workbook’s iron cells were saved as dates; we do not use them as targets. If any food lacks iron data, the planned total is not fully reported. ${person.ironGoalMg === null ? '' : goalProvenance(person.ironGoalSource, person.ironGoalReviewedOn)} Set or clear your goal in Preferences.`} />
    <RangeRow label="Fiber" unit="g" expected="No quantitative range in workbook" actual={planned('fiber', 'g')}
      note="Fiber totals include reported values only; a food without fiber data may make the true amount higher." />
    <p className="mt-4 text-xs leading-6 text-[#6d7a79]">References depend on the activity category you select, not on a measured training load. Food data may be incomplete or inaccurate. Especially for adolescents, pregnancy or medical conditions, use qualified professional advice instead of these ranges.</p>
  </section>;
}