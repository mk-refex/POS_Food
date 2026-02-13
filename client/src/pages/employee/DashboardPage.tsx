import { useState, useEffect, useMemo } from "react";
import EmployeeLayout from "../../components/feature/EmployeeLayout";
import AnimatedNumber from "../../components/AnimatedNumber";
import { apiFetchEmployee } from "../../api/client";

interface DashboardData {
  summary: {
    totalTransactions: number;
    totalBreakfast: number;
    totalLunch: number;
    totalAmount: number;
  };
  byDay: Array<{ date: string; breakfast: number; lunch: number; totalAmount: number; count: number }>;
  byWeek: Array<{ week: string; breakfast: number; lunch: number; totalAmount: number; count: number }>;
  byMonth: Array<{ month: string; breakfast: number; lunch: number; totalAmount: number; count: number }>;
  byYear: Array<{ year: string; breakfast: number; lunch: number; totalAmount: number; count: number }>;
  transactions: Array<{
    id: number;
    date: string;
    time: string;
    items: Array<{ name: string; quantity: number; actualPrice: number }>;
    totalAmount: number;
  }>;
}

function getTodayStr() {
  return toLocalDateStr(new Date());
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

/** Current week Monday–Sunday (India: week starts Monday) */
function getCurrentWeekBounds(): { startDate: string; endDate: string } {
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const isoDay = day === 0 ? 7 : day; // Mon=1 .. Sun=7
  const daysFromMonday = isoDay - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: toLocalDateStr(monday),
    endDate: toLocalDateStr(sunday),
  };
}

/** Current month: 1st to last day (28/29/30/31) */
function getCurrentMonthBounds(): { startDate: string; endDate: string } {
  const now = new Date();
  return getMonthBounds(now.getFullYear(), now.getMonth() + 1);
}

