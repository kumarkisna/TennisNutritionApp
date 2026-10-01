import type { Nutrition } from '@/lib/local-api';

export const pad = (v: number) => String(v).padStart(2, '0');
export function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => formatLocalDate(new Date());
export function dateFromLocal(v: string) {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function shiftDate(v: string, days: number) {
  const d = dateFromLocal(v);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}
export function dateLabel(v: string) {
  return dateFromLocal(v).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && formatLocalDate(dateFromLocal(v)) === v;
export const n = (v: number | null | undefined, digits = 0) =>
  Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
export const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace('_', ' ');
export function errorMessage(error: unknown) {
  const e = error as { status?: number; message?: string; data?: { error?: string; message?: string } } | null;
  if (!e) return 'Something went wrong. Please try again.';
  if (e.status === 401 || /unauthorized|401/i.test(e.message || '')) return 'This local data could not be accessed. Please retry.';
  return e.data?.error || e.data?.message || e.message || 'Something went wrong. Please try again.';
}
export function plannedValue(totals: Nutrition | undefined, key: keyof Nutrition, unit: string, digits = 1) {
  if (!totals) return 'Loading';
  const v = totals[key];
  return v === null ? 'Not fully reported' : `${n(v, digits)} ${unit}`;
}
/** '' -> null, invalid -> undefined */
export function parseOptional(s: string): number | null | undefined {
  const t = s.trim();
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}
