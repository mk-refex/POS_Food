/** Daily meal totals for a customer (all items count — no exception bypass). */
export async function getDailyMealTotals(Transaction, { date, customerType, customerId }) {
  if (!customerId) return { breakfast: 0, lunch: 0 };
  const prior = await Transaction.findAll({
    where: { date, customerType, customerId: String(customerId) },
  });
  return prior.reduce(
    (acc, t) => {
      for (const it of t.items || []) {
        if (it.name === 'Breakfast') acc.breakfast += Number(it.quantity || 0);
        if (it.name === 'Lunch') acc.lunch += Number(it.quantity || 0);
      }
      return acc;
    },
    { breakfast: 0, lunch: 0 },
  );
}

export function mealLimitWarnings(totals, items, qtyFallback = 1) {
  const newBreakfast = (items || [])
    .filter((i) => i.name === 'Breakfast')
    .reduce((s, i) => s + Number(i.quantity || qtyFallback), 0);
  const newLunch = (items || [])
    .filter((i) => i.name === 'Lunch')
    .reduce((s, i) => s + Number(i.quantity || qtyFallback), 0);
  const warnings = {};
  if (totals.breakfast + newBreakfast > 1) warnings.breakfastExceeded = true;
  if (totals.lunch + newLunch > 1) warnings.lunchExceeded = true;
  return warnings;
}

export function mealLimitErrorMessage(warnings) {
  if (warnings.breakfastExceeded && warnings.lunchExceeded) {
    return 'You have already consumed breakfast and lunch today.';
  }
  if (warnings.breakfastExceeded) {
    return 'You have already consumed breakfast today.';
  }
  if (warnings.lunchExceeded) {
    return 'You have already consumed lunch today.';
  }
  return 'Daily meal limit reached.';
}
