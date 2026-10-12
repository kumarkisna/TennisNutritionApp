import React, { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCorrectFoodMinerals, type Food } from '@workspace/api-client-react';

const displayAmount = (value: number | null) => value === null ? 'Unknown' : `${value} mg / 100 g`;

export function ImportedMineralAction({ food, onClick }: { food: Food; onClick: () => void }) {
  if (food.source !== 'open_food_facts') return null;
  return <div className="mt-2">
    {(food.calciumCorrectionEnabled || food.ironCorrectionEnabled) &&
      <span className="block text-[11px] font-bold text-[#915f20]" data-testid={`badge-mineral-correction-${food.id}`}>Minerals adjusted by you · not verified</span>}
    <button type="button" onClick={onClick} className="text-xs font-bold text-[#176d61] underline underline-offset-2"
      data-testid={`button-correct-minerals-${food.id}`} aria-label={`Correct minerals for ${food.name}`}>Correct minerals</button>
  </div>;
}

export function MineralCorrectionDialog({ food, close, onSaved }: { food: Food; close: () => void; onSaved: () => void }) {
  const [calciumEnabled, setCalciumEnabled] = useState(food.calciumCorrectionEnabled);
  const [ironEnabled, setIronEnabled] = useState(food.ironCorrectionEnabled);
  const [calcium, setCalcium] = useState(food.calciumMgPer100g === null ? '' : String(food.calciumMgPer100g));
  const [iron, setIron] = useState(food.ironMgPer100g === null ? '' : String(food.ironMgPer100g));
  const [note, setNote] = useState(food.mineralCorrectionNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useCorrectFoodMinerals();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const calciumValue = !calciumEnabled || !calcium.trim() ? null : Number(calcium);
    const ironValue = !ironEnabled || !iron.trim() ? null : Number(iron);
    if ((calciumValue !== null && (!Number.isFinite(calciumValue) || calciumValue < 0 || calciumValue > 10000)) ||
      (ironValue !== null && (!Number.isFinite(ironValue) || ironValue < 0 || ironValue > 1000))) {
      setError('Use 0–10,000 mg for calcium and 0–1,000 mg for iron per 100 g, or leave a correction blank for unknown.');
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({ id: food.id, data: {
        calciumCorrectionEnabled: calciumEnabled, calciumMgPer100g: calciumValue,
        ironCorrectionEnabled: ironEnabled, ironMgPer100g: ironValue,
        note: calciumEnabled || ironEnabled ? note.trim() || null : null,
      } });
      onSaved();
      close();
    } catch { setError('The correction could not be saved. Check your connection and sign-in, then try again.'); }
  }

  return <div className="workspace-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !save.isPending && close()}>
    <div className="workspace-modal" role="dialog" aria-modal="true" aria-labelledby="mineral-correction-title"
      data-testid="dialog-mineral-correction" onKeyDown={event => { if (event.key === 'Escape' && !save.isPending) close(); }}>
      <div className="flex justify-between gap-3">
        <div><p className="workspace-eyebrow">Imported food / correction</p>
          <h2 id="mineral-correction-title" className="mt-2 text-2xl font-extrabold">Correct minerals</h2>
          <p className="mt-2 text-sm">{food.name}</p></div>
        <button type="button" onClick={close} disabled={save.isPending} aria-label="Close mineral correction"><X size={21} /></button>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#6d7a79]">Supplier values saved at import are kept unchanged. Your corrections are separate and are not verified by this app.</p>
      {food.sourceUrl && <a href={food.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-[#176d61] underline">View Open Food Facts source</a>}
      <form onSubmit={submit} className="mt-5 space-y-5">
        <fieldset disabled={save.isPending} className="space-y-5">
          <legend className="sr-only">Mineral values per 100 grams</legend>
          {([
            { key: 'calcium', label: 'Calcium', enabled: calciumEnabled, setEnabled: setCalciumEnabled, value: calcium, setValue: setCalcium, supplier: food.supplierCalciumMgPer100g, max: 10000 },
            { key: 'iron', label: 'Iron', enabled: ironEnabled, setEnabled: setIronEnabled, value: iron, setValue: setIron, supplier: food.supplierIronMgPer100g, max: 1000 },
          ] as const).map(field => <div key={field.key} className="rounded-xl border border-[#e0d9ce] p-4">
            <p className="text-xs text-[#6d7a79]">{field.label} · saved supplier value: <strong>{displayAmount(field.supplier)}</strong></p>
            <label className="workspace-label mt-3" htmlFor={`correction-mode-${field.key}`}>{field.label} used in plans</label>
            <select id={`correction-mode-${field.key}`} className="workspace-input" value={field.enabled ? 'corrected' : 'supplier'}
              onChange={event => field.setEnabled(event.target.value === 'corrected')} data-testid={`select-correction-${field.key}`}>
              <option value="supplier">Use saved supplier value</option><option value="corrected">Use my correction</option>
            </select>
            {field.enabled && <div className="mt-3"><label className="workspace-label" htmlFor={`correction-amount-${field.key}`}>Your {field.label.toLowerCase()} (mg / 100 g)</label>
              <input id={`correction-amount-${field.key}`} type="number" min="0" max={field.max} step="any" className="workspace-input"
                placeholder="Unknown" value={field.value} onChange={event => field.setValue(event.target.value)} data-testid={`input-correction-${field.key}`} />
              <p className="mt-2 text-xs text-[#6d7a79]">Blank means unknown. Enter zero only when the label explicitly reports zero.</p></div>}
          </div>)}
          <div><label className="workspace-label" htmlFor="mineral-correction-note">Correction note (optional, user-provided)</label>
            <textarea id="mineral-correction-note" className="workspace-input" maxLength={300} value={calciumEnabled || ironEnabled ? note : ''}
              disabled={!calciumEnabled && !ironEnabled} onChange={event => setNote(event.target.value)} placeholder="e.g. checked the pack's per-100 g label" data-testid="input-correction-note" />
            <p className="mt-2 text-xs text-[#6d7a79]">Avoid private medical information. Restoring both supplier values removes this note.</p></div>
        </fieldset>
        <p className="rounded-xl bg-[#f1ede4] p-3 text-xs leading-5">Saving changes the mineral totals for all your meal plans using this food, including earlier dates. Source attribution and other nutrients stay unchanged.</p>
        {error && <p role="alert" className="text-sm text-[#a6473a]">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" className="workspace-button" disabled={save.isPending} data-testid="button-save-mineral-correction">{save.isPending ? 'Saving…' : 'Save mineral choices'}</button>
          <button type="button" className="workspace-button workspace-button-secondary" disabled={save.isPending} onClick={close}>Cancel</button>
        </div>
      </form>
    </div>
  </div>;
}
