import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import {
  useCopyMealsToDate, useListMealEntries, useListPeople, useMealPlanReviews, useSaveMealPlanReview,
} from '@/lib/local-api';
import { isIsoDate, shiftDate } from '@/lib/format';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, Muted, Screen, Title, success, warn } from '@/components/ui';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthShift = (key: string, amount: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + amount, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const dateFor = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;

export default function MealHistory() {
  const c = useColors();
  const { person, date, setDate } = usePlanner();
  const entries = useListMealEntries({ personId: person.id, date });
  const reviews = useMealPlanReviews(person.id);
  const people = useListPeople();
  const saveReview = useSaveMealPlanReview();
  const copy = useCopyMealsToDate();
  const [month, setMonth] = useState(date.slice(0, 7));
  const [rating, setRating] = useState('');
  const [keyword, setKeyword] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [targetPersonId, setTargetPersonId] = useState(person.id);
  const [targetDate, setTargetDate] = useState(shiftDate(date, 1));
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const review = reviews.data?.find(item => item.date === date);
  const filteredReviews = useMemo(() => (reviews.data ?? []).filter(item =>
    !search.trim() || item.keyword.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
  [reviews.data, search]);
  const reviewByDate = useMemo(() => new Map(filteredReviews.map(item => [item.date, item])), [filteredReviews]);
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
      const count = await copy.mutateAsync({ data: { sourcePersonId: person.id, sourceDate: date, targetPersonId, targetDate } });
      success();
      setNotice(`${count} meal portions added. Existing meals and destination settings were kept.`);
    } catch (problem) { setError(problem); warn(); }
  }

  return <Screen title="Meal history">
    <Eyebrow>Meal history · {person.name}</Eyebrow>
    <Title sub="Review the meals you tried, find the combinations that worked, and reuse them on another day.">Your meal combinations.</Title>
    <Field label="Find by keyword" value={search} onChangeText={setSearch} placeholder="e.g. match day, quick breakfast" testID="input-meal-history-search" />
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
      <Muted>Adds portions to the destination. Existing meals, reminders, goals, and tennis schedule stay unchanged; the rating and note remain on the source date.</Muted>
      <Chips testPrefix="select-meal-reuse-person" value={String(targetPersonId)} onChange={value => setTargetPersonId(Number(value))}
        options={(people.data ?? []).map(item => ({ value: String(item.id), label: item.name }))} />
      <Field label="Destination date (YYYY-MM-DD)" value={targetDate} onChangeText={setTargetDate} maxLength={10} keyboardType="numbers-and-punctuation" testID="input-meal-reuse-date" />
      <Btn label="Add meals to destination" icon="copy" loading={copy.isPending} disabled={!entries.data?.length} testID="button-reuse-meal-combination" onPress={() => void reuse()} />
      {notice ? <Muted>{notice}</Muted> : null}
      {error ? <ErrorBox error={error} /> : null}
    </Card>
    <Card>
      <Eyebrow>Saved meal history</Eyebrow>
      {filteredReviews.length ? filteredReviews.map(item => <Pressable key={`${item.personId}:${item.date}`} onPress={() => { setDate(item.date); setMonth(item.date.slice(0, 7)); }}
        style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 9, gap: 3 }}>
        <Text style={{ fontFamily: F.bold, color: c.foreground }}>{item.date} · {item.rating}/10</Text>
        <Muted>{item.keyword}{item.note ? ` · ${item.note}` : ''}</Muted>
      </Pressable>) : <Muted>No rated meal combinations match this keyword yet.</Muted>}
    </Card>
  </Screen>;
}