/** Current year: Jan 1 to Dec 31 */
function getCurrentYearBounds(): { startDate: string; endDate: string } {
  const y = new Date().getFullYear();
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

export default function EmployeeDashboardPage() {
  const todayStr = getTodayStr();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartTab, setChartTab] = useState<"week" | "month" | "year">("month");
  const [chartStartDate, setChartStartDate] = useState(() => getCurrentMonthBounds().startDate);
  const [chartEndDate, setChartEndDate] = useState(() => getCurrentMonthBounds().endDate);
  const [chartData, setChartData] = useState<DashboardData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [calendarByDay, setCalendarByDay] = useState<Record<string, { breakfast: number; lunch: number }>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [txPage, setTxPage] = useState(1);
  const [txPerPage, setTxPerPage] = useState(10);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadCalendarMonth(calendarYear, calendarMonth);
  }, [calendarYear, calendarMonth]);

  useEffect(() => {
    loadChartData();
  }, [chartTab, chartStartDate, chartEndDate]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiFetchEmployee("/employee/dashboard");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      setChartLoading(true);
      const res = await apiFetchEmployee(
        `/employee/dashboard?startDate=${chartStartDate}&endDate=${chartEndDate}`
      );
      setChartData(res);
    } catch {
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  };

  const loadCalendarMonth = async (year: number, month: number) => {
    const { startDate, endDate } = getMonthBounds(year, month);
    try {
      setCalendarLoading(true);
      const res = await apiFetchEmployee(`/employee/dashboard?startDate=${startDate}&endDate=${endDate}`);
      const byDayMap: Record<string, { breakfast: number; lunch: number }> = {};
      (res?.byDay ?? []).forEach((d: { date: string; breakfast: number; lunch: number }) => {
        byDayMap[d.date] = { breakfast: d.breakfast || 0, lunch: d.lunch || 0 };
      });
      setCalendarByDay(byDayMap);
    } catch {
      setCalendarByDay({});
    } finally {
      setCalendarLoading(false);
    }
  };

  const summary = data?.summary ?? {
    totalTransactions: 0,
    totalBreakfast: 0,
    totalLunch: 0,
    totalAmount: 0,
  };

  const todayData = useMemo(() => {
    const byDay = data?.byDay ?? [];
    const today = byDay.find((d) => d.date === todayStr);
    return {
      breakfast: (today?.breakfast ?? 0) > 0,
      lunch: (today?.lunch ?? 0) > 0,
    };
  }, [data?.byDay, todayStr]);

  const transactionsList = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const txTotal = transactionsList.length;
  const txTotalPages = Math.max(1, Math.ceil(txTotal / txPerPage));
  const txPageClamped = Math.min(Math.max(1, txPage), txTotalPages);
  const paginatedTransactions = useMemo(() => {
    const start = (txPageClamped - 1) * txPerPage;
    return transactionsList.slice(start, start + txPerPage);
  }, [transactionsList, txPerPage, txPageClamped]);
  const txStart = txTotal === 0 ? 0 : (txPageClamped - 1) * txPerPage + 1;
  const txEnd = Math.min(txPageClamped * txPerPage, txTotal);

  useEffect(() => {
    if (txPage > txTotalPages && txTotalPages >= 1) setTxPage(1);
  }, [txTotalPages, txPage, txTotal]);

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

  if (loading && !data) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <i className="ri-loader-4-line text-4xl text-blue-600 animate-spin mb-4"></i>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-3 sm:px-4 overflow-x-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Personal Consumption Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Overview of your food consumption and transactions</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <i className="ri-error-warning-line text-red-600 mr-2"></i>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Summary cards - same style as admin dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow min-w-0 card-raise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 mb-1">Today · Breakfast</p>
                <div className="flex items-center gap-2" title={todayData.breakfast ? "Consumed" : "Not consumed"}>
                    {todayData.breakfast ? (
                      <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <i className="ri-checkbox-circle-fill text-2xl"></i>
                      </span>
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <i className="ri-close-circle-line text-2xl"></i>
                      </span>
                    )}
                  </div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <i className="ri-restaurant-line text-2xl text-orange-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow min-w-0 card-raise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 mb-1">Today · Lunch</p>
                <div className="flex items-center gap-2" title={todayData.lunch ? "Consumed" : "Not consumed"}>
                    {todayData.lunch ? (
                      <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <i className="ri-checkbox-circle-fill text-2xl"></i>
                      </span>
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <i className="ri-close-circle-line text-2xl"></i>
                      </span>
                    )}
                  </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <i className="ri-bowl-line text-2xl text-green-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow min-w-0 card-raise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 mb-1">Breakfast</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600"><AnimatedNumber value={summary.totalBreakfast} /></p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <i className="ri-restaurant-line text-2xl text-orange-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow min-w-0 card-raise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 mb-1">Lunch</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600"><AnimatedNumber value={summary.totalLunch} /></p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <i className="ri-bowl-line text-2xl text-green-600"></i>
              </div>
            </div>
          </div>

        </div>

        {/* Calendar + Chart in same row – two cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Card 1: Calendar – compact, fully visible */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-w-0">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-3 py-2 flex items-center justify-between shrink-0">
              <h2 className="text-xs font-semibold text-white/90 tracking-wide">Monthly calendar</h2>
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
                  disabled={calendarLoading}
                  className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                >
                  <i className="ri-arrow-left-s-line text-base"></i>
                </button>
                <span className="min-w-[90px] text-center text-sm font-semibold text-white">
                  {new Date(calendarYear, calendarMonth - 1, 1).toLocaleString("default", {
                    month: "short",
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
                  disabled={calendarLoading}
                  className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                >
                  <i className="ri-arrow-right-s-line text-base"></i>
                </button>
              </div>
            </div>
            <div className="p-2 flex-1 min-h-0 flex flex-col">
              {calendarLoading ? (
                <div className="flex justify-center py-6 flex-1 items-center">
                  <i className="ri-loader-4-line text-2xl text-slate-500 animate-spin"></i>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-0.5 mb-1 text-center text-[10px] font-semibold text-slate-500 uppercase">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div key={i}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 flex-1" style={{ minHeight: "140px" }}>
                    {calendarGrid.flatMap((row, ri) =>
                      row.map((date, ci) => {
                        if (!date) {
                          return <div key={`e-${ri}-${ci}`} className="min-h-[18px]" />;
                        }
                        const dayData = calendarByDay[date];
                        const hasB = (dayData?.breakfast ?? 0) > 0;
                        const hasL = (dayData?.lunch ?? 0) > 0;
                        const isToday = date === todayStr;
                        const hasAny = hasB || hasL;
                        return (
                          <div
                            key={date}
                            title={date + (hasB ? " · Breakfast" : "") + (hasL ? " · Lunch" : "") + (isToday ? " · Today" : "")}
                            className={`min-h-[18px] rounded-md flex flex-col items-center justify-center text-[10px] transition-all ${
                              isToday
                                ? "bg-blue-100 text-blue-800 border-2 border-blue-400 font-bold shadow-sm"
                                : hasAny
                                  ? "bg-slate-100 border border-slate-200 text-slate-700 font-medium"
                                  : "bg-slate-50/80 border border-slate-100 text-slate-400"
                            }`}
                          >
                            <span>{date.slice(8)}</span>
                            <div className="flex gap-0.5 mt-0.5">
                              {hasB && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-orange-500"
                                  title="Breakfast"
                                />
                              )}
                              {hasL && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-green-500"
                                  title="Lunch"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-center gap-3 text-[10px] text-slate-500 shrink-0">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" /> Breakfast
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> Lunch
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right column: Trans + Amount grid, then Chart */}
          <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow min-w-0 card-raise">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-600 mb-1">Transactions</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900"><AnimatedNumber value={summary.totalTransactions} /></p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <i className="ri-receipt-line text-2xl text-blue-600"></i>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow min-w-0 card-raise">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-600 mb-1">Total amount</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">₹<AnimatedNumber value={summary.totalAmount} /></p>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <i className="ri-money-rupee-circle-line text-2xl text-gray-600"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Consumption by period chart */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-w-0">
            <div className="p-3 sm:p-4 border-b border-gray-200 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Consumption by period</h2>
              <p className="text-xs text-gray-600 mt-0.5">By week, month or year</p>
            </div>
            <div className="p-2 sm:p-3 border-b border-gray-200 flex flex-wrap items-center gap-2 shrink-0">
              {(["week", "month", "year"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setChartTab(tab);
                    if (tab === "week") {
                      const { startDate, endDate } = getCurrentWeekBounds();
                      setChartStartDate(startDate);
                      setChartEndDate(endDate);
                    } else if (tab === "month") {
                      const { startDate, endDate } = getCurrentMonthBounds();
                      setChartStartDate(startDate);
                      setChartEndDate(endDate);
                    } else {
                      const { startDate, endDate } = getCurrentYearBounds();
                      setChartStartDate(startDate);
                      setChartEndDate(endDate);
                    }
                  }}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-lg font-medium text-xs capitalize transition-colors min-h-[36px] sm:min-h-0 ${
                    chartTab === tab ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto sm:ml-auto">
                <input
                  type="date"
                  value={chartStartDate}
                  onChange={(e) => setChartStartDate(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1.5 sm:py-1 w-full min-w-0 sm:w-[110px] flex-1 sm:flex-none"
                />
                <span className="text-gray-400 shrink-0">–</span>
                <input
                  type="date"
                  value={chartEndDate}
                  onChange={(e) => setChartEndDate(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1.5 sm:py-1 w-full min-w-0 sm:w-[110px] flex-1 sm:flex-none"
                />
              </div>
            </div>
            <div className="p-3 sm:p-4 flex-1 min-h-0">
              {chartLoading ? (
                <div className="flex justify-center items-center min-h-[140px]">
                  <i className="ri-loader-4-line text-2xl text-blue-600 animate-spin"></i>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="bg-orange-50 rounded-xl border border-orange-100 p-3 sm:p-4 flex items-center justify-between min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-orange-700 mb-0.5">Breakfast</p>
                      <p className="text-xl sm:text-2xl font-bold text-orange-600 truncate"><AnimatedNumber value={chartData?.summary?.totalBreakfast ?? 0} /></p>
                    </div>
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                      <i className="ri-restaurant-line text-xl text-orange-600"></i>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-xl border border-green-100 p-3 sm:p-4 flex items-center justify-between min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-green-700 mb-0.5">Lunch</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600 truncate"><AnimatedNumber value={chartData?.summary?.totalLunch ?? 0} /></p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                      <i className="ri-bowl-line text-xl text-green-600"></i>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl border border-blue-100 p-3 sm:p-4 flex items-center justify-between min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-blue-700 mb-0.5">Trans</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600 truncate"><AnimatedNumber value={chartData?.summary?.totalTransactions ?? 0} /></p>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                      <i className="ri-receipt-line text-xl text-blue-600"></i>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 sm:p-4 flex items-center justify-between min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 mb-0.5">Amount</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">₹<AnimatedNumber value={chartData?.summary?.totalAmount ?? 0} /></p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <i className="ri-money-rupee-circle-line text-xl text-gray-600"></i>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* Recent transactions – paginated, latest first */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-0">
          <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recent transactions</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {txTotal === 0
                  ? "No transactions yet"
                  : `Showing ${txStart}–${txEnd} of ${txTotal} (latest first)`}
              </p>
            </div>
            {txTotal > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600">
                  <span>Per page</span>
                  <select
                    value={txPerPage}
                    onChange={(e) => {
                      setTxPerPage(Number(e.target.value));
                      setTxPage(1);
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {[5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            {txTotal === 0 ? (
              <div className="px-3 sm:px-6 py-12 text-center">
                <i className="ri-file-list-3-line text-4xl text-gray-300 mb-3"></i>
                <p className="text-gray-500 font-medium">No transactions yet</p>
              </div>
            ) : (
              <>
                <table className="w-full min-w-[320px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-900 whitespace-nowrap">{tx.date}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 whitespace-nowrap">{tx.time}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 break-words max-w-[120px] sm:max-w-none">
                          {(tx.items || []).map((i) => `${i.name} × ${i.quantity}`).join(", ") || "—"}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-900 text-right whitespace-nowrap">₹{tx.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txTotalPages > 1 && (
                  <div className="p-3 sm:p-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm text-gray-600">
                      Page {txPageClamped} of {txTotalPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={txPageClamped <= 1}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                        disabled={txPageClamped >= txTotalPages}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
