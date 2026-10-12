import React from 'react';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { Food } from '@workspace/api-client-react';
import { ImportedMineralAction } from './MineralCorrectionDialog';

const n = (value: number, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

export function FoodsCatalogTable({ foods, onEdit, onDelete, onCorrect, deleting }: {
  foods: Food[]; onEdit: (food: Food) => void; onDelete: (food: Food) => void;
  onCorrect: (food: Food) => void; deleting: boolean;
}) {
  return <div className="workspace-card overflow-hidden"><div className="overflow-x-auto">
    <table className="workspace-table">
      <thead><tr><th>Food &amp; source</th><th>Category</th><th>Energy</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Fiber</th><th className="text-right">Actions</th></tr></thead>
      <tbody>{foods.map(food => <tr key={food.id} data-testid={`row-food-${food.id}`}>
        <td><div className="min-w-40">
          <strong className="block">{food.name}</strong>
          {food.brand && <span className="block text-[11px] text-[#6d7a79]">{food.brand}</span>}
          <span className={`mt-1 inline-block rounded-full px-2 py-1 text-[10px] font-bold ${food.source === 'custom' ? 'bg-[#e8f3ed] text-[#176d61]' : food.source === 'open_food_facts' ? 'bg-[#e1e9eb] text-[#315d65]' : 'bg-[#f1ede4] text-[#71807b]'}`}
            data-testid={`badge-food-source-${food.id}`}>{food.source === 'custom' ? 'Custom' : food.source === 'open_food_facts' ? 'Imported · Open Food Facts' : 'Reference'}</span>
          {food.source === 'open_food_facts' && food.sourceUrl && <a href={food.sourceUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1 block text-[11px] font-bold text-[#176d61] underline underline-offset-2" data-testid={`link-food-source-${food.id}`}>View source <ExternalLink size={10} className="inline" /></a>}
          <ImportedMineralAction food={food} onClick={() => onCorrect(food)} />
        </div></td>
        <td className="text-[#6d7a79]">{food.category.charAt(0).toUpperCase() + food.category.slice(1).replace('_', ' ')}</td>
        <td className="font-extrabold whitespace-nowrap">{n(food.caloriesPer100g)} kcal</td>
        <td>{n(food.proteinPer100g, 1)}g</td><td>{n(food.carbsPer100g, 1)}g</td><td>{n(food.fatPer100g, 1)}g</td>
        <td data-testid={`value-food-fiber-${food.id}`}>{food.fiberKnown ? `${n(food.fiberPer100g, 1)}g` : '—'}</td>
        <td><div className="flex justify-end gap-1">
          {food.source === 'custom' && <button type="button" onClick={() => onEdit(food)} aria-label={`Edit ${food.name}`}
            className="rounded-lg p-2 text-[#176d61] hover:bg-[#e8f3ed]" data-testid={`button-edit-food-${food.id}`}><Pencil size={15} /></button>}
          {food.source !== 'reference' && <button type="button" onClick={() => onDelete(food)} disabled={deleting} aria-label={`Delete ${food.name}`}
            className="rounded-lg p-2 text-[#a6473a] hover:bg-[#fff0eb] disabled:opacity-40" data-testid={`button-delete-food-${food.id}`}><Trash2 size={15} /></button>}
        </div></td>
      </tr>)}</tbody>
    </table>
  </div></div>;
}
