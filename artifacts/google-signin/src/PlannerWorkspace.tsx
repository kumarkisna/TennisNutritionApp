import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { SportsReferencePanel } from './SportsReferencePanel';
import { Activity, ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, CirclePlus, ExternalLink, LayoutDashboard, LogOut, Pencil, Plus, Search, Settings2, Trash2, Users, X } from 'lucide-react';
import {
  useListFoods, getListFoodsQueryKey, useCreateFood, useUpdateFood, useDeleteFood,
  useDiscoverFoods, getDiscoverFoodsQueryKey, useImportFood,
  useListMealEntries, getListMealEntriesQueryKey, useCreateMealEntry, useUpdateMealEntry, useDeleteMealEntry,
  useListPeople, getListPeopleQueryKey, useCreatePerson, useUpdatePerson, useDeletePerson,
  useGetDailySummary, getGetDailySummaryQueryKey,
  type Food, type FoodCategory, type FoodInput, type Meal, type MealEntry, type ActivityLevel, type Nutrition,
  type DiscoveredFood, type Person, type PersonInput,
} from '@workspace/api-client-react';

const categories: FoodCategory[] = ['grains', 'protein', 'vegetables', 'fruit', 'dairy', 'other'];
const meals: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const activityOptions: { value: ActivityLevel; title: string; description: string; multiplier: number }[] = [
  { value: 'sedentary', title: 'Mostly seated', description: 'Desk-based days, little planned movement', multiplier: 1 },
  { value: 'light', title: 'Lightly active', description: 'Gentle activity a few days a week', multiplier: 1.1 },
  { value: 'moderate', title: 'Moderately active', description: 'Regular movement through the week', multiplier: 1.2 },
  { value: 'very_active', title: 'Very active', description: 'Frequent, demanding activity', multiplier: 1.35 },
];
const today = () => formatLocalDate(new Date());
function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateFromLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function shiftDate(value: string, days: number) {
  const date = dateFromLocal(value);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}
function dateLabel(value: string) {
  return dateFromLocal(value).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
const n = (value: number, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ');
function errorMessage(error: unknown) {
  if (!error) return 'Something went wrong. Please try again.';
  const e = error as { status?: number; message?: string; response?: { status?: number }; data?: { error?: string; message?: string } };
  if (e.status === 401 || e.response?.status === 401 || /unauthorized|401/i.test(e.message || '')) return 'Your session could not be verified. Sign in again to continue.';
  return e.data?.error || e.data?.message || e.message || 'Something went wrong. Please try again.';
}
function isRateLimited(error: unknown) {
  const e = error as { status?: number; response?: { status?: number }; message?: string } | null;
  return e?.status === 429 || e?.response?.status === 429 || /429|rate limit|too many requests/i.test(e?.message || '');
}
function useRefresh() {
  const client = useQueryClient();
  return {
    entries: () => {
      client.invalidateQueries({ queryKey: getListMealEntriesQueryKey().slice(0, 1) });
      client.invalidateQueries({ queryKey: getGetDailySummaryQueryKey().slice(0, 1) });
    },
    foods: () => {
      client.invalidateQueries({ queryKey: getListFoodsQueryKey().slice(0, 1) });
      client.invalidateQueries({ queryKey: getListMealEntriesQueryKey().slice(0, 1) });
      client.invalidateQueries({ queryKey: getGetDailySummaryQueryKey().slice(0, 1) });
    },
    people: () => {
      client.invalidateQueries({ queryKey: getListPeopleQueryKey() });
      client.invalidateQueries({ queryKey: getListMealEntriesQueryKey().slice(0, 1) });
      client.invalidateQueries({ queryKey: getGetDailySummaryQueryKey().slice(0, 1) });
    },
  };
}
function Alert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return <div role="alert" className="workspace-notice" data-testid="status-api-error">{errorMessage(error)} {onRetry && <button type="button" onClick={onRetry} className="ml-2 font-extrabold underline" data-testid="button-retry-request">Try again</button>}</div>;
}
function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-4" data-testid="status-content-loading">{Array.from({ length: rows }, (_, i) => <div key={i} className="workspace-skeleton h-20 w-full" />)}</div>;
}
function Empty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="workspace-empty" data-testid="status-empty"><div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-[#dcebe0] text-[#176d61]"><CirclePlus size={20} /></div><h3 className="text-lg font-extrabold tracking-[-.03em]">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#6d7a79]">{description}</p>{action && <div className="mt-6">{action}</div>}</div>;
}
function Header({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="workspace-topline"><div><p className="workspace-eyebrow">{eyebrow}</p><h1 className="workspace-title" data-testid="heading-workspace">{title}</h1><p className="workspace-subtitle">{description}</p></div>{action}</header>;
}
function SectionHeading({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="workspace-eyebrow">{kicker}</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em]">{title}</h2></div>{right}</div>;
}
function DatePicker({ date, setDate }: { date: string; setDate: (date: string) => void }) {
  return <div className="flex items-center gap-2" data-testid="control-plan-date">
    <button type="button" onClick={() => setDate(shiftDate(date, -1))} className="workspace-button ghost !h-10 !min-h-0 !w-10 !p-0" aria-label="Previous day" data-testid="button-previous-day"><ChevronLeft size={18} /></button>
    <label className="flex items-center gap-2 rounded-full border border-[#d9d2c5] bg-[#fbfaf6] px-4 py-2.5 text-xs font-bold"><CalendarDays size={15} className="text-[#176d61]" /><input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="w-[112px] bg-transparent outline-none" aria-label="Plan date" data-testid="input-plan-date" /></label>
    <button type="button" onClick={() => setDate(shiftDate(date, 1))} className="workspace-button ghost !h-10 !min-h-0 !w-10 !p-0" aria-label="Next day" data-testid="button-next-day"><ChevronRight size={18} /></button>
  </div>;
}
function MacroLine({ label, value, unit = 'g' }: { label: string; value: number; unit?: string }) {
  return <div className="workspace-macro"><span className="workspace-muted">{label}</span><strong className="font-extrabold" data-testid={`value-${label.toLowerCase()}`}>{n(value, 1)} {unit}</strong></div>;
}
function NutritionStrip({ nutrition }: { nutrition: Nutrition }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(['protein', 'carbs', 'fat', 'fiber'] as const).map(key => <div key={key} className="rounded-xl bg-[#f1ede4] px-4 py-3"><span className="block text-[10px] font-bold uppercase tracking-[.12em] text-[#778680]">{key}</span><strong className="mt-1 block text-lg tracking-[-.04em]" data-testid={`value-${key}`}>{n(nutrition[key], 1)}<small className="ml-1 text-xs font-medium">g</small></strong></div>)}</div>;
}
function FiberNote() {
  return <p className="mt-4 text-xs leading-5 text-[#778680]" data-testid="text-fiber-total-note">Fiber totals include reported values only. Foods without reported fiber may make the actual total higher.</p>;
}

type PersonSelection = { person: Person; people: Person[]; selectPerson: (id: number) => void };
const PersonContext = createContext<PersonSelection | null>(null);
function usePersonSelection() {
  const selection = useContext(PersonContext);
  if (!selection) throw new Error('A person must be selected to view a plan.');
  return selection;
}

