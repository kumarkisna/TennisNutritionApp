import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDeleteTennisDiet, useListMealEntries, useSaveHydrationLog, useSaveTennisDiet, type Person, type TennisDiet, type TennisPlan } from '@/lib/local-api';
import type { HydrationLog } from '@/lib/local-models';
import { MAX_HYDRATION_ENTRIES } from '@/lib/hydration';
import { dietPhaseLabels, isClockTime, tennisDietChoiceFromFuelWindow, timeMinutes, type TennisFuelWindow } from '@/lib/tennis-planning';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, LoadingBlock, Muted, success, tap, warn } from '@/components/ui';
import { n } from '@/lib/format';

const phaseOptions = (Object.keys(dietPhaseLabels) as TennisDiet['phase'][]).map(value => ({ value, label: dietPhaseLabels[value] }));
type Editor = { id?: string; phase: TennisDiet['phase']; time: string; suggestionTitle?: string };

export function TennisDietSchedule({ person, date, plan, suggestions, hydration, showDetails = true }: {
  person: Person; date: string; plan: TennisPlan; suggestions: TennisFuelWindow[]; hydration?: HydrationLog; showDetails?: boolean;
}) {
  const c = useColors();
  const router = useRouter();
  const entries = useListMealEntries({ personId: person.id, date });
  const save = useSaveTennisDiet();
  const saveHydration = useSaveHydrationLog();
  const del = useDeleteTennisDiet();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showTimingOptions, setShowTimingOptions] = useState(false);
  const [hydrationDietId, setHydrationDietId] = useState<string | null>(null);
  const [hydrationAmount, setHydrationAmount] = useState('');
  const busy = save.isPending || del.isPending || saveHydration.isPending;
  const diets = useMemo(() => [...(plan.diets ?? [])].sort((a, b) => timeMinutes(a.time) - timeMinutes(b.time) || a.id.localeCompare(b.id)), [plan.diets]);
  const timeline = useMemo(() => [
    ...diets.map(diet => ({ kind: 'food' as const, time: diet.time, diet })),
    ...(hydration?.entries ?? []).filter(entry => !entry.tennisDietId || !diets.some(diet => diet.id === entry.tennisDietId)).map(entry => ({ kind: 'hydration' as const, time: entry.time, entry })),
  ].sort((a, b) => timeMinutes(a.time) - timeMinutes(b.time)), [diets, hydration?.entries]);
  const timingOptions = useMemo(() => suggestions.flatMap((window, index) => {
    const choice = tennisDietChoiceFromFuelWindow(window);
    return choice ? [{ ...choice, window, index }] : [];
  }), [suggestions]);

  async function submit() {
    if (!editor) return;
    const time = editor.time.trim();
    if (!isClockTime(time)) { setProblem('Enter the time in 24-hour HH:MM format, for example 07:30.'); warn(); return; }
    if (!editor.id && diets.length >= 24) { setProblem('A day can have at most 24 food slots.'); warn(); return; }
    setProblem(null); setError(null);
    try {
      await save.mutateAsync({ data: { personId: person.id, date, ...(editor.id ? { id: editor.id } : {}), phase: editor.phase, time } });
      success(); setEditor(null); setShowTimingOptions(false);
    } catch (e) { warn(); setError(e); }
  }
  async function remove(id: string) {
    setError(null);
    try { await del.mutateAsync({ data: { personId: person.id, date, id } }); success(); setConfirmId(null); }
    catch (e) { warn(); setError(e); }
  }
  async function addHydration(diet: TennisDiet) {
    const amount = Number(hydrationAmount.trim());
    const entries = hydration?.entries ?? [];
    if (!Number.isInteger(amount) || amount < 1 || amount > 5000) { setProblem('Enter a planned drink amount from 1 to 5,000 mL.'); return; }
    if (entries.length >= MAX_HYDRATION_ENTRIES) { setProblem(`A day can have at most ${MAX_HYDRATION_ENTRIES} planned drinks.`); return; }
    setProblem(null); setError(null);
    try {
      await saveHydration.mutateAsync({ data: { personId: person.id, date, hydration: {
        entries: [...entries, {
          id: `hydration-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
          time: diet.time, plannedMl: amount, actualMl: null, alertEnabled: false, tennisDietId: diet.id,
        }],
        sessions: hydration?.sessions ?? [],
      } } });
      success(); setHydrationDietId(null); setHydrationAmount('');
    } catch (e) { warn(); setError(e); }
  }

  return <View testID="tennis-diet-schedule" style={{ gap: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }}>
    <Eyebrow>Your food & hydration timetable</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 17, letterSpacing: -0.4, color: c.foreground }}>When you will eat and drink</Text>
    {showDetails ? <Muted>Set your own times around play. Food portions are shared with Breakfast, Lunch, Dinner and Snack and count once in day totals. Planned hydration appears alongside them here and remains available on rest days.</Muted> : null}
    {entries.isLoading ? <LoadingBlock rows={1} height={70} /> : entries.isError ? <ErrorBox error={entries.error} onRetry={() => entries.refetch()} /> : <>
      {showDetails && timeline.length === 0 && !editor ? <View testID="tennis-diet-empty"><Muted>No food or hydration slots yet. Add food timing here and use the daily hydration plan for drinks.</Muted></View> : null}
      {timeline.map(item => {
        if (item.kind === 'hydration') return <View key={`hydration-${item.entry.id}`} testID={`tennis-hydration-${item.entry.id}`} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center', width: 58 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 18, letterSpacing: -0.5, color: c.primary }}>{item.time}</Text>
            <View style={{ flex: 1, width: 2, marginTop: 4, borderRadius: 1, backgroundColor: c.accentBorder }} />
          </View>
          <View style={{ flex: 1, backgroundColor: c.mint, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 12, gap: 5 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>Hydration · {item.entry.plannedMl} mL planned</Text>
            <Muted>{item.entry.actualMl === null ? 'Not recorded yet' : `${item.entry.actualMl} mL recorded`}{item.entry.alertEnabled && item.entry.actualMl === null ? ' · reminder on' : ''}</Muted>
            {showDetails ? <Muted>Edit the drink time and amount in the daily Hydration plan. It remains available on rest days too.</Muted> : null}
          </View>
        </View>;
        const d = item.diet;
        const list = (entries.data ?? []).filter(e => e.tennisDietId === d.id);
        const linkedHydration = (hydration?.entries ?? []).filter(entry => entry.tennisDietId === d.id);
        const tot = list.reduce((t, e) => ({ k: t.k + e.nutrition.calories, p: t.p + e.nutrition.protein, cb: t.cb + e.nutrition.carbs, f: t.f + e.nutrition.fat }), { k: 0, p: 0, cb: 0, f: 0 });
        return <View key={d.id} testID={`tennis-diet-${d.id}`} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center', width: 58 }}>
            <Text testID={`value-tennis-diet-time-${d.id}`} style={{ fontFamily: F.bold, fontSize: 18, letterSpacing: -0.5, color: c.primary }}>{d.time}</Text>
            <View style={{ flex: 1, width: 2, marginTop: 4, borderRadius: 1, backgroundColor: c.accentBorder }} />
          </View>
          <View style={{ flex: 1, backgroundColor: c.secondary, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 }}>
            <Text testID={`value-tennis-diet-phase-${d.id}`} style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>{dietPhaseLabels[d.phase]}</Text>
            {list.length === 0 ? <Muted>No food attached yet.</Muted> : list.map(e => <Pressable key={e.id} disabled={busy || editor !== null} testID={`button-edit-diet-food-${e.id}`} onPress={() => { tap(); router.push({ pathname: '/portion', params: { meal: e.meal, entryId: String(e.id) } }); }} style={{ gap: 1 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 14, color: c.foreground }}>{e.food.name}</Text>
              <Muted>{n(e.grams, 1)} g · {n(e.nutrition.calories)} kcal · {n(e.nutrition.protein, 1)} g protein · {n(e.nutrition.carbs, 1)} g carbs · {n(e.nutrition.fat, 1)} g fat · tap to edit</Muted>
            </Pressable>)}
            {list.length ? <Text testID={`value-tennis-diet-total-${d.id}`} style={{ fontFamily: F.bold, fontSize: 12, color: c.primary }}>Slot: {n(tot.k)} kcal · {n(tot.p, 1)} g protein · {n(tot.cb, 1)} g carbs · {n(tot.f, 1)} g fat</Text> : null}
            {linkedHydration.map(entry => <View key={entry.id} testID={`tennis-hydration-${entry.id}`} style={{ padding: 9, borderRadius: 12, backgroundColor: c.mint, gap: 3 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 14, color: c.foreground }}>Hydration · {entry.plannedMl} mL planned</Text>
              <Muted>{entry.actualMl === null ? 'Not recorded yet' : `${entry.actualMl} mL recorded`}{entry.alertEnabled && entry.actualMl === null ? ' · reminder on' : ''}</Muted>
            </View>)}
            {hydrationDietId === d.id ? <View testID={`tennis-hydration-editor-${d.id}`} style={{ gap: 8 }}>
              <Field label="Planned drink amount (mL)" value={hydrationAmount} onChangeText={setHydrationAmount} placeholder="e.g. 250" keyboardType="number-pad" testID={`input-tennis-hydration-${d.id}`} />
              <Muted>This drink will be linked to this slot at {d.time}. You can record its actual amount and set an alert in the daily Hydration plan.</Muted>
              {problem ? <Text style={{ color: c.destructive }}>{problem}</Text> : null}
              <Btn small icon="check" label="Save hydration" loading={saveHydration.isPending} disabled={busy} testID={`button-save-tennis-hydration-${d.id}`} onPress={() => void addHydration(d)} />
              <Btn small variant="ghost" label="Cancel" disabled={busy} testID={`button-cancel-tennis-hydration-${d.id}`} onPress={() => { setHydrationDietId(null); setHydrationAmount(''); setProblem(null); }} />
            </View> : null}
            {confirmId === d.id ? <Card tone="danger">
              <Text style={{ fontFamily: F.bold, color: c.destructive, fontSize: 14 }}>Delete this {dietPhaseLabels[d.phase]} slot at {d.time}? Attached foods are retained as ordinary unscheduled portions in their meals.</Text>
              <Btn variant="danger" icon="trash-2" label="Yes, delete slot" loading={del.isPending} disabled={busy} testID={`button-confirm-delete-diet-${d.id}`} onPress={() => void remove(d.id)} />
              <Btn variant="ghost" label="Keep it" disabled={busy} testID={`button-cancel-delete-diet-${d.id}`} onPress={() => setConfirmId(null)} />
            </Card> : <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Btn small icon="plus" label="Add food" disabled={busy || editor !== null} testID={`button-add-diet-food-${d.id}`} onPress={() => router.push({ pathname: '/portion', params: { tennisDietId: d.id, meal: 'snack' } })} />
              <Btn small variant="ghost" icon="droplet" label="Add hydration" disabled={busy || editor !== null || hydrationDietId !== null} testID={`button-add-diet-hydration-${d.id}`} onPress={() => { setProblem(null); setHydrationAmount(''); setHydrationDietId(d.id); }} />
               <Btn small variant="ghost" icon="clock" label="Edit" disabled={busy || editor !== null} testID={`button-edit-diet-${d.id}`} onPress={() => { setError(null); setProblem(null); setConfirmId(null); setShowTimingOptions(false); setEditor({ id: d.id, phase: d.phase, time: d.time }); }} />
              <Btn small variant="danger" icon="trash-2" label="Delete" disabled={busy || editor !== null} testID={`button-delete-diet-${d.id}`} onPress={() => { setError(null); setConfirmId(d.id); }} />
            </View>}
          </View>
        </View>;
      })}
    </>}
    {editor ? <Card tone="mint">
      <View testID="tennis-diet-editor" />
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>{editor.id ? 'Edit food slot' : 'New food slot'}</Text>
      <Chips testPrefix="tennis-diet-phase" value={editor.phase} onChange={v => setEditor(e => (e ? { ...e, phase: v, suggestionTitle: undefined } : e))} options={phaseOptions} disabled={busy} />
      {!editor.id && timingOptions.length > 0 ? <>
        <Btn small variant="ghost" icon="clock" label={showTimingOptions ? 'Hide proposed sections' : 'Choose a proposed section'} disabled={busy} testID="button-toggle-tennis-diet-suggestions" onPress={() => setShowTimingOptions(value => !value)} />
        {showTimingOptions ? <View testID="tennis-diet-suggestions" style={{ gap: 7 }}>
          <Muted>Select a section to fill its phase and suggested time. Time ranges use their start time. You can change the time below before saving.</Muted>
          {timingOptions.map(choice => <Pressable
            key={`${choice.window.title}-${choice.window.time}-${choice.index}`}
            accessibilityRole="button"
            accessibilityLabel={`Use ${choice.window.title} at ${choice.time}`}
            disabled={busy}
            testID={`button-use-tennis-diet-suggestion-${choice.index}`}
            onPress={() => {
              tap();
              setEditor(current => current ? { ...current, phase: choice.phase, time: choice.time, suggestionTitle: choice.window.title } : current);
              setShowTimingOptions(false);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, backgroundColor: c.secondary }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>{choice.window.title}</Text>
              <Muted>{choice.window.time === choice.time ? `Suggested time ${choice.time}` : `${choice.window.time} · use ${choice.time}`}</Muted>
            </View>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: c.primary }}>Use</Text>
          </Pressable>)}
        </View> : null}
      </> : null}
      {editor.suggestionTitle ? <Muted>Selected: {editor.suggestionTitle}. Adjust the time below if needed.</Muted> : null}
      <Field label="Time (24h HH:MM)" value={editor.time} onChangeText={v => setEditor(e => (e ? { ...e, time: v, suggestionTitle: undefined } : e))} placeholder="12:30" maxLength={5} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!busy} testID="input-tennis-diet-time" />
      {problem ? <ErrorBox error={new Error(problem)} /> : null}
      <Btn icon="check" label="Save slot" loading={save.isPending} disabled={busy} testID="button-save-tennis-diet" onPress={() => void submit()} />
      <Btn variant="ghost" label="Cancel" disabled={busy} testID="button-cancel-tennis-diet" onPress={() => { setEditor(null); setShowTimingOptions(false); setProblem(null); setError(null); }} />
    </Card> : <Btn variant="ghost" icon="plus" label={diets.length >= 24 ? 'Maximum 24 slots' : 'Add food slot'} disabled={busy || diets.length >= 24} testID="button-add-tennis-diet" onPress={() => { setError(null); setProblem(null); setConfirmId(null); setShowTimingOptions(false); setEditor({ phase: 'before', time: '12:00' }); }} />}
    {error ? <ErrorBox error={error} /> : null}
  </View>;
}
