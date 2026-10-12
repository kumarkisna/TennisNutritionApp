import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useMealHistoryPreferences } from '@/contexts/MealHistoryPreferencesProvider';
import { useColors } from '@/hooks/useColors';
import {
  useCopyMealsToDate, useGetDayActivity, useListMealEntries, useListPeople, useMealPlanReviews, useSaveMealPlanReview,
} from '@/lib/local-api';
import { isIsoDate, shiftDate } from '@/lib/format';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, Muted, Screen, Title, success, warn } from '@/components/ui';
import { dietPhaseLabels, fuelLabels } from '@/lib/tennis-planning';
import type { MealPlanReview, TennisPlan } from '@/lib/local-models';
import { filterMealReviews, sortMealReviews, type MealReviewSort } from '@/lib/meal-review-sort';
import { HydrationWeekCard } from '@/components/HydrationWeekCard';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const planModeLabels = { training: 'Training day', tournament: 'Tournament day', rest: 'Rest day' } as const;
const sessionLabels = { practice: 'Practice', gym: 'Gym', match: 'Match' } as const;
const monthShift = (key: string, amount: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + amount, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const dateFor = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;

function ComparedMealReview({ review, personId, targetPersonId, targetDate, copyPending, onOpenDate, onReuse }: {
  review: MealPlanReview;
  personId: number;
  targetPersonId: number;
  targetDate: string;
  copyPending: boolean;
  onOpenDate: () => void;
  onReuse: (sourceDate: string) => void;
}) {
  const c = useColors();
  const entries = useListMealEntries({ personId, date: review.date });
  const activity = useGetDayActivity({ personId, date: review.date });
  const tennis = activity.data?.tennis;
  return <Card>
    <Eyebrow>{review.date} · {review.rating}/10</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>{review.keyword}</Text>
    {review.note ? <Muted>{review.note}</Muted> : <Muted>No note saved for this meal combination.</Muted>}
    <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 9, gap: 6 }}>
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Meals and portions</Text>
      {entries.isLoading ? <Muted>Loading portions…</Muted> : entries.isError ? <ErrorBox error={entries.error} /> :
        entries.data?.length ? entries.data.map(item => <Muted key={item.id}>{item.meal} · {item.food.name} · {item.grams} g</Muted>) :
          <Muted>No meal portions are saved for this date.</Muted>}
    </View>
    <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 9, gap: 6 }}>
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Tennis plan</Text>
      {activity.isLoading ? <Muted>Loading tennis details…</Muted> : activity.isError ? <ErrorBox error={activity.error} /> :
        tennis ? <>
          <Muted>{planModeLabels[tennis.mode]}{tennis.experienceRating !== undefined ? ` · Tennis-plan rating ${tennis.experienceRating}/10` : ''}</Muted>
          {tennis.sessions.length ? tennis.sessions.map((session, index) =>
            <Muted key={`${session.kind}-${index}`}>{sessionLabels[session.kind]} · {session.startTime} · {session.durationMinutes} min · {session.intensity}</Muted>) :
            <Muted>No court sessions scheduled.</Muted>}
          {(tennis.diets?.length ?? 0) ? <Muted>Timed food: {[...(tennis.diets ?? [])].sort((a, b) => a.time.localeCompare(b.time)).map(slot => `${dietPhaseLabels[slot.phase]} ${slot.time}`).join(' · ')}</Muted> : null}
          {(['before', 'during', 'between', 'after', 'hydration'] as const).filter(key => tennis.fuel[key].trim()).map(key =>
            <Muted key={key}>{fuelLabels[key]}: {tennis.fuel[key]}</Muted>)}
        </> : <Muted>No tennis plan saved for this date.</Muted>}
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Btn small variant="ghost" label="Open date" testID={`button-compare-open-${review.date}`} onPress={onOpenDate} />
      <Btn small icon="copy" label="Reuse meals" loading={copyPending}
        disabled={entries.isLoading || !entries.data?.length || (targetPersonId === personId && targetDate === review.date)}
        testID={`button-compare-reuse-${review.date}`} onPress={() => onReuse(review.date)} />
    </View>
  </Card>;
}

