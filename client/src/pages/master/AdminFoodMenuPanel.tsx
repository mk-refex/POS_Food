import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { mastersApi, isAdmin } from "../../api/client";
import { canGiveFeedbackByTime } from "../../utils/feedbackEligibility";
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

function ItemEditor({
  title,
  icon,
  colorClass,
  items,
  setItems,
  onDelete,
  saving,
}: {
  title: string;
  icon: string;
  colorClass: string;
  items: MenuItem[];
  setItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className={`shrink-0 px-3 py-2 border-b border-gray-200 flex items-center justify-between ${colorClass}`}>
        <h3 className="text-sm font-semibold text-gray-800 flex items-center">
          <i className={`${icon} mr-2`}></i>
          {title}
        </h3>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving || items.length === 0}
          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50 disabled:pointer-events-none"
        >
          Delete {title}
        </button>
      </div>
      <div className="p-3 flex-1 min-h-0 overflow-auto space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-1.5 items-start">
            <input
              type="text"
              placeholder="Item name"
              value={item.name}
              onChange={(e) => {
                const value = e.target.value;
                setItems((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], name: value };
                  return next;
                });
              }}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              placeholder="Description"
              value={item.description || ""}
              onChange={(e) => {
                const value = e.target.value;
                setItems((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], description: value };
                  return next;
                });
              }}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg shrink-0"
              title="Remove item"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { name: "", description: "" }])}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
        >
          + Add item
        </button>
      </div>
    </div>
  );
}

