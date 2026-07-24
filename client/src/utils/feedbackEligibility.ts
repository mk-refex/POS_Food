/**
 * Feedback is allowed for past dates and today (no time-of-day restriction).
 * Only future dates are blocked. Consumption validation (meal billed) is enforced separately.
 */
export function canGiveFeedbackByTime(dateStr: string): boolean {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const todayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return dateStr <= todayStr;
}

export function getFeedbackTimeMessage(dateStr: string): string | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const todayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (dateStr > todayStr) return "Feedback is only for past or today's menus. You cannot give feedback for future dates.";
  return null;
}
