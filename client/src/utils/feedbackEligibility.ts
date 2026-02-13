/**
 * Feedback is allowed only for:
 * - Past dates (date < today), or
 * - Today after 2:00 PM (employee is considered to have consumed the meal).
 * No feedback for future dates or today before 2pm.
 */
export function canGiveFeedbackByTime(dateStr: string): boolean {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const todayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  if (dateStr > todayStr) return false; // future
  if (dateStr < todayStr) return true;  // past

  // today: allow only after 2:00 PM (14:00)
  const hour = now.getHours();
  const minute = now.getMinutes();
  return hour > 14 || (hour === 14 && minute >= 0);
}

export function getFeedbackTimeMessage(dateStr: string): string | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const todayStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  if (dateStr > todayStr) return "Feedback is only for past menus. You cannot give feedback for tomorrow or upcoming dates.";
  if (dateStr === todayStr) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 14 || (hour === 14 && minute < 0)) {
      return "Feedback for today is available only after 2:00 PM (after you have had a chance to consume the meal).";
    }
  }
  return null;
}