export default function AdminFoodMenuPanel() {
  const navigate = useNavigate();
  const todayStr = toLocalDateStr(new Date());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [draftByDate, setDraftByDate] = useState<Record<string, { breakfast: MenuItem[]; lunch: MenuItem[] }>>({});

  const { startDate, endDate } = useMemo(
    () => getMonthBounds(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  );

  const loadMenus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await mastersApi.getMenus({ startDate, endDate });
      setMenus(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load menus");
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  useSocketEvent("menu:updated", loadMenus);

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

  const breakfastItems = useMemo(() => {
    if (!selectedDate) return [];
    const draft = draftByDate[selectedDate]?.breakfast;
    if (draft !== undefined) return draft;
    const m = menus.find((x) => x.date === selectedDate && x.mealType === "breakfast");
    return m?.items?.length ? [...m.items] : [];
  }, [selectedDate, draftByDate, menus]);

  const lunchItems = useMemo(() => {
    if (!selectedDate) return [];
    const draft = draftByDate[selectedDate]?.lunch;
    if (draft !== undefined) return draft;
    const m = menus.find((x) => x.date === selectedDate && x.mealType === "lunch");
    return m?.items?.length ? [...m.items] : [];
  }, [selectedDate, draftByDate, menus]);

  const setBreakfastItems = useMemo(
    () => (action: React.SetStateAction<MenuItem[]>) => {
      if (!selectedDate) return;
      setDraftByDate((prev) => {
        const draft = prev[selectedDate];
        const fromMenusB = menus.find((m) => m.date === selectedDate && m.mealType === "breakfast")?.items ?? [];
        const fromMenusL = menus.find((m) => m.date === selectedDate && m.mealType === "lunch")?.items ?? [];
        const currentB = draft?.breakfast ?? fromMenusB;
        const currentL = draft?.lunch ?? fromMenusL;
        const nextB = typeof action === "function" ? action(currentB) : action;
        return { ...prev, [selectedDate]: { breakfast: nextB, lunch: currentL } };
      });
    },
    [selectedDate, menus]
  );

  const setLunchItems = useMemo(
    () => (action: React.SetStateAction<MenuItem[]>) => {
      if (!selectedDate) return;
      setDraftByDate((prev) => {
        const draft = prev[selectedDate];
        const fromMenusB = menus.find((m) => m.date === selectedDate && m.mealType === "breakfast")?.items ?? [];
        const fromMenusL = menus.find((m) => m.date === selectedDate && m.mealType === "lunch")?.items ?? [];
        const currentB = draft?.breakfast ?? fromMenusB;
        const currentL = draft?.lunch ?? fromMenusL;
        const nextL = typeof action === "function" ? action(currentL) : action;
        return { ...prev, [selectedDate]: { breakfast: currentB, lunch: nextL } };
      });
    },
    [selectedDate, menus]
  );

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

  const handleSave = async () => {
    if (!selectedDate) return;
    try {
      setSaving(true);
      setError("");
      const breakfastToSave = breakfastItems.filter((i) => i.name.trim());
      const lunchToSave = lunchItems.filter((i) => i.name.trim());
      await mastersApi.upsertMenu({
        date: selectedDate,
        mealType: "breakfast",
        items: breakfastToSave.map((i) => ({ name: i.name.trim(), description: i.description?.trim() || undefined })),
        published: true,
      });
      await mastersApi.upsertMenu({
        date: selectedDate,
        mealType: "lunch",
        items: lunchToSave.map((i) => ({ name: i.name.trim(), description: i.description?.trim() || undefined })),
        published: true,
      });
      const res = await mastersApi.getMenus({ startDate, endDate });
      setMenus(Array.isArray(res) ? res : []);
      setDraftByDate((prev) => {
        const next = { ...prev };
        if (selectedDate) delete next[selectedDate];
        return next;
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save menu");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeal = async (mealType: "breakfast" | "lunch") => {
    if (!selectedDate || !confirm(`Delete ${mealType} for ${selectedDate}?`)) return;
    try {
      setSaving(true);
      await mastersApi.deleteMenu(selectedDate, mealType);
      setDraftByDate((prev) => {
        const draft = prev[selectedDate];
        const fromMenusB = menus.find((m) => m.date === selectedDate && m.mealType === "breakfast")?.items ?? [];
        const fromMenusL = menus.find((m) => m.date === selectedDate && m.mealType === "lunch")?.items ?? [];
        const currentB = draft?.breakfast ?? fromMenusB;
        const currentL = draft?.lunch ?? fromMenusL;
        return {
          ...prev,
          [selectedDate]: mealType === "breakfast" ? { breakfast: [], lunch: currentL } : { breakfast: currentB, lunch: [] },
        };
      });
      const res = await mastersApi.getMenus({ startDate, endDate });
      setMenus(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const displayDate = selectedDate || todayStr;
  const hasMenuForSelectedDate =
    !!selectedDate && (menuByDate[selectedDate]?.breakfast || menuByDate[selectedDate]?.lunch);
  const canShowGiveFeedback = !!selectedDate && canGiveFeedbackByTime(selectedDate) && hasMenuForSelectedDate && !isAdmin();

  return (
    <div className="flex flex-col min-h-[calc(100vh-14rem)] max-w-[1600px] mx-auto">
      <div className="shrink-0 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Food Menu</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Select a date from the calendar, then edit breakfast and lunch. Save or delete per meal. Employees see published menus in Employee Portal → Food Menu.
        </p>
      </div>

      {error && (
        <div className="shrink-0 mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-800 text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 flex-1 min-h-0">
        {/* Left: Calendar – 40% */}
        <div className="flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="shrink-0 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/90 tracking-wide">Select date</h3>
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
                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
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
                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
              >
                <i className="ri-arrow-right-s-line text-lg"></i>
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 min-h-0 flex flex-col relative">
            {loading && (
              <div className="absolute inset-0 bg-white/70 rounded-b-2xl flex items-center justify-center z-10">
                <i className="ri-loader-4-line text-2xl text-amber-600 animate-spin"></i>
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
                      className={`min-h-0 rounded-lg flex flex-col items-center justify-center text-sm transition-all border-2 ${isSelected
                          ? "bg-amber-500 text-white border-amber-500 font-bold shadow-md"
                          : isToday
                            ? "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
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

        {/* Right: Two columns Breakfast | Lunch – 60% */}
        <div className="flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {displayDate === todayStr ? "Today" : displayDate}
              </h3>
              <p className="text-sm text-gray-500">Edit menu for selected date</p>
            </div>
            <div className="flex items-center gap-2">
              {canShowGiveFeedback && (
                <button
                  type="button"
                  onClick={() => selectedDate && navigate(`/employee/feedback?date=${selectedDate}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm inline-flex items-center gap-2"
                >
                  <i className="ri-star-smile-line"></i>
                  Give Feedback
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedDate}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 text-sm"
              >
                {saving ? "Saving…" : "Save menu"}
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 min-h-0 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ItemEditor
              title="Breakfast"
              icon="ri-restaurant-line text-orange-500"
              colorClass="bg-orange-50"
              items={breakfastItems}
              setItems={setBreakfastItems}
              onDelete={() => handleDeleteMeal("breakfast")}
              saving={saving}
            />
            <ItemEditor
              title="Lunch"
              icon="ri-bowl-line text-green-500"
              colorClass="bg-green-50"
              items={lunchItems}
              setItems={setLunchItems}
              onDelete={() => handleDeleteMeal("lunch")}
              saving={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
