type Goals = {
  ironGoalMg?: number | null;
  fatGoalG?: number | null;
  ironGoalSource?: string | null;
  fatGoalSource?: string | null;
};

/** Omitted fields retain their old value; explicit null represents clearing. */
export function goalHistoryChanges(previous: Goals, changes: Goals) {
  return (["iron", "fat"] as const).flatMap(nutrient => {
    const amountKey = nutrient === "iron" ? "ironGoalMg" : "fatGoalG";
    const sourceKey = nutrient === "iron" ? "ironGoalSource" : "fatGoalSource";
    const previousAmount = previous[amountKey] ?? null;
    const amount = changes[amountKey] === undefined ? previousAmount : changes[amountKey] ?? null;
    const previousSource = previous[sourceKey] ?? null;
    const source = changes[sourceKey] === undefined ? previousSource : changes[sourceKey] ?? null;
    return previousAmount === amount && previousSource === source ? [] :
      [{ nutrient, previousAmount, amount, previousSource, source }];
  });
}