function ManagePeople({ people, selectedId, selectPerson, close }: { people: Person[]; selectedId: number; selectPerson: (id: number) => void; close: () => void }) {
  const [editing, setEditing] = useState<Person | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<ActivityLevel>('moderate');
  const [baseline, setBaseline] = useState('1800');
  const [confirming, setConfirming] = useState<Person | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const remove = useDeletePerson();
  const refresh = useRefresh();
  function edit(person?: Person) {
    setEditing(person || null); setName(person?.name || ''); setLevel(person?.activityLevel || 'moderate');
    setBaseline(String(person?.baselineCalories || 1800)); setConfirming(null); setError(null); setShowForm(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleaned = name.trim();
    const calories = Number(baseline);
    if (!cleaned || cleaned.length > 80 || !Number.isInteger(calories) || calories < 1000 || calories > 5000) {
      setError(new Error('Enter a name (up to 80 characters) and a baseline from 1,000 to 5,000 kcal.')); return;
    }
    setError(null);
    const data: PersonInput = { name: cleaned, activityLevel: level, baselineCalories: calories };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data });
      else { const created = await create.mutateAsync({ data }); selectPerson(created.id); }
      refresh.people(); setShowForm(false);
    } catch (cause) { setError(cause); }
  }
  async function deletePerson() {
    if (!confirming || confirming.isDefault || !confirmed) return;
    setError(null);
    try {
      await remove.mutateAsync({ id: confirming.id });
      if (selectedId === confirming.id) selectPerson(people.find(person => person.isDefault)!.id);
      refresh.people(); setConfirming(null); setConfirmed(false);
    } catch (cause) { setError(cause); }
  }
  return <div className="workspace-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="workspace-modal" role="dialog" aria-modal="true" aria-label="Manage people" data-testid="dialog-manage-people">
    <div className="flex items-start justify-between gap-4"><div><p className="workspace-eyebrow">One account / separate plans</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">People in your planner.</h2><p className="mt-2 text-sm leading-6 text-[#6d7a79]">Everyone has their own meals and activity-based target. Your food library stays shared.</p></div><button type="button" onClick={close} aria-label="Close people manager" data-testid="button-close-people"><X size={21} /></button></div>
    <div className="mt-7 space-y-2">{people.map(person => <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0d9ce] bg-[#f7f4ed] px-4 py-3" data-testid={`row-person-${person.id}`}><div><strong className="text-sm">{person.name}</strong><p className="mt-1 text-xs text-[#778680]">{person.isDefault ? 'Default · ' : ''}{n(person.targetCalories)} kcal / day{selectedId === person.id ? ' · Selected' : ''}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => edit(person)} className="workspace-button ghost !min-h-9 !px-3" data-testid={`button-edit-person-${person.id}`}><Pencil size={13} /> Edit</button>{!person.isDefault && <button type="button" onClick={() => { setShowForm(false); setConfirming(person); setConfirmed(false); setError(null); }} className="workspace-button danger !min-h-9 !px-3" data-testid={`button-delete-person-${person.id}`}><Trash2 size={13} /> Delete</button>}</div></div>)}</div>
    {!showForm && !confirming && <button type="button" onClick={() => edit()} className="workspace-button mt-5" data-testid="button-add-person"><Plus size={15} /> Add person</button>}
    {showForm && <form onSubmit={submit} className="mt-6 rounded-2xl border border-[#d6e6dc] bg-[#e8f3ed] p-5" data-testid="form-person"><h3 className="mb-5 font-extrabold">{editing ? `Edit ${editing.name}` : 'Add a person'}</h3><label className="workspace-label" htmlFor="manage-person-name">Name</label><input id="manage-person-name" className="workspace-input !bg-[#fbfaf6]" value={name} onChange={event => setName(event.target.value)} maxLength={80} required data-testid="input-manage-person-name" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="workspace-label" htmlFor="manage-person-activity">Activity level</label><select id="manage-person-activity" className="workspace-input !bg-[#fbfaf6]" value={level} onChange={event => setLevel(event.target.value as ActivityLevel)} data-testid="select-manage-person-activity">{activityOptions.map(option => <option key={option.value} value={option.value}>{option.title}</option>)}</select></div><div><label className="workspace-label" htmlFor="manage-person-baseline">Baseline kcal / day</label><input id="manage-person-baseline" className="workspace-input !bg-[#fbfaf6]" type="number" min="1000" max="5000" step="1" required value={baseline} onChange={event => setBaseline(event.target.value)} data-testid="input-manage-person-baseline" /></div></div>{error !== null && <div className="mt-4"><Alert error={error} /></div>}<div className="mt-5 flex flex-wrap gap-2"><button type="submit" className="workspace-button" disabled={create.isPending || update.isPending} data-testid="button-save-person">{create.isPending || update.isPending ? 'Saving…' : editing ? 'Save person' : 'Create person'}</button><button type="button" onClick={() => { setShowForm(false); setError(null); }} className="workspace-button ghost" data-testid="button-cancel-person">Cancel</button></div></form>}
    {confirming && <div className="mt-6 rounded-2xl border border-[#efc8bf] bg-[#fff0eb] p-5" role="alert" data-testid="panel-confirm-delete-person"><h3 className="text-lg font-extrabold text-[#943d33]">Delete {confirming.name} and ALL their planned meals?</h3><p className="mt-2 text-sm leading-6 text-[#743e39]">This permanently deletes this person and every meal entry in their plan, across all dates. It cannot be undone. Your shared foods and other people's plans remain.</p><label className="mt-5 flex items-start gap-3 text-sm font-bold text-[#743e39]"><input type="checkbox" className="mt-1 accent-[#a6473a]" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} data-testid="checkbox-confirm-delete-person" />I understand all of {confirming.name}'s planned meals will be deleted.</label>{error !== null && <div className="mt-4"><Alert error={error} /></div>}<div className="mt-5 flex flex-wrap gap-2"><button type="button" className="workspace-button danger" disabled={!confirmed || remove.isPending} onClick={deletePerson} data-testid="button-confirm-delete-person">{remove.isPending ? 'Deleting…' : 'Delete person and meals'}</button><button type="button" className="workspace-button ghost" onClick={() => { setConfirming(null); setConfirmed(false); setError(null); }} data-testid="button-cancel-delete-person">Keep person</button></div></div>}
  </div></div>;
}

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const peopleQuery = useListPeople();
  const storageKey = `clear-access-person:${user?.id || 'unknown'}`;
  const [storedId, setStoredId] = useState<number | null>(() => {
    const value = window.localStorage.getItem(`clear-access-person:${user?.id || 'unknown'}`);
    return value ? Number(value) : null;
  });
  useEffect(() => {
    if (!user?.id) return;
    const value = window.localStorage.getItem(`clear-access-person:${user.id}`);
    setStoredId(value && Number.isInteger(Number(value)) ? Number(value) : null);
  }, [user?.id]);
  const [managing, setManaging] = useState(false);
  const people = peopleQuery.data || [];
  const person = people.find(item => item.id === storedId) || people.find(item => item.isDefault) || people[0];
  function selectPerson(id: number) {
    setStoredId(id);
    window.localStorage.setItem(storageKey, String(id));
  }
  const links = [
    { href: '/user-portal', title: 'Overview', icon: LayoutDashboard },
    { href: '/planner', title: 'Day planner', icon: CalendarDays },
    { href: '/foods', title: 'Food library', icon: BookOpen },
    { href: '/settings', title: 'Preferences', icon: Settings2 },
  ];
  return <div className="workspace grain" data-testid="workspace-shell"><div className="workspace-shell">
    <aside className="workspace-sidebar">
      <Link href="/user-portal" className="flex items-center gap-3 px-2" data-testid="link-workspace-brand"><img src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/logo.svg`} alt="" className="h-9 w-9 rounded-xl" /><span className="brand-name">Clear Access</span></Link>
      <div className="workspace-nav" aria-label="Workspace navigation">{links.map(({ href, title, icon: Icon }) => <Link key={href} href={href} className={location === href ? 'active' : ''} data-testid={`link-nav-${href.slice(1)}`}><Icon size={17} strokeWidth={2} />{title}</Link>)}</div>
      <div className="workspace-sidebar-bottom"><p className="workspace-eyebrow !text-[#83bda9]">Your private space</p><p className="mt-3 truncate text-xs text-[#c5d8d2]" data-testid="text-account-email">{user?.primaryEmailAddress?.emailAddress}</p><button type="button" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })} className="mt-5 flex items-center gap-2 text-xs font-bold text-[#c5d8d2] hover:text-[#fbfaf6]" data-testid="button-sign-out"><LogOut size={15} />Sign out</button></div>
    </aside>
      <div className="workspace-main"><div className="mb-7 flex items-center justify-between gap-3"><span className="workspace-eyebrow">A little more clarity, every day.</span><span className="hidden text-xs font-semibold text-[#82908b] sm:block">Signed in as {user?.firstName || 'member'}</span><button type="button" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })} className="text-xs font-bold text-[#176d61] md:hidden" data-testid="button-mobile-sign-out">Sign out</button></div>
      {peopleQuery.isLoading && <Loading rows={2} />}
      {peopleQuery.isError && <Alert error={peopleQuery.error} onRetry={() => peopleQuery.refetch()} />}
      {!peopleQuery.isLoading && !peopleQuery.isError && !person && <Empty title="No people in this account yet." description="Your default profile should appear automatically. Retry loading to continue." action={<button type="button" className="workspace-button" onClick={() => peopleQuery.refetch()} data-testid="button-retry-people">Retry</button>} />}
      {person && !peopleQuery.isError && <PersonContext.Provider value={{ person, people, selectPerson }}><div className="workspace-person-bar"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d5eee2] text-[#176d61]"><Users size={19} /></span><div><p className="workspace-eyebrow">Planning for</p><p className="text-xs text-[#6d7a79]" data-testid="text-selected-person-target">{n(person.targetCalories)} kcal daily target · separate meal plan</p></div></div><div className="flex flex-wrap items-center gap-2"><label htmlFor="workspace-person-select" className="sr-only">Select person</label><select id="workspace-person-select" className="workspace-input !min-h-10 !w-auto min-w-32 !bg-[#fbfaf6] font-extrabold" value={person.id} onChange={event => selectPerson(Number(event.target.value))} data-testid="select-workspace-person">{people.map(item => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' (default)' : ''}</option>)}</select><button type="button" className="workspace-button ghost !min-h-10" onClick={() => setManaging(true)} data-testid="button-manage-people">Manage people</button></div></div><div key={person.id}>{children}</div>{managing && <ManagePeople people={people} selectedId={person.id} selectPerson={selectPerson} close={() => setManaging(false)} />}</PersonContext.Provider>}
      <footer className="mt-20 border-t border-[#ded8cc] pt-6 text-xs leading-6 text-[#82908b]">Nutrition values are approximate, including community-submitted products. Verify labels when accuracy matters. Planning targets are estimates, not personalized medical advice.</footer></div>
  </div></div>;
}

export function OverviewPage() {
  const { person } = usePersonSelection();
  const date = today();
  const summary = useGetDailySummary({ date, personId: person.id });
  const mealTotals = meals.map(meal => ({ meal, data: summary.data?.meals.find(item => item.meal === meal) }));
  return <main data-testid="page-user-portal"><Header eyebrow="01 / Daily overview" title={`A clear day ahead, ${person.name}.`} description={`${dateLabel(date)} · ${person.name}'s own meals and daily target.`} action={<Link href="/planner" className="workspace-button" data-testid="link-overview-plan-day">Plan this day <ArrowRight size={16} /></Link>} />
    <div className="workspace-section grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <section className="workspace-card workspace-card-pad relative overflow-hidden !bg-[#183542] text-[#fbfaf6]" data-testid="card-daily-energy">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-[#2c6970]/60" />
        <p className="workspace-eyebrow relative !text-[#91ceb7]">Today's energy / planned</p>
        {summary.isLoading ? <div className="workspace-skeleton mt-8 h-20 max-w-[280px]" /> : summary.isError ? <div className="mt-6"><Alert error={summary.error} onRetry={() => summary.refetch()} /></div> : <><div className="relative mt-6 flex items-end gap-3"><strong className="text-[clamp(58px,8vw,96px)] font-extrabold leading-none tracking-[-.075em]" data-testid="value-total-calories">{n(summary.data?.totals.calories || 0)}</strong><span className="pb-2 text-sm text-[#b4cec5]">kcal planned</span></div><div className="relative mt-8 h-2 overflow-hidden rounded-full bg-[#45606a]"><div className="h-full rounded-full bg-[#8acdb4]" style={{ width: `${Math.min(100, Math.max(0, ((summary.data?.totals.calories || 0) / (summary.data?.targetCalories || 1)) * 100))}%` }} /></div><div className="relative mt-4 flex justify-between text-xs text-[#b4cec5]"><span>{summary.data?.entryCount || 0} portions planned</span><span data-testid="value-overview-target">Target ~{n(person.targetCalories)} kcal</span></div></>}
      </section>
      <section className="workspace-card workspace-card-pad" data-testid="card-target-context"><p className="workspace-eyebrow">{person.name}'s planning target</p><p className="mt-6 text-4xl font-extrabold tracking-[-.06em]" data-testid="value-target-calories">{n(person.targetCalories)} <span className="text-sm font-medium tracking-normal text-[#6d7a79]">kcal / day</span></p><p className="mt-4 text-sm leading-6 text-[#6d7a79]">{cap(person.activityLevel)} activity · {n(person.baselineCalories)} baseline × {person.activityMultiplier}</p><Link href="/settings" className="mt-9 inline-flex items-center gap-2 text-xs font-extrabold text-[#176d61] hover:underline" data-testid="link-overview-settings">Adjust target <ArrowRight size={14} /></Link></section>
    </div>
    <section className="workspace-section"><SectionHeading kicker="Day at a glance" title="The four moments" right={<Link href="/planner" className="text-xs font-extrabold text-[#176d61] hover:underline" data-testid="link-overview-view-planner">Open planner →</Link>} />{summary.isLoading ? <Loading rows={2} /> : summary.isError ? <Alert error={summary.error} onRetry={() => summary.refetch()} /> : <div className="grid gap-3 sm:grid-cols-2">{mealTotals.map(({ meal, data }, i) => <Link href="/planner" key={meal} className="workspace-card group flex items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-0.5" data-testid={`link-overview-meal-${meal}`}><div className="flex items-center gap-4"><span className="mono-face text-[10px] text-[#176d61]">0{i + 1}</span><div><h3 className="font-extrabold">{cap(meal)}</h3><p className="mt-1 text-xs text-[#778680]">{data?.count || 0} {data?.count === 1 ? 'portion' : 'portions'}</p></div></div><div className="flex items-center gap-3"><strong className="text-lg tracking-[-.04em]">{n(data?.nutrition.calories || 0)} <small className="text-xs font-medium text-[#84918d]">kcal</small></strong><ChevronRight size={16} className="text-[#9aa9a2]" /></div></Link>)}</div>}</section>
    <section className="workspace-section grid gap-5 lg:grid-cols-[1fr_.7fr]"><div className="workspace-card workspace-card-pad"><SectionHeading kicker="Nutrition / total" title="More than a number" />{summary.isLoading ? <Loading rows={1} /> : summary.data ? <><NutritionStrip nutrition={summary.data.totals} /><FiberNote /></> : null}</div><div className="workspace-card workspace-card-pad !bg-[#e8f3ed]"><p className="workspace-eyebrow">The food library</p><h3 className="mt-4 text-xl font-extrabold tracking-[-.04em]">Know what goes in.</h3><p className="mt-2 text-sm leading-6 text-[#5d6d71]">Browse your catalog, add your own foods, or search live products from Open Food Facts.</p><Link href="/foods" className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold text-[#176d61]" data-testid="link-overview-foods">Explore foods <ArrowRight size={15} /></Link></div></section>
  </main>;
}

function PortionDialog({ date, personId, meal, entry, close }: { date: string; personId: number; meal: Meal; entry?: MealEntry; close: () => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Food | null>(entry?.food || null);
  const [grams, setGrams] = useState(String(entry?.grams || 100));
  const [chosenMeal, setChosenMeal] = useState<Meal>(entry?.meal || meal);
  const [error, setError] = useState<any>(null);
  const foods = useListFoods({ search });
  const create = useCreateMealEntry();
  const update = useUpdateMealEntry();
  const refresh = useRefresh();
  const amount = Number(grams);
  const scaled = selected && amount > 0 ? { calories: selected.caloriesPer100g * amount / 100, protein: selected.proteinPer100g * amount / 100, carbs: selected.carbsPer100g * amount / 100, fat: selected.fatPer100g * amount / 100, fiber: selected.fiberPer100g * amount / 100 } : null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(amount) || amount < 1 || amount > 3000 || (!selected && !entry)) { setError(new Error('Choose a food and enter a portion between 1 and 3,000 grams.')); return; }
    setError(null);
    try {
      if (entry) await update.mutateAsync({ id: entry.id, data: { meal: chosenMeal, grams: amount } });
      else await create.mutateAsync({ data: { date, personId, meal: chosenMeal, foodId: selected!.id, grams: amount } });
      refresh.entries(); close();
    } catch (cause) { setError(cause); }
  }
  return <div className="workspace-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="workspace-modal" role="dialog" aria-modal="true" aria-label={entry ? 'Edit portion' : 'Add food portion'} data-testid="dialog-portion">
    <div className="flex items-start justify-between gap-5"><div><p className="workspace-eyebrow">{entry ? 'Adjust portion' : 'New portion'} / {dateLabel(date)}</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">{entry ? 'Make an adjustment.' : 'Add to your day.'}</h2></div><button type="button" onClick={close} aria-label="Close" data-testid="button-close-portion"><X size={21} /></button></div>
    <form onSubmit={submit} className="mt-8 space-y-5">
       {!entry ? <div><label className="workspace-label" htmlFor="food-search">Find a food in your catalog</label><div className="relative"><Search size={16} className="absolute left-4 top-[15px] text-[#7f9088]" /><input id="food-search" autoFocus className="workspace-input !pl-11" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search saved and reference foods" data-testid="input-portion-food-search" /></div><div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-[#e0d9ce]">{foods.isLoading ? <div className="p-3"><Loading rows={1} /></div> : foods.isError ? <Alert error={foods.error} onRetry={() => foods.refetch()} /> : foods.data?.length ? foods.data.map(food => <button type="button" key={food.id} onClick={() => setSelected(food)} className={`flex w-full items-center justify-between border-b border-[#eee9df] px-4 py-3 text-left text-sm hover:bg-[#e8f3ed] ${selected?.id === food.id ? 'bg-[#e8f3ed] font-extrabold text-[#176d61]' : ''}`} data-testid={`button-select-food-${food.id}`}><span>{food.name}<small className="ml-2 text-[#82918a]">{food.source === 'open_food_facts' ? 'Imported' : cap(food.category)}</small></span><span>{n(food.caloriesPer100g)} kcal</span></button>) : <p className="p-4 text-sm text-[#6d7a79]">No matching foods in your catalog.</p>}</div><p className="mt-3 text-xs leading-5 text-[#6d7a79]">Need a product that isn't here? <Link href="/foods" className="font-extrabold text-[#176d61] underline underline-offset-2" data-testid="link-portion-discover-foods">Search live foods and import it to your catalog</Link>, then return to your day.</p></div> : <div className="rounded-xl bg-[#e8f3ed] p-4"><p className="workspace-label !mb-1">Food</p><strong>{entry.food.name}</strong><span className="ml-2 text-xs text-[#6d7a79]">Food cannot be changed on an existing entry.</span></div>}
      <div className="grid grid-cols-2 gap-4"><div><label htmlFor="portion-meal" className="workspace-label">Meal</label><select id="portion-meal" className="workspace-input" value={chosenMeal} onChange={e => setChosenMeal(e.target.value as Meal)} data-testid="select-portion-meal">{meals.map(value => <option key={value} value={value}>{cap(value)}</option>)}</select></div><div><label htmlFor="portion-grams" className="workspace-label">Portion in grams</label><input id="portion-grams" type="number" min="1" max="3000" step="0.1" required className="workspace-input" value={grams} onChange={e => setGrams(e.target.value)} data-testid="input-portion-grams" /></div></div>
       {scaled && <div className="rounded-xl bg-[#f1ede4] p-4" data-testid="preview-portion-nutrition"><p className="workspace-eyebrow">For {n(amount, 1)}g · approximate</p><p className="mt-3 text-xl font-extrabold">{n(scaled.calories)} kcal</p><p className="mt-1 text-xs text-[#6d7a79]">Protein {n(scaled.protein, 1)}g · Carbs {n(scaled.carbs, 1)}g · Fat {n(scaled.fat, 1)}g · Fiber {selected?.fiberKnown ? `${n(scaled.fiber, 1)}g` : 'not reported'}</p></div>}
      {error && <Alert error={error} />}<div className="flex justify-end gap-2 pt-2"><button type="button" className="workspace-button ghost" onClick={close} data-testid="button-cancel-portion">Cancel</button><button type="submit" disabled={create.isPending || update.isPending || (!entry && !selected)} className="workspace-button" data-testid="button-save-portion">{create.isPending || update.isPending ? 'Saving…' : entry ? 'Save changes' : 'Add portion'}</button></div>
    </form>
  </div></div>;
}

export function PlannerPage() {
  const { person } = usePersonSelection();
  const [date, setDate] = useState(today);
  const [dialog, setDialog] = useState<{ meal: Meal; entry?: MealEntry } | null>(null);
  const [error, setError] = useState<any>(null);
  const entries = useListMealEntries({ date, personId: person.id });
  const summary = useGetDailySummary({ date, personId: person.id });
  const remove = useDeleteMealEntry();
  const refresh = useRefresh();
  async function deleteEntry(entry: MealEntry) {
    if (!window.confirm(`Remove ${entry.food.name} from ${cap(entry.meal)}?`)) return;
    setError(null);
    try { await remove.mutateAsync({ id: entry.id }); refresh.entries(); } catch (cause) { setError(cause); }
  }
  return <main data-testid="page-planner"><Header eyebrow="02 / Day planner" title={`${person.name}'s day, in focus.`} description="Pick a day, build their meals, and adjust portions whenever you need." action={<DatePicker date={date} setDate={setDate} />} />
    <SportsReferencePanel key={`${person.id}:${date}`} person={person} date={date} totals={summary.data?.totals} summaryLoading={summary.isLoading} summaryError={summary.isError} />
    <div className="workspace-section grid gap-5 lg:grid-cols-[1fr_290px]">
      <div><div className="mb-6 flex items-center justify-between gap-4"><div><p className="workspace-eyebrow">Selected day</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.04em]" data-testid="text-selected-date">{dateLabel(date)}</h2></div>{date !== today() && <button type="button" onClick={() => setDate(today())} className="text-xs font-extrabold text-[#176d61] hover:underline" data-testid="button-jump-today">Back to today</button>}</div>
        {error && <div className="mb-5"><Alert error={error} /></div>}
        {entries.isLoading ? <Loading rows={4} /> : entries.isError ? <Alert error={entries.error} onRetry={() => entries.refetch()} /> : <div className="space-y-4">{meals.map((meal, index) => { const matching = entries.data?.filter(entry => entry.meal === meal) || []; return <section className="workspace-card overflow-hidden" key={meal} data-testid={`section-meal-${meal}`}><div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-7"><div className="flex items-center gap-4"><span className="mono-face text-[10px] text-[#176d61]">0{index + 1}</span><div><h3 className="text-lg font-extrabold tracking-[-.04em]">{cap(meal)}</h3><p className="text-xs text-[#82918a]">{matching.length ? `${matching.length} ${matching.length === 1 ? 'portion' : 'portions'}` : 'Nothing planned yet'}</p></div></div><button type="button" onClick={() => setDialog({ meal })} className="workspace-button ghost !min-h-9 !px-3" data-testid={`button-add-${meal}`}><Plus size={16} /><span className="hidden sm:inline">Add food</span></button></div>{matching.length > 0 && <div className="workspace-divider">{matching.map(entry => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee9df] px-5 py-4 last:border-0 sm:px-7" data-testid={`row-entry-${entry.id}`}><div><p className="text-sm font-extrabold">{entry.food.name}</p><p className="mt-1 text-xs text-[#82918a]">{n(entry.grams, 1)}g · P {n(entry.nutrition.protein, 1)}g · C {n(entry.nutrition.carbs, 1)}g · F {n(entry.nutrition.fat, 1)}g</p></div><div className="flex items-center gap-2"><strong className="mr-2 text-sm" data-testid={`value-entry-calories-${entry.id}`}>{n(entry.nutrition.calories)} kcal</strong><button type="button" aria-label={`Edit ${entry.food.name}`} onClick={() => setDialog({ meal, entry })} className="rounded-lg p-2 text-[#176d61] hover:bg-[#e8f3ed]" data-testid={`button-edit-entry-${entry.id}`}><Pencil size={15} /></button><button type="button" aria-label={`Remove ${entry.food.name}`} disabled={remove.isPending} onClick={() => deleteEntry(entry)} className="rounded-lg p-2 text-[#a6473a] hover:bg-[#fff0eb] disabled:opacity-40" data-testid={`button-delete-entry-${entry.id}`}><Trash2 size={15} /></button></div></div>)}</div>}</section>; })}</div>}</div>
       <aside><div className="workspace-card workspace-card-pad lg:sticky lg:top-8" data-testid="card-planner-summary"><p className="workspace-eyebrow">Day total</p>{summary.isLoading ? <div className="mt-6"><Loading rows={2} /></div> : summary.isError ? <div className="mt-6"><Alert error={summary.error} onRetry={() => summary.refetch()} /></div> : <><p className="mt-6 text-5xl font-extrabold tracking-[-.07em]" data-testid="value-planner-calories">{n(summary.data?.totals.calories || 0)}</p><p className="text-sm text-[#6d7a79]">of ~{n(summary.data?.targetCalories || 0)} kcal target</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e5e7db]"><div className="h-full rounded-full bg-[#176d61]" style={{ width: `${Math.min(100, ((summary.data?.totals.calories || 0) / (summary.data?.targetCalories || 1)) * 100)}%` }} /></div><div className="mt-7"><MacroLine label="Protein" value={summary.data?.totals.protein || 0} /><MacroLine label="Carbs" value={summary.data?.totals.carbs || 0} /><MacroLine label="Fat" value={summary.data?.totals.fat || 0} /><MacroLine label="Fiber" value={summary.data?.totals.fiber || 0} /></div><FiberNote /><p className="mt-5 text-xs leading-5 text-[#82918a]">{summary.data?.entryCount || 0} portions planned. This is a guide, not a limit.</p></>}</div></aside>
    </div>{dialog && <PortionDialog date={date} personId={person.id} meal={dialog.meal} entry={dialog.entry} close={() => setDialog(null)} />}
  </main>;
}

const blankFood: FoodInput = { name: '', category: 'other', caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, fiberPer100g: 0, calciumMgPer100g: null, ironMgPer100g: null };
const nutrientFields = [
  { key: 'caloriesPer100g', label: 'Calories', max: 1000, unit: 'kcal' },
  { key: 'proteinPer100g', label: 'Protein', max: 100, unit: 'g' },
  { key: 'carbsPer100g', label: 'Carbohydrates', max: 100, unit: 'g' },
  { key: 'fatPer100g', label: 'Fat', max: 100, unit: 'g' },
  { key: 'fiberPer100g', label: 'Fiber', max: 100, unit: 'g' },
] as const;
function FoodDialog({ food, close }: { food?: Food; close: () => void }) {
  const [value, setValue] = useState<FoodInput>(food ? { name: food.name, category: food.category, caloriesPer100g: food.caloriesPer100g, proteinPer100g: food.proteinPer100g, carbsPer100g: food.carbsPer100g, fatPer100g: food.fatPer100g, fiberPer100g: food.fiberPer100g, calciumMgPer100g: food.calciumMgPer100g, ironMgPer100g: food.ironMgPer100g } : blankFood);
  const [error, setError] = useState<any>(null);
  const create = useCreateFood();
  const update = useUpdateFood();
  const refresh = useRefresh();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.name.trim() ||
      nutrientFields.some(field => !Number.isFinite(value[field.key]) || value[field.key] < 0 || value[field.key] > field.max) ||
      (value.calciumMgPer100g != null && (!Number.isFinite(value.calciumMgPer100g) || value.calciumMgPer100g < 0 || value.calciumMgPer100g > 10000)) ||
      (value.ironMgPer100g != null && (!Number.isFinite(value.ironMgPer100g) || value.ironMgPer100g < 0 || value.ironMgPer100g > 1000))) {
      setError(new Error('Enter a name and valid per-100g values.')); return;
    }
    setError(null);
    try { if (food) await update.mutateAsync({ id: food.id, data: { ...value, name: value.name.trim() } }); else await create.mutateAsync({ data: { ...value, name: value.name.trim() } }); refresh.foods(); close(); } catch (cause) { setError(cause); }
  }
  return <div className="workspace-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="workspace-modal" role="dialog" aria-modal="true" aria-label={food ? 'Edit custom food' : 'Create custom food'} data-testid="dialog-custom-food"><div className="flex justify-between gap-3"><div><p className="workspace-eyebrow">Your food library</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">{food ? 'Edit your food.' : 'Add your own food.'}</h2><p className="mt-2 text-sm text-[#6d7a79]">Enter approximate values for 100 grams.</p></div><button type="button" onClick={close} aria-label="Close" data-testid="button-close-food"><X size={21} /></button></div>
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div><label htmlFor="food-name" className="workspace-label">Food name</label><input id="food-name" required maxLength={120} className="workspace-input" value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} placeholder="e.g. Homemade oat bowl" data-testid="input-food-name" /></div>
      <div><label htmlFor="food-category" className="workspace-label">Category</label><select id="food-category" className="workspace-input" value={value.category} onChange={e => setValue({ ...value, category: e.target.value as FoodCategory })} data-testid="select-food-category">{categories.map(category => <option key={category} value={category}>{cap(category)}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-4">{nutrientFields.map(field => <div key={field.key}><label htmlFor={field.key} className="workspace-label">{field.label} / 100g <span className="font-normal">({field.unit})</span></label><input id={field.key} className="workspace-input" type="number" min="0" max={field.max} step="0.1" required value={value[field.key]} onChange={e => setValue({ ...value, [field.key]: Number(e.target.value) })} data-testid={`input-food-${field.key}`} /></div>)}</div>
      <p className="text-xs leading-5 text-[#6d7a79]">Optional minerals from a verified label. Leave blank if unknown; zero means the label explicitly reports zero.</p>
      <div className="grid grid-cols-2 gap-4">
        {([
          { key: 'calciumMgPer100g', label: 'Calcium', max: 10000 },
          { key: 'ironMgPer100g', label: 'Iron', max: 1000 },
        ] as const).map(field => <div key={field.key}>
          <label htmlFor={field.key} className="workspace-label">{field.label} / 100g (mg)</label>
          <input id={field.key} className="workspace-input" type="number" min="0" max={field.max} step="0.1"
            value={value[field.key] ?? ''} onChange={event => setValue({ ...value, [field.key]: event.target.value === '' ? null : Number(event.target.value) })}
            data-testid={`input-food-${field.key}`} />
        </div>)}
      </div>
      {error && <Alert error={error} />}
      <div className="flex justify-end gap-2 pt-2"><button type="button" className="workspace-button ghost" onClick={close} data-testid="button-cancel-food">Cancel</button><button type="submit" className="workspace-button" disabled={create.isPending || update.isPending} data-testid="button-save-food">{create.isPending || update.isPending ? 'Saving…' : food ? 'Save food' : 'Create food'}</button></div>
    </form>
  </div></div>;
}

function LiveDiscovery({ catalog, onImported }: { catalog: Food[]; onImported: () => void }) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [validation, setValidation] = useState('');
  const [importError, setImportError] = useState<unknown>(null);
  const [importingCode, setImportingCode] = useState<string | null>(null);
  const [savedCodes, setSavedCodes] = useState<string[]>([]);
  const params = { search: submitted || '___' };
  const discovery = useDiscoverFoods(params, {
    query: {
      enabled: submitted.length >= 3,
      queryKey: getDiscoverFoodsQueryKey(params),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });
  const importer = useImportFood();
  const refresh = useRefresh();
  function searchProducts(event: FormEvent) {
    event.preventDefault();
    const query = input.trim();
    if (query.length < 3 || query.length > 80) {
      setValidation('Enter at least 3 and no more than 80 characters to search products.');
      return;
    }
    setValidation('');
    if (query === submitted) void discovery.refetch();
    else setSubmitted(query);
  }
  function isSaved(product: DiscoveredFood) {
    return savedCodes.includes(product.code) || catalog.some(food => food.source === 'open_food_facts' && food.sourceUrl?.includes(`/product/${product.code}`));
  }
  async function saveProduct(product: DiscoveredFood) {
    setImportError(null);
    setImportingCode(product.code);
    try {
      await importer.mutateAsync({ data: { code: product.code } });
      setSavedCodes(codes => codes.includes(product.code) ? codes : [...codes, product.code]);
      onImported();
      refresh.foods();
    } catch (cause) {
      setImportError(cause);
    } finally {
      setImportingCode(null);
    }
  }
  return <section className="workspace-section" aria-labelledby="discovery-title" data-testid="section-live-discovery">
    <div className="workspace-card overflow-hidden">
      <div className="border-b border-[#d6e6dc] bg-[#e8f3ed] px-5 py-7 sm:px-8 sm:py-8">
        <p className="workspace-eyebrow">Live discovery / Open Food Facts</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h2 id="discovery-title" className="text-2xl font-extrabold tracking-[-.05em] sm:text-3xl">Find a product beyond your catalog.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#526e69]">Search community-submitted products, then save the ones you want to plan with. Results are not in your catalog until you import them.</p></div><span className="mono-face rounded-full border border-[#b6d7c8] px-3 py-2 text-[10px] uppercase text-[#176d61]">Live source</span></div>
        <form onSubmit={searchProducts} className="mt-7 flex flex-col gap-2 sm:flex-row" role="search" data-testid="form-discover-foods">
          <label htmlFor="discovery-search" className="sr-only">Search Open Food Facts products</label>
          <div className="relative min-w-0 flex-1"><Search size={17} className="absolute left-4 top-3.5 text-[#71887f]" /><input id="discovery-search" className="workspace-input !bg-[#fbfaf6] !pl-11" value={input} onChange={event => { setInput(event.target.value); setValidation(''); }} maxLength={80} minLength={3} placeholder="Try a product or brand, e.g. oat milk" data-testid="input-discover-foods" /></div>
          <button type="submit" className="workspace-button" disabled={discovery.isFetching} data-testid="button-search-discovery">{discovery.isFetching ? 'Searching…' : 'Search products'} <ArrowRight size={16} /></button>
        </form>
        {validation && <p role="alert" className="mt-3 text-xs font-bold text-[#a6473a]" data-testid="status-discovery-validation">{validation}</p>}
         <p className="mt-3 text-xs leading-5 text-[#526e69]">Search terms are sent to Open Food Facts only when you press Search. Please use it thoughtfully; the public source limits requests.</p>
      </div>
      <div className="px-5 py-6 sm:px-8 sm:py-8" aria-live="polite">
        {!submitted ? <div className="flex items-start gap-4" data-testid="status-discovery-idle"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1ede4] text-[#176d61]"><Search size={18} /></div><div><h3 className="font-extrabold">A bigger shelf, on demand.</h3><p className="mt-1 text-sm leading-6 text-[#6d7a79]">Enter at least three characters and search to see products with per-100g nutrition.</p></div></div>
        : discovery.isFetching && !discovery.data ? <div data-testid="status-discovery-loading"><p className="mb-4 text-sm text-[#6d7a79]">Looking up “{submitted}” on Open Food Facts…</p><Loading rows={3} /></div>
        : discovery.isError ? <div className="workspace-notice" role="alert" data-testid="status-discovery-error"><strong>{isRateLimited(discovery.error) ? 'Search limit reached.' : 'Product search is unavailable.'}</strong><p className="mt-1">{isRateLimited(discovery.error) ? 'Open Food Facts limits searches per IP. Wait a minute before trying again.' : `${errorMessage(discovery.error)} Check your connection or try again later.`}</p><button type="button" className="mt-3 font-extrabold underline" onClick={() => discovery.refetch()} data-testid="button-retry-discovery">Try search again</button></div>
        : discovery.data?.length === 0 ? <Empty title="No products found for this search." description="Try a brand, a shorter product name, or a different spelling. Only products with usable nutrition are shown." />
        : <><div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><div><p className="workspace-eyebrow">Global results / per 100g</p><h3 className="mt-2 text-lg font-extrabold" data-testid="text-discovery-count">{discovery.data?.length || 0} products for “{submitted}”</h3></div>{discovery.isFetching && <span className="text-xs text-[#6d7a79]">Refreshing results…</span>}</div>
          <div className="grid gap-3">{discovery.data?.map(product => {
            const saved = isSaved(product);
            return <article key={product.code} className="discovery-result" data-testid={`card-discovered-food-${product.code}`}>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-extrabold leading-6" data-testid={`text-discovered-name-${product.code}`}>{product.name}</h4>{saved && <span className="rounded-full bg-[#e8f3ed] px-2 py-1 text-[10px] font-extrabold text-[#176d61]">In your catalog</span>}</div><p className="mt-1 text-xs text-[#6d7a79]">{product.brand ? `${product.brand} · ` : ''}Open Food Facts · code {product.code}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#486167]" data-testid={`values-discovered-food-${product.code}`}><span><strong className="text-[#183542]">{n(product.caloriesPer100g)}</strong> kcal</span><span>P <strong>{n(product.proteinPer100g, 1)}g</strong></span><span>C <strong>{n(product.carbsPer100g, 1)}g</strong></span><span>F <strong>{n(product.fatPer100g, 1)}g</strong></span><span>Fiber <strong>{product.fiberKnown ? `${n(product.fiberPer100g, 1)}g` : 'not reported'}</strong></span></div>
              </div><div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end"><button type="button" onClick={() => saveProduct(product)} disabled={saved || importer.isPending} className={saved ? 'workspace-button ghost' : 'workspace-button'} data-testid={`button-import-food-${product.code}`}>{importingCode === product.code ? 'Saving…' : saved ? 'Saved' : 'Import to catalog'}</button><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#176d61] underline underline-offset-2" data-testid={`link-discovered-source-${product.code}`}>View source <ExternalLink size={12} /></a></div>
            </article>;
          })}</div></>}
        {importError !== null && <div className="mt-5"><Alert error={importError} /></div>}
      </div>
    </div>
    <div className="mt-4 rounded-xl border border-[#d9d2c5] bg-[#f1ede4] px-5 py-4 text-xs leading-6 text-[#5d6d71]" data-testid="notice-discovery-source"><strong className="text-[#183542]">Check the label.</strong> Open Food Facts is community-submitted; nutrition may be missing or incorrect and products change. Verify packaging before relying on a value. Data from <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#176d61] underline underline-offset-2" data-testid="link-open-food-facts">Open Food Facts <ExternalLink size={11} className="inline" /></a>.</div>
  </section>;
}

export function FoodsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FoodCategory | 'all'>('all');
  const [dialog, setDialog] = useState<Food | 'new' | null>(null);
  const [error, setError] = useState<any>(null);
  const foods = useListFoods({ search });
  const remove = useDeleteFood();
  const refresh = useRefresh();
  const visible = foods.data?.filter(food => filter === 'all' || food.category === filter) || [];
  async function deleteFood(food: Food) {
    if (!window.confirm(`Delete ${food.name}? Foods already used in a meal plan cannot be deleted.`)) return;
    setError(null);
    try { await remove.mutateAsync({ id: food.id }); refresh.foods(); } catch (cause) { setError(cause); }
  }
   return <main data-testid="page-foods"><Header eyebrow="03 / Food library" title="Know your ingredients." description="Your own catalog, plus live product discovery when you need a wider choice." action={<button type="button" onClick={() => setDialog('new')} className="workspace-button" data-testid="button-create-food"><Plus size={16} /> Add custom food</button>} />
     <LiveDiscovery catalog={foods.data || []} onImported={() => { setSearch(''); setFilter('all'); }} />
     <section className="workspace-section"><div className="workspace-card workspace-card-pad"><p className="workspace-eyebrow mb-4">Your planning catalog</p><div className="flex flex-col gap-4 sm:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-4 top-3.5 text-[#81908b]" /><input className="workspace-input !pl-11" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search saved and reference foods…" aria-label="Search catalog foods" data-testid="input-search-foods" /></div><select className="workspace-input sm:!w-48" value={filter} onChange={e => setFilter(e.target.value as FoodCategory | 'all')} aria-label="Filter by category" data-testid="select-food-filter"><option value="all">All categories</option>{categories.map(category => <option key={category} value={category}>{cap(category)}</option>)}</select></div><p className="mt-4 text-xs text-[#82918a]">Approximate nutrition per 100g. Reference, imported and your own custom foods are shown separately below.</p></div></section>
     <section className="workspace-section"><SectionHeading kicker="Saved & reference / per 100g" title={foods.isLoading ? 'Finding foods' : `${visible.length} ${visible.length === 1 ? 'food' : 'foods'} in your view`} />{error && <div className="mb-5"><Alert error={error} /></div>}{foods.isLoading ? <Loading rows={5} /> : foods.isError ? <Alert error={foods.error} onRetry={() => foods.refetch()} /> : visible.length === 0 ? <Empty title="No foods in this view." description="Try a different catalog search or category, discover a product above, or add a food with your own values." action={<button type="button" className="workspace-button" onClick={() => setDialog('new')} data-testid="button-empty-create-food"><Plus size={15} /> Add custom food</button>} /> : <div className="workspace-card overflow-hidden"><div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Food & source</th><th>Category</th><th>Energy</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Fiber</th><th className="text-right">Actions</th></tr></thead><tbody>{visible.map(food => <tr key={food.id} data-testid={`row-food-${food.id}`}><td><div className="min-w-40"><strong className="block">{food.name}</strong>{food.brand && <span className="block text-[11px] text-[#6d7a79]">{food.brand}</span>}<span className={`mt-1 inline-block rounded-full px-2 py-1 text-[10px] font-bold ${food.source === 'custom' ? 'bg-[#e8f3ed] text-[#176d61]' : food.source === 'open_food_facts' ? 'bg-[#e1e9eb] text-[#315d65]' : 'bg-[#f1ede4] text-[#71807b]'}`} data-testid={`badge-food-source-${food.id}`}>{food.source === 'custom' ? 'Custom' : food.source === 'open_food_facts' ? 'Imported · Open Food Facts' : 'Reference'}</span>{food.source === 'open_food_facts' && food.sourceUrl && <a href={food.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11px] font-bold text-[#176d61] underline underline-offset-2" data-testid={`link-food-source-${food.id}`}>View source <ExternalLink size={10} className="inline" /></a>}</div></td><td className="text-[#6d7a79]">{cap(food.category)}</td><td className="font-extrabold whitespace-nowrap">{n(food.caloriesPer100g)} kcal</td><td>{n(food.proteinPer100g, 1)}g</td><td>{n(food.carbsPer100g, 1)}g</td><td>{n(food.fatPer100g, 1)}g</td><td data-testid={`value-food-fiber-${food.id}`}>{food.fiberKnown ? `${n(food.fiberPer100g, 1)}g` : '—'}</td><td><div className="flex justify-end gap-1">{food.source === 'custom' && <button type="button" onClick={() => setDialog(food)} aria-label={`Edit ${food.name}`} className="rounded-lg p-2 text-[#176d61] hover:bg-[#e8f3ed]" data-testid={`button-edit-food-${food.id}`}><Pencil size={15} /></button>}{food.source !== 'reference' && <button type="button" onClick={() => deleteFood(food)} disabled={remove.isPending} aria-label={`Delete ${food.name}`} className="rounded-lg p-2 text-[#a6473a] hover:bg-[#fff0eb] disabled:opacity-40" data-testid={`button-delete-food-${food.id}`}><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div></div>}<p className="mt-3 text-xs text-[#778680]">— means fiber was not reported, not zero. Imported foods can be removed unless already used in a meal plan.</p></section>
    <div className="mt-8 flex flex-wrap items-center gap-5 text-xs font-bold text-[#176d61]"><Link href="/planner" className="inline-flex items-center gap-2 hover:underline" data-testid="link-foods-planner"><ArrowLeft size={14} /> Back to planner</Link></div>{dialog && <FoodDialog food={dialog === 'new' ? undefined : dialog} close={() => setDialog(null)} />}
  </main>;
}

function BodyDetails({ person }: { person: Person }) {
  const [weight, setWeight] = useState(person.weightKg === null ? '' : String(person.weightKg));
  const [age, setAge] = useState(person.ageYears === null ? '' : String(person.ageYears));
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const update = useUpdatePerson();
  const refresh = useRefresh();
  useEffect(() => {
    setWeight(person.weightKg === null ? '' : String(person.weightKg));
    setAge(person.ageYears === null ? '' : String(person.ageYears));
    setSaved(false);
  }, [person.id, person.weightKg, person.ageYears]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const weightKg = weight.trim() === '' ? null : Number(weight);
    const ageYears = age.trim() === '' ? null : Number(age);
    if ((weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500)) ||
      (ageYears !== null && (!Number.isInteger(ageYears) || ageYears < 1 || ageYears > 120))) {
      setError(new Error('Use a weight from 1 to 500 kg and an age from 1 to 120 years, or leave either blank.'));
      return;
    }
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({ id: person.id, data: { weightKg, ageYears } });
      refresh.people();
      setSaved(true);
    } catch (cause) { setError(cause); }
  }
  return <div className="workspace-card workspace-card-pad">
    <SectionHeading kicker="Personal details / optional" title={`${person.name}'s body weight and age`} />
    <p className="text-sm leading-6 text-[#6d7a79]">Weight is used for the workbook’s grams-per-kilogram protein and carbohydrate ranges. Age selects its calcium range; it is not used to guess anyone’s iron needs.</p>
    <form onSubmit={submit} className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="workspace-label" htmlFor="profile-weight">Body weight (kg)</label>
          <input id="profile-weight" type="number" min="1" max="500" step="0.1" placeholder="Optional"
            className="workspace-input" value={weight} onChange={event => { setWeight(event.target.value); setSaved(false); }} data-testid="input-profile-weight" /></div>
        <div><label className="workspace-label" htmlFor="profile-age">Age (years)</label>
          <input id="profile-age" type="number" min="1" max="120" step="1" placeholder="Optional"
            className="workspace-input" value={age} onChange={event => { setAge(event.target.value); setSaved(false); }} data-testid="input-profile-age" /></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#6d7a79]">Clear either field and save to remove it. The workbook’s calcium table only covers ages 12 and older.</p>
      {error !== null && <div className="mt-4"><Alert error={error} /></div>}
      {saved && <p className="mt-4 text-sm font-bold text-[#176d61]" role="status" data-testid="status-body-details-saved">Body details saved for {person.name}.</p>}
      <button type="submit" className="workspace-button mt-5" disabled={update.isPending} data-testid="button-save-body-details">{update.isPending ? 'Saving…' : 'Save body details'}</button>
    </form>
  </div>;
}

function NutrientGoals({ person }: { person: Person }) {
  const [iron, setIron] = useState(person.ironGoalMg === null ? '' : String(person.ironGoalMg));
  const [fat, setFat] = useState(person.fatGoalG === null ? '' : String(person.fatGoalG));
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const update = useUpdatePerson();
  const refresh = useRefresh();
  useEffect(() => {
    setIron(person.ironGoalMg === null ? '' : String(person.ironGoalMg));
    setFat(person.fatGoalG === null ? '' : String(person.fatGoalG));
  }, [person.id, person.ironGoalMg, person.fatGoalG]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ironGoalMg = iron.trim() === '' ? null : Number(iron);
    const fatGoalG = fat.trim() === '' ? null : Number(fat);
    if ((ironGoalMg !== null && (!Number.isFinite(ironGoalMg) || ironGoalMg <= 0 || ironGoalMg > 100)) ||
        (fatGoalG !== null && (!Number.isFinite(fatGoalG) || fatGoalG <= 0 || fatGoalG > 500))) {
      setError(new Error('Enter a positive iron goal up to 100 mg/day and fat goal up to 500 g/day, or leave either blank.'));
      return;
    }
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({ id: person.id, data: { ironGoalMg, fatGoalG } });
      refresh.people();
      setSaved(true);
    } catch (cause) { setError(cause); }
  }

  return <div className="workspace-card workspace-card-pad" data-testid="section-nutrient-goals">
    <SectionHeading kicker="Personal goals / optional" title={`${person.name}'s iron and fat goals`} />
    <p className="text-sm leading-6 text-[#6d7a79]">Enter goals you already have from a qualified professional or a source you trust. We do not calculate these from age, sex, activity, or the workbook. The workbook’s iron cells are invalid dates, and its fat ranges require person groups we cannot safely assign.</p>
    <form onSubmit={submit} className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="workspace-label" htmlFor="goal-iron">Iron (mg / day)</label>
          <input id="goal-iron" type="number" min="0.01" max="100" step="any" placeholder="No goal set"
            className="workspace-input" value={iron} onChange={event => { setIron(event.target.value); setSaved(false); }} data-testid="input-goal-iron" /></div>
        <div><label className="workspace-label" htmlFor="goal-fat">Fat (g / day)</label>
          <input id="goal-fat" type="number" min="0.01" max="500" step="any" placeholder="No goal set"
            className="workspace-input" value={fat} onChange={event => { setFat(event.target.value); setSaved(false); }} data-testid="input-goal-fat" /></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#6d7a79]">Both fields are optional. Clear a field and save to remove its goal. These are your own reference values, not recommendations from this app.</p>
      <p className="mt-2 text-xs leading-5 font-semibold text-[#6d7a79]">For adolescents{person.ageYears !== null && person.ageYears < 19 ? `, including ${person.name}` : ''}, do not choose an iron or fat goal from adult ranges. Ask a qualified healthcare professional for age-appropriate guidance before entering one.</p>
      {error !== null && <div className="mt-4"><Alert error={error} /></div>}
      {saved && <p className="mt-4 text-sm font-bold text-[#176d61]" role="status" data-testid="status-nutrient-goals-saved">Goals saved for {person.name}. The daily comparison now uses these values.</p>}
      <button type="submit" className="workspace-button mt-5" disabled={update.isPending} data-testid="button-save-nutrient-goals">{update.isPending ? 'Saving…' : 'Save nutrient goals'}</button>
    </form>
  </div>;
}

export function SettingsPage() {
  const { person } = usePersonSelection();
  const prefs = useListPeople();
  const [level, setLevel] = useState<ActivityLevel>(person.activityLevel);
  const [baseline, setBaseline] = useState(String(person.baselineCalories));
  const [error, setError] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const save = useUpdatePerson();
  const refresh = useRefresh();
  useEffect(() => { setLevel(person.activityLevel); setBaseline(String(person.baselineCalories)); }, [person.id, person.activityLevel, person.baselineCalories]);
  const multiplier = activityOptions.find(option => option.value === level)?.multiplier || 1;
  const estimate = Number(baseline) * multiplier;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(baseline);
    if (!Number.isFinite(value) || value < 1000 || value > 5000) { setError(new Error('Baseline must be between 1,000 and 5,000 calories.')); return; }
    setError(null); setSaved(false);
    try { await save.mutateAsync({ id: person.id, data: { activityLevel: level, baselineCalories: value } }); refresh.people(); setSaved(true); } catch (cause) { setError(cause); }
  }
  return <main data-testid="page-settings"><Header eyebrow="04 / Preferences" title={`${person.name}'s starting point.`} description={`Set ${person.name}'s activity and baseline. Their target and meal plan stay separate from everyone else's.`} />
    <section className="workspace-section grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="workspace-card workspace-card-pad"><SectionHeading kicker="Personal planning" title="Your daily estimate" />{prefs.isLoading ? <Loading rows={4} /> : prefs.isError ? <Alert error={prefs.error} onRetry={() => prefs.refetch()} /> : <form onSubmit={submit} className="mt-7"><label htmlFor="baseline-calories" className="workspace-label">Baseline calories</label><p className="mb-3 text-xs leading-6 text-[#6d7a79]">This is your editable starting number before applying activity. It is not a medical recommendation.</p><div className="relative max-w-xs"><input id="baseline-calories" type="number" min="1000" max="5000" step="1" required className="workspace-input !pr-16" value={baseline} onChange={e => { setBaseline(e.target.value); setSaved(false); }} data-testid="input-baseline-calories" /><span className="absolute right-4 top-3.5 text-xs text-[#82918a]">kcal</span></div><fieldset className="mt-9"><legend className="workspace-label">Activity level</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{activityOptions.map(option => <label key={option.value} className={`cursor-pointer rounded-2xl border p-5 transition-colors ${level === option.value ? 'border-[#176d61] bg-[#e8f3ed]' : 'border-[#e0d9ce] bg-[#f7f4ed] hover:border-[#91bea9]'}`} data-testid={`option-activity-${option.value}`}><input type="radio" className="sr-only" name="activity" value={option.value} checked={level === option.value} onChange={() => { setLevel(option.value); setSaved(false); }} data-testid={`input-activity-${option.value}`} /><span className="flex justify-between gap-3 text-sm font-extrabold"><span>{option.title}</span><span className="text-[#176d61]">×{option.multiplier}</span></span><span className="mt-2 block text-xs leading-5 text-[#6d7a79]">{option.description}</span></label>)}</div></fieldset>{error && <div className="mt-5"><Alert error={error} /></div>}{saved && <div className="mt-5 rounded-xl bg-[#e8f3ed] p-4 text-sm font-bold text-[#176d61]" role="status" data-testid="status-preferences-saved">Preferences saved. Your daily summaries have been updated.</div>}<button type="submit" disabled={save.isPending} className="workspace-button mt-8" data-testid="button-save-preferences">{save.isPending ? 'Saving preferences…' : 'Save preferences'} <ArrowRight size={16} /></button></form>}</div>
      <aside className="space-y-5"><div className="workspace-card workspace-card-pad !bg-[#183542] text-[#fbfaf6]" data-testid="card-target-preview"><Activity size={22} className="text-[#91ceb7]" /><p className="workspace-eyebrow mt-7 !text-[#91ceb7]">Estimated daily target</p><strong className="mt-3 block text-5xl font-extrabold tracking-[-.07em]" data-testid="value-estimated-target">{Number.isFinite(estimate) ? n(estimate) : '—'}</strong><span className="text-sm text-[#b4cec5]">kcal / day</span><div className="mt-7 border-t border-[#45606a] pt-5 text-xs leading-6 text-[#b4cec5]">{n(Number(baseline) || 0)} baseline × {multiplier} activity multiplier</div></div><div className="workspace-card workspace-card-pad"><p className="workspace-eyebrow">A note on targets</p><p className="mt-4 text-sm leading-7 text-[#5d6d71]">This number is a planning estimate, not a prescription. Food values are approximate too. Use it as a helpful reference and adjust it to fit your own context.</p><Link href="/planner" className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold text-[#176d61]" data-testid="link-settings-planner">Return to planner <ArrowRight size={14} /></Link></div></aside>
    </section>
    <section className="workspace-section"><BodyDetails key={person.id} person={person} /></section>
    <section className="workspace-section"><NutrientGoals key={person.id} person={person} /></section>
  </main>;
}