import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeLayout from "../../components/feature/EmployeeLayout";
import { apiFetchEmployee } from "../../api/client";
import { canGiveFeedbackByTime, getFeedbackTimeMessage } from "../../utils/feedbackEligibility";
import { useSocketEvent } from "../../contexts/SocketContext";

interface MenuItem {
  name: string;
  description?: string;
}

interface MenuRecord {
  id: number;
  date: string;
  mealType: "breakfast" | "lunch";
  items: MenuItem[];
  published: boolean;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startDate: toLocalDateStr(start),
    endDate: toLocalDateStr(end),
  };
}

export default function EmployeeMenuPage() {
  const navigate = useNavigate();
  const todayStr = toLocalDateStr(new Date());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [transactions, setTransactions] = useState<{ date: string; items?: { name?: string; quantity?: number }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // (moved earlier) Initialize edit buffers when selectedDate or menus change

  const { startDate, endDate } = useMemo(
    () => getMonthBounds(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [menuRes, txRes] = await Promise.all([
        apiFetchEmployee(`/employee/menu?startDate=${startDate}&endDate=${endDate}`),
        apiFetchEmployee(`/employee/transactions?startDate=${startDate}&endDate=${endDate}`),
      ]);
      setMenus(Array.isArray(menuRes) ? menuRes : []);
      setTransactions(Array.isArray(txRes) ? txRes : []);
    } catch (err: any) {
      setError(err.message || "Failed to load menu");
      setMenus([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent("menu:updated", load);
  useSocketEvent("transaction:created", load);

  const menuByDate = useMemo(() => {
    const map: Record<string, { breakfast: boolean; lunch: boolean }> = {};
    menus.forEach((m) => {
      if (!map[m.date]) map[m.date] = { breakfast: false, lunch: false };
      const hasItems = (m.items?.length ?? 0) > 0;
      if (m.mealType === "breakfast" && hasItems) map[m.date].breakfast = true;
      if (m.mealType === "lunch" && hasItems) map[m.date].lunch = true;
    });
    return map;
  }, [menus]);

  const consumedByDate = useMemo(() => {
    const map: Record<string, { breakfast?: boolean; lunch?: boolean }> = {};
    transactions.forEach((t) => {
      const date = t.date;
      if (!map[date]) map[date] = {};
      (t.items || []).forEach((item) => {
        if (item.name === "Breakfast" && (item.quantity || 0) > 0) map[date].breakfast = true;
        if (item.name === "Lunch" && (item.quantity || 0) > 0) map[date].lunch = true;
      });
    });
    return map;
  }, [transactions]);

  const calendarGrid = useMemo(() => {
    const first = new Date(calendarYear, calendarMonth - 1, 1);
    const last = new Date(calendarYear, calendarMonth, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const rows: (string | null)[][] = [];
    let row: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) row.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      row.push(date);
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length) {
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [calendarYear, calendarMonth]);

  const byDate = (date: string) => menus.filter((m) => m.date === date);
  const getMeal = (date: string, meal: "breakfast" | "lunch") =>
    byDate(date).find((m) => m.mealType === meal);

  const displayDate = selectedDate || todayStr;
  const hasMenuForDisplayDate = (menuByDate[displayDate]?.breakfast || menuByDate[displayDate]?.lunch) === true;
  const hasConsumptionForDisplayDate =
    (consumedByDate[displayDate]?.breakfast || consumedByDate[displayDate]?.lunch) === true;
  const canShowGiveFeedback =
    canGiveFeedbackByTime(displayDate) && hasMenuForDisplayDate && hasConsumptionForDisplayDate;
  const feedbackMessageWhenHidden = useMemo(() => {
    if (canShowGiveFeedback) return null;
    const timeMsg = getFeedbackTimeMessage(displayDate);
    if (timeMsg) return timeMsg;
    if (!hasMenuForDisplayDate) return "No menu published for this date. Feedback not available.";
    if (!hasConsumptionForDisplayDate)
      return "You can give feedback only for meals you consumed (billed) on this date. No billing transaction for this date.";
    return null;
  }, [displayDate, hasMenuForDisplayDate, hasConsumptionForDisplayDate, canShowGiveFeedback]);

 

  if (loading && menus.length === 0) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center h-64">
          <i className="ri-loader-4-line text-4xl text-blue-600 animate-spin"></i>
        </div>
      </EmployeeLayout>
    );
  }

 

  

  return (
    <EmployeeLayout>
      <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-[1600px] mx-auto">
        <div className="shrink-0 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Food Menu</h1>
          <p className="text-gray-600 mt-1">Select a date to view published menu (from admin)</p>
        </div>

        {(error || feedbackMessageWhenHidden) && (
          <div
            className={`shrink-0 mb-4 rounded-lg border px-4 py-3 flex items-start gap-3 ${
              error ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {error && <i className="ri-error-warning-line text-lg shrink-0 mt-0.5" aria-hidden />}
            {feedbackMessageWhenHidden && !error && (
              <i className="ri-information-line text-lg shrink-0 mt-0.5" aria-hidden />
            )}
            <p className="text-sm font-medium flex-1 min-w-0">{error || feedbackMessageWhenHidden}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 flex-1 min-h-0">
          {/* Left: Calendar – 40% width */}
          <div className="flex flex-col min-h-0 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="shrink-0 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/90 tracking-wide">Select date</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 1) {
                      setCalendarYear((y) => y - 1);
                      setCalendarMonth(12);
                    } else {
                      setCalendarMonth((m) => m - 1);
                    }
                  }}
                  disabled={loading}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                >
                  <i className="ri-arrow-left-s-line text-lg"></i>
                </button>
                <span className="min-w-[100px] text-center text-sm font-semibold text-white">
                  {new Date(calendarYear, calendarMonth - 1, 1).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 12) {
                      setCalendarYear((y) => y + 1);
                      setCalendarMonth(1);
                    } else {
                      setCalendarMonth((m) => m + 1);
                    }
                  }}
                  disabled={loading}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                >
                  <i className="ri-arrow-right-s-line text-lg"></i>
                </button>
              </div>
            </div>
            <div className="p-4 flex-1 min-h-0 flex flex-col relative">
              {loading && (
                <div className="absolute inset-0 bg-white/70 rounded-b-2xl flex items-center justify-center z-10">
                  <i className="ri-loader-4-line text-2xl text-blue-600 animate-spin"></i>
                </div>
              )}
              <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-slate-500 uppercase shrink-0">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0" style={{ gridAutoRows: "1fr" }}>
                {calendarGrid.flatMap((row, ri) =>
                  row.map((date, ci) => {
                    if (!date) {
                      return <div key={`e-${ri}-${ci}`} className="min-h-0" />;
                    }
                    const info = menuByDate[date];
                    const hasB = info?.breakfast ?? false;
                    const hasL = info?.lunch ?? false;
                    const isSelected = date === selectedDate;
                    const isToday = date === todayStr;
                    const hasMenu = hasB || hasL;
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        title={
                          date +
                          (hasB ? " · Breakfast" : "") +
                          (hasL ? " · Lunch" : "") +
                          (isToday ? " · Today" : "") +
                          (!hasMenu ? " · No menu" : "")
                        }
                        className={`min-h-0 rounded-lg flex flex-col items-center justify-center text-sm transition-all border-2 ${
                          isSelected
                            ? "bg-blue-500 text-white border-blue-500 font-bold shadow-md"
                            : isToday
                              ? "bg-blue-100 text-blue-800 border-blue-300 font-semibold"
                              : hasMenu
                                ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 font-medium"
                                : "bg-slate-50 border-slate-100 text-slate-400"
                        }`}
                      >
                        <span>{date.slice(8)}</span>
                        <div className="flex gap-0.5 mt-0.5">
                          {hasB && (
                            <span
                              className={`w-2 h-2 rounded-full ${isSelected ? "bg-amber-200" : "bg-orange-500"}`}
                              title="Breakfast"
                            />
                          )}
                          {hasL && (
                            <span
                              className={`w-2 h-2 rounded-full ${isSelected ? "bg-emerald-200" : "bg-green-500"}`}
                              title="Lunch"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="shrink-0 mt-3 pt-3 border-t border-slate-100 flex justify-center gap-3 text-xs text-slate-500 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500" /> Breakfast
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Lunch
                </span>
              </div>
            </div>
          </div>

          {/* Right: Menu for selected date – 60% width, two columns */}
          <div className="flex flex-col min-h-0 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {displayDate === todayStr ? "Today" : displayDate}
                </h2>
                <p className="text-sm text-gray-500">{displayDate}</p>
              </div>
            <div className="flex items-center gap-2">
              {canShowGiveFeedback && (
                <button
                  type="button"
                  onClick={() => navigate(`/employee/feedback?date=${displayDate}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm inline-flex items-center gap-2"
                >
                  <i className="ri-star-smile-line"></i>
                  Give Feedback
                </button>
              )}
            </div>
            </div>
            <div className="p-6 flex-1 min-h-0 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Breakfast column */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                  <i className="ri-restaurant-line mr-2 text-orange-500"></i>
                  Breakfast
                </h3>
              {(() => {
                const menu = getMeal(displayDate, "breakfast");
                const items = menu?.items ?? [];
                return items.length === 0 ? (
                  <p className="text-gray-500 text-sm">No menu published for this date.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {items.map((item, idx) => (
                      <li key={idx}>
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="text-gray-500 text-sm block ml-4">
                            {item.description}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                );
              })()}
              </div>
              {/* Lunch column */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                  <i className="ri-bowl-line mr-2 text-green-500"></i>
                  Lunch
                </h3>
              {(() => {
                const menu = getMeal(displayDate, "lunch");
                const items = menu?.items ?? [];
                return items.length === 0 ? (
                  <p className="text-gray-500 text-sm">No menu published for this date.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {items.map((item, idx) => (
                      <li key={idx}>
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="text-gray-500 text-sm block ml-4">
                            {item.description}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                );
              })()}
              </div>
            </div>
          </div>
        </div>

        <p className="shrink-0 mt-4 pt-4 text-sm text-gray-500 text-center">
          Menu is updated by admin. Contact canteen if you have questions.
        </p>
      </div>
    </EmployeeLayout>
  );
}