export default function MealHistory() {
  const c = useColors();
  const { person, date, setDate } = usePlanner();
  const historyPreferences = useMealHistoryPreferences();
  const entries = useListMealEntries({ personId: person.id, date });
  const activity = useGetDayActivity({ personId: person.id, date });
  const reviews = useMealPlanReviews(person.id);
  const people = useListPeople();
  const saveReview = useSaveMealPlanReview();
  const copy = useCopyMealsToDate();
  const [month, setMonth] = useState(date.slice(0, 7));
  const [rating, setRating] = useState('');
  const [keyword, setKeyword] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [comparisonDates, setComparisonDates] = useState<string[]>([]);
  const [targetPersonId, setTargetPersonId] = useState(person.id);
  const [targetDate, setTargetDate] = useState(shiftDate(date, 1));
  const [includeTennis, setIncludeTennis] = useState(false);
  const [sessionTimes, setSessionTimes] = useState<string[]>([]);
  const [sessionDurations, setSessionDurations] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [comparisonError, setComparisonError] = useState<unknown>(null);
  const [comparisonNotice, setComparisonNotice] = useState('');
  const minimumRating = historyPreferences.settings.minimumRating === null ? 'all' : String(historyPreferences.settings.minimumRating);
  const reviewSort: MealReviewSort = historyPreferences.settings.sort;
  const review = reviews.data?.find(item => item.date === date);
  const tennis = activity.data?.tennis;
  const filteredReviews = useMemo(() => filterMealReviews(reviews.data ?? [], search, minimumRating === 'all' ? null : Number(minimumRating)),
  [reviews.data, search, minimumRating]);
  const sortedReviews = useMemo(() => sortMealReviews(filteredReviews, reviewSort),
  [filteredReviews, reviewSort]);
  const reviewByDate = useMemo(() => new Map((reviews.data ?? []).map(item => [item.date, item])), [reviews.data]);
  const comparisonReviews = useMemo(() => comparisonDates
    .map(comparisonDate => reviewByDate.get(comparisonDate))
    .filter((item): item is MealPlanReview => Boolean(item)), [comparisonDates, reviewByDate]);
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const daysCount = new Date(year, monthNumber, 0).getDate();
  const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));

  useEffect(() => {
    setRating(review ? String(review.rating) : '');
    setKeyword(review?.keyword ?? '');
    setNote(review?.note ?? '');
    setError(null);
    setNotice('');
  }, [date, review?.rating, review?.keyword, review?.note]);
  useEffect(() => { setTargetPersonId(person.id); }, [person.id]);
  useEffect(() => { setComparisonDates([]); }, [person.id]);
  useEffect(() => {
    setIncludeTennis(false);
    setSessionTimes(tennis?.sessions.map(session => session.startTime) ?? []);
    setSessionDurations(tennis?.sessions.map(session => String(session.durationMinutes)) ?? []);
  }, [date, tennis]);

  async function save() {
    setError(null);
    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 10) { setError(new Error('Choose a rating from 1 to 10.')); return; }
    if (!keyword.trim()) { setError(new Error('Add a keyword so you can find this combination later.')); return; }
    try {
      await saveReview.mutateAsync({ data: { personId: person.id, date, rating: score, keyword, note } });
      success();
      setNotice('Meal review saved for this date.');
    } catch (problem) { setError(problem); warn(); }
  }
  async function reuse() {
    setError(null);
    if (!isIsoDate(targetDate)) { setError(new Error('Enter a valid destination date.')); return; }
    try {
      let tennisPlan: TennisPlan | undefined;
      if (includeTennis && tennis) {
        tennisPlan = {
          ...tennis,
          sessions: tennis.sessions.map((session, index) => ({
            ...session,
            startTime: sessionTimes[index] ?? session.startTime,
            durationMinutes: Number(sessionDurations[index] ?? session.durationMinutes),
          })),
        };
      }
      const count = await copy.mutateAsync({ data: { sourcePersonId: person.id, sourceDate: date, targetPersonId, targetDate, ...(tennisPlan ? { tennisPlan } : {}) } });
      success();
      setNotice(includeTennis
        ? `${count ? `${count} meal portions and ` : ''}The edited tennis plan was copied. The source rating was not copied.`
        : `${count} meal portions added. Existing meals and destination settings were kept.`);
    } catch (problem) { setError(problem); warn(); }
  }
  async function reuseCompared(sourceDate: string) {
    setComparisonError(null);
    setComparisonNotice('');
    if (!isIsoDate(targetDate)) { setComparisonError(new Error('Enter a valid destination date.')); return; }
    try {
      const count = await copy.mutateAsync({ data: { sourcePersonId: person.id, sourceDate, targetPersonId, targetDate } });
      success();
      setComparisonNotice(`${count} meal portions from ${sourceDate} added. The comparison and current date were left unchanged.`);
    } catch (problem) { setComparisonError(problem); warn(); }
  }
  function toggleComparison(reviewDate: string) {
    setComparisonDates(current => current.includes(reviewDate)
      ? current.filter(item => item !== reviewDate)
      : [...current, reviewDate]);
  }

  return <Screen title="Meal history">
    <Eyebrow>Meal history · {person.name}</Eyebrow>
    <Title sub="Review the meals you tried, find the combinations that worked, and reuse them on another day.">Your meal combinations.</Title>
    <HydrationWeekCard personId={person.id} personName={person.name} />
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Btn small variant="ghost" label="Previous month" testID="button-meal-calendar-previous" onPress={() => setMonth(monthShift(month, -1))} />
        <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 17, color: c.foreground }}>{monthTitle}</Text>
        <Btn small variant="ghost" label="Next month" testID="button-meal-calendar-next" onPress={() => setMonth(monthShift(month, 1))} />
      </View>
      <View style={{ flexDirection: 'row' }}>{weekdays.map(day => <Text key={day} style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 11, color: c.mutedForeground }}>{day}</Text>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: firstWeekday }, (_, i) => <View key={`blank-${i}`} style={{ width: '14.285%', minHeight: 54 }} />)}
        {Array.from({ length: daysCount }, (_, i) => {
          const day = i + 1;
          const dayDate = dateFor(month, day);
          const score = reviewByDate.get(dayDate)?.rating;
          const selected = date === dayDate;
          return <Pressable key={dayDate} testID={`button-meal-calendar-${dayDate}`} accessibilityRole="button" accessibilityLabel={`${dayDate}${score ? `, rating ${score} out of 10` : ''}`} accessibilityState={{ selected }}
            onPress={() => { setDate(dayDate); setMonth(dayDate.slice(0, 7)); }}
            style={{ width: '14.285%', minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, backgroundColor: selected ? c.primary : 'transparent' }}>
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: selected ? c.primaryForeground : c.foreground }}>{day}</Text>
            {score ? <Text style={{ fontFamily: F.bold, fontSize: 9, color: selected ? c.primaryForeground : c.primary }}>{score}/10</Text> : null}
          </Pressable>;
        })}
      </View>
      <Muted>Rated days show their score. Select any date to review its planned meals.</Muted>
    </Card>
    <Card>
      <Eyebrow>{date} · {person.name}</Eyebrow>
      <Text style={{ fontFamily: F.bold, fontSize: 19, color: c.foreground }}>Meals for this date</Text>
      {entries.isLoading ? <Muted>Loading meals…</Muted> : entries.isError ? <ErrorBox error={entries.error} /> :
        entries.data?.length ? entries.data.map(item => <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
          <Text style={{ flex: 1, fontFamily: F.semi, color: c.foreground }}>{item.meal} · {item.food.name}</Text>
          <Text style={{ fontFamily: F.medium, color: c.mutedForeground }}>{item.grams} g</Text>
        </View>) : <Muted>No meals are planned for this date yet.</Muted>}
    </Card>
    <Card>
      <Eyebrow>Tennis plan</Eyebrow>
      <Text style={{ fontFamily: F.bold, fontSize: 19, color: c.foreground }}>Court time and fuel timing</Text>
      {activity.isLoading ? <Muted>Loading tennis details…</Muted> : activity.isError ? <ErrorBox error={activity.error} /> :
        tennis ? <>
          <Muted>{planModeLabels[tennis.mode]}{tennis.experienceRating !== undefined ? ` · Tennis-plan experience ${tennis.experienceRating}/10` : ''}</Muted>
          {tennis.sessions.length ? tennis.sessions.map((session, index) => <View key={`${session.kind}-${index}`} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
            <Text style={{ fontFamily: F.semi, color: c.foreground }}>{sessionLabels[session.kind]} · {session.startTime}</Text>
            <Muted>{session.durationMinutes} min · {session.intensity} intensity</Muted>
          </View>) : <Muted>No court sessions scheduled.</Muted>}
          {(tennis.diets?.length ?? 0) > 0 ? <View style={{ gap: 5 }}>
            <Text style={{ fontFamily: F.bold, color: c.foreground }}>Timed food slots</Text>
            {[...(tennis.diets ?? [])].sort((a, b) => a.time.localeCompare(b.time)).map(slot =>
              <Muted key={slot.id}>{dietPhaseLabels[slot.phase]} · {slot.time}</Muted>)}
          </View> : null}
          {(['before', 'during', 'between', 'after', 'hydration'] as const).some(key => tennis.fuel[key].trim()) ?
            <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 8 }}>
              <Text style={{ fontFamily: F.bold, color: c.foreground }}>Fuel and hydration notes</Text>
              {(['before', 'during', 'between', 'after', 'hydration'] as const).filter(key => tennis.fuel[key].trim()).map(key =>
                <View key={key}><Text style={{ fontFamily: F.semi, color: c.foreground }}>{fuelLabels[key]}</Text><Muted>{tennis.fuel[key]}</Muted></View>)}
            </View> : null}
        </> : <Muted>No tennis plan was saved for this date.</Muted>}
    </Card>
    <Card>
      <Eyebrow>Remember what worked</Eyebrow>
      <Text style={{ fontFamily: F.bold, fontSize: 19, color: c.foreground }}>Rate this meal combination</Text>
      <Muted>Ratings and notes belong to this person and date; they do not change nutrition goals or tennis-plan ratings.</Muted>
      <Field label="Keyword" value={keyword} onChangeText={setKeyword} maxLength={40} placeholder="e.g. tournament breakfast" testID="input-meal-review-keyword" />
      <Field label="Notes" value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="What worked well? Anything to change next time?" testID="input-meal-review-note" />
      <Chips testPrefix="select-meal-review-rating" value={rating} onChange={setRating} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}` }))} />
      <Btn label={review ? 'Update rating and note' : 'Save rating and note'} icon="save" loading={saveReview.isPending} disabled={!entries.data?.length} testID="button-save-meal-review" onPress={() => void save()} />
      {notice ? <Muted>{notice}</Muted> : null}
      {error ? <ErrorBox error={error} /> : null}
    </Card>
    <Card>
      <Eyebrow>Reuse</Eyebrow>
      <Text style={{ fontFamily: F.bold, fontSize: 19, color: c.foreground }}>Use these meals again</Text>
      <Muted>Adds portions to the destination without replacing existing meals or reminders. The rating and note stay on the source date.</Muted>
      <Chips testPrefix="select-meal-reuse-person" value={String(targetPersonId)} onChange={value => setTargetPersonId(Number(value))}
        options={(people.data ?? []).map(item => ({ value: String(item.id), label: item.name }))} />
      <Field label="Destination date (YYYY-MM-DD)" value={targetDate} onChangeText={setTargetDate} maxLength={10} keyboardType="numbers-and-punctuation" testID="input-meal-reuse-date" />
      {tennis ? <>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>Include the source tennis plan?</Text>
        <Chips testPrefix="select-meal-reuse-tennis" value={includeTennis ? 'yes' : 'no'} onChange={value => setIncludeTennis(value === 'yes')}
          options={[{ value: 'no', label: 'Meals only' }, { value: 'yes', label: 'Meals + tennis plan' }]} />
        {includeTennis ? <>
          <Muted>Session times and durations below are editable for the copied plan. Timed food slots and notes keep their source values. The destination must not already have a tennis plan, and its activity setting is not changed.</Muted>
          {tennis.sessions.map((session, index) => <View key={`copy-session-${index}`} style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label={`${sessionLabels[session.kind]} start (24h)`} value={sessionTimes[index] ?? session.startTime}
              onChangeText={value => setSessionTimes(current => current.map((time, i) => i === index ? value : time))}
              maxLength={5} keyboardType="numbers-and-punctuation" testID={`input-copy-tennis-time-${index}`} /></View>
            <View style={{ flex: 1 }}><Field label="Duration (min)" value={sessionDurations[index] ?? String(session.durationMinutes)}
              onChangeText={value => setSessionDurations(current => current.map((duration, i) => i === index ? value : duration))}
              maxLength={3} keyboardType="number-pad" testID={`input-copy-tennis-duration-${index}`} /></View>
          </View>)}
          {tennis.mode !== 'rest' ? <Muted>For a training or tournament plan, set the destination day to an active activity in Planner first. This copy does not change its nutrition estimate.</Muted> : null}
        </> : null}
      </> : null}
      <Btn label={includeTennis ? 'Add meals and tennis plan' : 'Add meals to destination'} icon="copy" loading={copy.isPending}
        disabled={!entries.data?.length && !(includeTennis && tennis)} testID="button-reuse-meal-combination" onPress={() => void reuse()} />
      {notice ? <Muted>{notice}</Muted> : null}
      {error ? <ErrorBox error={error} /> : null}
    </Card>
    <Card>
      <Eyebrow>Saved meal history</Eyebrow>
      <Field label="Find by keyword or note" value={search} onChangeText={setSearch} placeholder="e.g. match day, felt energized" testID="input-meal-history-search" />
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Minimum rating</Text>
      <Chips testPrefix="select-meal-history-min-rating" value={minimumRating} disabled={historyPreferences.loading}
        onChange={value => { void historyPreferences.updateSettings({ minimumRating: value === 'all' ? null : Number(value) }); }}
        options={[{ value: 'all', label: 'Any rating' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}+` }))]} />
      <Chips testPrefix="select-meal-history-sort" value={reviewSort} disabled={historyPreferences.loading}
        onChange={value => { void historyPreferences.updateSettings({ sort: value as MealReviewSort }); }}
        options={[{ value: 'recent', label: 'Newest first' }, { value: 'rating', label: 'Highest rated' }]} />
      {historyPreferences.error ? <ErrorBox error={new Error(historyPreferences.error)} /> : null}
      {historyPreferences.loading ? <Muted>Loading saved history filters…</Muted> : sortedReviews.length ? sortedReviews.map(item => <View key={`${item.personId}:${item.date}`}
        style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 9, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable style={{ flex: 1, gap: 3 }} onPress={() => { setDate(item.date); setMonth(item.date.slice(0, 7)); }}>
            <Text style={{ fontFamily: F.bold, color: c.foreground }}>{item.date} · {item.rating}/10</Text>
            <Muted>{item.keyword}{item.note ? ` · ${item.note}` : ''}</Muted>
          </Pressable>
          <Btn small variant="ghost" label={comparisonDates.includes(item.date) ? 'Remove' : 'Compare'}
            testID={`button-meal-history-compare-${item.date}`} onPress={() => toggleComparison(item.date)} />
        </View>
      </View>) : <Muted>No rated meal combinations match these filters yet.</Muted>}
      {comparisonDates.length === 1 ? <Muted>Select one more saved date to compare meal portions, notes, and tennis details.</Muted> : null}
    </Card>
    {comparisonReviews.length >= 2 ? <>
      <Text style={{ fontFamily: F.bold, fontSize: 20, color: c.foreground }}>Compare saved combinations</Text>
      <Muted>Use the destination person and date in Reuse above. Reuse copies from a comparison card without changing the date open in the calendar.</Muted>
      {comparisonReviews.map(item => <ComparedMealReview key={item.date} review={item} personId={person.id}
        targetPersonId={targetPersonId} targetDate={targetDate} copyPending={copy.isPending}
        onOpenDate={() => { setDate(item.date); setMonth(item.date.slice(0, 7)); }}
        onReuse={sourceDate => void reuseCompared(sourceDate)} />)}
      {comparisonNotice ? <Muted>{comparisonNotice}</Muted> : null}
      {comparisonError ? <ErrorBox error={comparisonError} /> : null}
    </> : null}
    {notice ? <Muted>{notice}</Muted> : null}
    {error ? <ErrorBox error={error} /> : null}
  </Screen>;
}
