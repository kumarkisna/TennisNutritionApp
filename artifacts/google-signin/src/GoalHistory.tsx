import React from 'react';
import { getListGoalHistoryQueryKey, useListGoalHistory, type GoalHistory as GoalHistoryEntry } from '@workspace/api-client-react';

function amount(value: number | null, nutrient: GoalHistoryEntry['nutrient']) {
  return value === null ? 'Unset' : `${value} ${nutrient === 'iron' ? 'mg' : 'g'}/day`;
}

export function GoalHistoryEntries({ entries }: { entries: GoalHistoryEntry[] }) {
  if (!entries.length) return <p className="text-sm text-[#6d7a79]">No recorded goal changes yet.</p>;
  return <ol className="space-y-3">{entries.map(entry => <li key={entry.id}
    className="rounded-xl border border-[#e0d9ce] p-4" data-testid={`goal-history-entry-${entry.id}`}>
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <strong>{entry.nutrient === 'iron' ? 'Iron' : 'Fat'} · {entry.amount === null ? 'Goal cleared' : entry.previousAmount === null ? 'Goal set' : 'Goal updated'}</strong>
      <time dateTime={entry.changedAt} className="text-xs text-[#6d7a79]">{new Date(entry.changedAt).toLocaleString()}</time>
    </div>
    <p className="mt-2 text-sm">{amount(entry.previousAmount, entry.nutrient)} → {amount(entry.amount, entry.nutrient)}</p>
    <p className="mt-2 break-words text-xs leading-5 text-[#6d7a79]">User-provided source: {entry.previousSource ?? 'No source note'} → {entry.source ?? 'No source note'}</p>
  </li>)}</ol>;
}

export function GoalHistory({ personId, personName }: { personId: number; personName: string }) {
  const history = useListGoalHistory(personId, { query: { queryKey: getListGoalHistoryQueryKey(personId), staleTime: 30_000, refetchOnMount: 'always' } });
  return <section className="mt-7 border-t border-[#e0d9ce] pt-5" data-testid="section-goal-history">
    <h3 className="text-base font-extrabold">{personName}'s goal change history</h3>
    <p className="mb-4 mt-2 text-xs leading-5 text-[#6d7a79]">Recorded amounts and source-note changes only. This does not verify a source or professional review. Recording starts with this feature; earlier change dates are not reconstructed.</p>
    {history.isLoading ? <p role="status">Loading goal history…</p> :
      history.isError ? <div role="alert">Goal history could not be loaded. <button type="button" className="font-bold underline" onClick={() => history.refetch()}>Try again</button></div> :
        <GoalHistoryEntries entries={history.data ?? []} />}
  </section>;
}
