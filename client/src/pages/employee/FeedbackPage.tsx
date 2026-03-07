import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import EmployeeLayout from "../../components/feature/EmployeeLayout";
import { apiFetchEmployee } from "../../api/client";
import { canGiveFeedbackByTime, getFeedbackTimeMessage } from "../../utils/feedbackEligibility";
import { ratingTextClass, ratingBadgeBg, ratingBadgeText } from "../../utils/ratingColor";
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

interface FeedbackRecord {
  id: number;
  date: string;
  mealType: string;
  rating: number;
  createdAt?: string;
}

interface TransactionRecord {
  id?: number;
  date: string;
  items?: { name?: string; quantity?: number }[];
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

export default function EmployeeFeedbackPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromUrl = searchParams.get("date") || "";
  const todayStr = toLocalDateStr(new Date());
  const initialDate =
    dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : todayStr;

  const [calendarYear, setCalendarYear] = useState(() => {
    const [y] = initialDate.split("-").map(Number);
    return y || new Date().getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [, m] = initialDate.split("-").map(Number);
    return m || new Date().getMonth() + 1;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState("");

  const [mealType, setMealType] = useState<"breakfast" | "lunch">("breakfast");
  const [rating, setRating] = useState<number>(0);
  const [itemFeedbacks, setItemFeedbacks] = useState<{ name: string; rating: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [list, setList] = useState<FeedbackRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [feedbackPage, setFeedbackPage] = useState(1);

  const formDate = selectedDate || todayStr;

  const FEEDBACK_PAGE_SIZE = 5;
  const sortedFeedbackList = useMemo(() => {
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const aId = a.id ?? 0;
      const bId = b.id ?? 0;
      return bId - aId;
    });
  }, [list]);
  const totalFeedbackPages = Math.max(1, Math.ceil(sortedFeedbackList.length / FEEDBACK_PAGE_SIZE));
  const paginatedFeedbackList = useMemo(() => {
    const start = (feedbackPage - 1) * FEEDBACK_PAGE_SIZE;
    return sortedFeedbackList.slice(start, start + FEEDBACK_PAGE_SIZE);
  }, [sortedFeedbackList, feedbackPage]);

  const { startDate, endDate } = useMemo(
    () => getMonthBounds(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  );

  const loadMenuAndTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setMenuError("");
      const [menuRes, txRes] = await Promise.all([
        apiFetchEmployee(`/employee/menu?startDate=${startDate}&endDate=${endDate}`),
        apiFetchEmployee(`/employee/transactions?startDate=${startDate}&endDate=${endDate}`),
      ]);
      setMenus(Array.isArray(menuRes) ? menuRes : []);
      setTransactions(Array.isArray(txRes) ? txRes : []);
    } catch (err: any) {
      setMenuError(err.message || "Failed to load menu");
      setMenus([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadMenuAndTransactions();
  }, [loadMenuAndTransactions]);

  useSocketEvent("menu:updated", loadMenuAndTransactions);
  useSocketEvent("transaction:created", loadMenuAndTransactions);

  useEffect(() => {
    if (dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl)) {
      setSelectedDate(dateFromUrl);
      const [y, m] = dateFromUrl.split("-").map(Number);
      if (y) setCalendarYear(y);
      if (m) setCalendarMonth(m);
    }
  }, [dateFromUrl]);

  useEffect(() => {
    loadMyFeedback();
  }, []);

  useEffect(() => {
    if (feedbackPage > totalFeedbackPages && totalFeedbackPages >= 1) {
      setFeedbackPage(1);
    }
  }, [totalFeedbackPages, feedbackPage]);

  const loadMyFeedback = async () => {
    try {
      setLoadingList(true);
      const res = await apiFetchEmployee("/employee/feedback");
      setList(Array.isArray(res) ? res : []);
    } catch {
      setList([]);
    } finally {
      setLoadingList(false);
    }
  };

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

  const givenFeedbackByDate = useMemo(() => {
    const map: Record<string, { breakfast?: boolean; lunch?: boolean }> = {};
    list.forEach((f) => {
      if (!map[f.date]) map[f.date] = {};
      if (f.mealType === "breakfast") map[f.date].breakfast = true;
      if (f.mealType === "lunch") map[f.date].lunch = true;
    });
    return map;
  }, [list]);

  useEffect(() => {
    const consumed = consumedByDate[formDate];
    const consumedB = consumed?.breakfast;
    const consumedL = consumed?.lunch;
    if (consumedB && consumedL) return;
    if (mealType === "breakfast" && !consumedB && consumedL) setMealType("lunch");
    if (mealType === "lunch" && !consumedL && consumedB) setMealType("breakfast");
  }, [formDate, consumedByDate, mealType]);

  // initialize item feedbacks whenever menu/date/meal change
  useEffect(() => {
    const menu = getMeal(formDate, mealType);
    const items = menu?.items ?? [];
    if (!items || items.length === 0) {
      setItemFeedbacks([]);
      return;
    }
    setItemFeedbacks(items.map((it: any) => ({ name: it.name || "", rating: 0 })));
  }, [formDate, mealType, menus]);

  const hasMenuForFormDate = useMemo(() => {
    const info = menuByDate[formDate];
    return (info?.breakfast || info?.lunch) === true;
  }, [menuByDate, formDate]);

  const consumedForFormDate = consumedByDate[formDate];
  const hasConsumedBreakfast = consumedForFormDate?.breakfast === true;
  const hasConsumedLunch = consumedForFormDate?.lunch === true;
  const hasAnyConsumptionForFormDate = hasConsumedBreakfast || hasConsumedLunch;
  const menuHasBreakfast = (menuByDate[formDate]?.breakfast) === true;
  const menuHasLunch = (menuByDate[formDate]?.lunch) === true;

  const feedbackAllowedByTime = canGiveFeedbackByTime(formDate);
  const alreadyGivenForThisMeal = givenFeedbackByDate[formDate]?.[mealType] === true;
  const feedbackEligibilityMessage = useMemo(() => {
    const timeMsg = getFeedbackTimeMessage(formDate);
    if (timeMsg) return timeMsg;
    if (!hasMenuForFormDate) return "No menu published for this date. Feedback not available.";
    if (!hasAnyConsumptionForFormDate)
      return "You can only give feedback for meals you consumed (billed) on this date. No billing transaction found for this date.";
    if (alreadyGivenForThisMeal) return "You have already given feedback for this meal on this date.";
    return null;
  }, [formDate, hasMenuForFormDate, hasAnyConsumptionForFormDate, alreadyGivenForThisMeal]);
  const canSubmitFeedback =
    feedbackAllowedByTime &&
    hasMenuForFormDate &&
    hasAnyConsumptionForFormDate &&
    !alreadyGivenForThisMeal &&
    ((mealType === "breakfast" && hasConsumedBreakfast) || (mealType === "lunch" && hasConsumedLunch));

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

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSearchParams({ date });
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<FeedbackRecord | null>(null);

  const openModal = (f: FeedbackRecord) => {
    setModalFeedback(f);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // If itemized feedback present, validate each item; otherwise validate global rating
    if (itemFeedbacks && itemFeedbacks.length > 0) {
      for (const it of itemFeedbacks) {
        if (!it.name || it.rating < 1 || it.rating > 5) {
          setError("Please rate each menu item from 1 to 5.");
          return;
        }
      }
    } else {
      if (rating < 1 || rating > 5) {
        setError("Please select a rating from 1 to 5.");
        return;
      }
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload: any = {
        date: formDate,
        mealType,
      };
      if (itemFeedbacks && itemFeedbacks.length > 0) {
        payload.items = itemFeedbacks;
      } else {
        payload.rating = rating;
      }
      await apiFetchEmployee("/employee/feedback", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess("Thank you! Your feedback has been submitted.");
      setRating(0);
      setItemFeedbacks([]);
      await loadMyFeedback();
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EmployeeLayout>
      <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-[1600px] mx-auto">
        <div className="shrink-0 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Feedback & Review</h1>
          <p className="text-gray-600 mt-1">
            Select a date to view the menu, then rate a meal (1–5).
          </p>
        </div>

        {/* Message bar: errors, success, or eligibility info */}
        {(error || menuError || success || feedbackEligibilityMessage) && (
          <div
            className={`shrink-0 mb-4 rounded-lg border px-4 py-3 flex items-start gap-3 ${
              error || menuError
                ? "bg-red-50 border-red-200 text-red-800"
                : success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {(error || menuError) && (
              <span className="shrink-0 mt-0.5" aria-hidden>
                <i className="ri-error-warning-line text-lg"></i>
              </span>
            )}
            {success && !error && !menuError && (
              <span className="shrink-0 mt-0.5" aria-hidden>
                <i className="ri-checkbox-circle-line text-lg"></i>
              </span>
            )}
            {feedbackEligibilityMessage && !error && !menuError && !success && (
              <span className="shrink-0 mt-0.5" aria-hidden>
                <i className="ri-information-line text-lg"></i>
              </span>
            )}
            <p className="text-sm font-medium flex-1 min-w-0">
              {error || menuError || success || feedbackEligibilityMessage}
            </p>
          </div>
        )}

        {/* Row 1: Calendar | Menu */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
            <div className="p-4 flex-1 min-h-[260px] flex flex-col relative">
              {loading && menus.length === 0 && (
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
                    const timeOk = canGiveFeedbackByTime(date);
                    const hasConsumption = !!(consumedByDate[date]?.breakfast || consumedByDate[date]?.lunch);
                    const isBlocked = hasMenu && timeOk && !hasConsumption;
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => handleDateSelect(date)}
                        title={isBlocked ? "No billing for this date – feedback only for consumed (billed) meals" : undefined}
                        className={`min-h-0 rounded-lg flex flex-col items-center justify-center text-sm transition-all border-2 ${
                          isSelected
                            ? "bg-blue-500 text-white border-blue-500 font-bold shadow-md"
                            : isBlocked
                              ? "bg-gray-200 border-gray-300 text-gray-500 opacity-75 hover:bg-gray-300"
                              : isToday
                                ? "bg-blue-100 text-blue-800 border-blue-300 font-semibold"
                                : hasMenu
                                  ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 font-medium"
                                  : "bg-slate-50 border-slate-100 text-slate-400"
                        }`}
                      >
                        <span>{date.slice(8)}</span>
                        <div className="flex gap-0.5 mt-0.5 items-center">
                          {isBlocked && (
                            <i className="ri-lock-line text-xs mr-0.5" title="No billing" />
                          )}
                          {hasB && (
                            <span
                              className="w-2 h-2 rounded-full bg-orange-500 shadow-sm"
                              title="Breakfast"
                            />
                          )}
                          {hasL && (
                            <span
                              className="w-2 h-2 rounded-full bg-green-500 shadow-sm"
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

          {/* Menu for selected date */}
          <div className="flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[280px]">
            <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                {formDate === todayStr ? "Today" : formDate}
              </h2>
              <p className="text-sm text-gray-500">Menu for this date (for reference)</p>
            </div>
            <div className="p-6 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 overflow-auto">
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                  <i className="ri-restaurant-line mr-2 text-orange-500"></i>
                  Breakfast
                </h3>
                {(() => {
                  const menu = getMeal(formDate, "breakfast");
                  const items = menu?.items ?? [];
                  return items.length === 0 ? (
                    <p className="text-gray-500 text-sm">No menu for this date.</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {items.map((item, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{item.name}</span>
                          {item.description && (
                            <span className="text-gray-500 text-sm block ml-4">{item.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                  <i className="ri-bowl-line mr-2 text-green-500"></i>
                  Lunch
                </h3>
                {(() => {
                  const menu = getMeal(formDate, "lunch");
                  const items = menu?.items ?? [];
                  return items.length === 0 ? (
                    <p className="text-gray-500 text-sm">No menu for this date.</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {items.map((item, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{item.name}</span>
                          {item.description && (
                            <span className="text-gray-500 text-sm block ml-4">{item.description}</span>
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

        {/* Row 2: Feedback form | Past review */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Submit feedback form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Submit feedback</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Rate a meal for <strong>{formDate}</strong> (1–5).
                {!canSubmitFeedback && (
                  <span className="block mt-1 text-amber-600 text-xs">
                    Only for past menus or today after 2:00 PM, with a published menu, and only for meals you consumed (billed in canteen).
                  </span>
                )}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="text"
                    readOnly
                    value={formDate}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as "breakfast" | "lunch")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  >
                    {hasConsumedBreakfast ? (
                      <option value="breakfast" disabled={!!givenFeedbackByDate[formDate]?.breakfast}>
                        {givenFeedbackByDate[formDate]?.breakfast ? "Breakfast (already submitted)" : "Breakfast"}
                      </option>
                    ) : (
                      <option value="breakfast" disabled>Breakfast (no consumption for this date)</option>
                    )}
                    {hasConsumedLunch ? (
                      <option value="lunch" disabled={!!givenFeedbackByDate[formDate]?.lunch}>
                        {givenFeedbackByDate[formDate]?.lunch ? "Lunch (already submitted)" : "Lunch"}
                      </option>
                    ) : (
                      <option value="lunch" disabled>Lunch (no consumption for this date)</option>
                    )}
                  </select>
                </div>
              </div>
              {itemFeedbacks && itemFeedbacks.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-gray-700">Rate each menu item (1–5)</div>
                  <div className="space-y-3">
                    {itemFeedbacks.map((it, idx) => (
                      <div key={idx} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                        <div className="font-medium text-gray-800">{it.name}</div>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() =>
                                setItemFeedbacks((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], rating: r };
                                  return copy;
                                })
                              }
                              className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                                it.rating === r ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1–5)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRating(r)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          rating === r ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={
                  submitting ||
                  !canSubmitFeedback ||
                  (itemFeedbacks && itemFeedbacks.length > 0
                    ? itemFeedbacks.some((it) => !it.rating || it.rating < 1 || it.rating > 5)
                    : rating < 1)
                }
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "Submit feedback"}
              </button>
            </form>
          </div>

          {/* My past feedback – last 5 per page, paginated */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">My past feedback</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {list.length === 0
                    ? "Your submitted ratings"
                    : `Showing ${(feedbackPage - 1) * FEEDBACK_PAGE_SIZE + 1}–${Math.min(feedbackPage * FEEDBACK_PAGE_SIZE, list.length)} of ${list.length} (most recent first)`}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
              {loadingList ? (
                <div className="p-6 text-center text-gray-500">Loading…</div>
              ) : list.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <i className="ri-star-smile-line text-4xl text-gray-300 mb-3"></i>
                  <p className="text-gray-500">No feedback submitted yet.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedFeedbackList.map((f) => (
                      <tr
                        key={f.id}
                        onClick={() => openModal(f)}
                        className="hover:bg-gray-50 cursor-pointer"
                        title="Click to view details"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">{f.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">{f.mealType}</td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ratingBadgeBg(f.rating)} ${ratingBadgeText(f.rating)}`}>
                              {f.rating} / 5
                            </span>
                            {f.items && f.items.length > 0 && (
                              <span className="text-xs text-gray-500">Itemized</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Feedback detail modal */}
              {modalOpen && modalFeedback && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/50" onClick={closeModal}></div>
                  <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full z-10 overflow-auto">
                    <div className="p-4 border-b flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">Feedback details</h3>
                        <div className="text-sm text-gray-500">{modalFeedback.date} · {modalFeedback.mealType}</div>
                      </div>
                      <button onClick={closeModal} className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-sm text-gray-600">Overall rating</div>
                        <div className={`text-xl font-semibold ${ratingTextClass(modalFeedback.rating)}`}>{modalFeedback.rating} / 5</div>
                      </div>
                      {modalFeedback.items && modalFeedback.items.length > 0 && (
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Per-item ratings</div>
                          <ul className="space-y-2">
                            {modalFeedback.items.map((it: any, idx: number) => (
                              <li key={idx} className="border rounded p-2 flex items-center justify-between">
                                <div className="font-medium text-gray-800">{it.name}</div>
                                <div className={`${ratingBadgeText(it.rating)} font-semibold`}>{it.rating} / 5</div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {!loadingList && list.length > 0 && totalFeedbackPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-500">
                  Page {feedbackPage} of {totalFeedbackPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFeedbackPage((p) => Math.max(1, p - 1))}
                    disabled={feedbackPage <= 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackPage((p) => Math.min(totalFeedbackPages, p + 1))}
                    disabled={feedbackPage >= totalFeedbackPages}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
