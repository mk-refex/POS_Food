import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../api/client";
import refexLogo from "../../assets/refex-logo.png";

interface MenuItem {
  name: string;
  description?: string;
}

interface FeedbackSession {
  mealType: "breakfast" | "lunch";
  menuItems: MenuItem[];
  alreadySubmitted: boolean;
}

interface SessionData {
  employeeId: string;
  employeeName: string;
  companyName: string | null;
  date: string;
  consumed: { breakfast: boolean; lunch: boolean };
  feedbackGiven: { breakfast: boolean; lunch: boolean };
  sessions: FeedbackSession[];
}

type ItemRatings = Record<string, number>;

async function publicApi(path: string, options: RequestInit = {}) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

function mealLabel(meal: string) {
  return meal === "lunch" ? "Lunch" : "Breakfast";
}

function initRatings(sessions: FeedbackSession[]) {
  const initial: Record<string, ItemRatings> = {};
  for (const s of sessions) {
    if (!s.alreadySubmitted) {
      initial[s.mealType] = {};
      for (const it of s.menuItems) {
        initial[s.mealType][it.name] = 0;
      }
    }
  }
  return initial;
}

export default function MenuFeedbackPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [ratingsByMeal, setRatingsByMeal] = useState<Record<string, ItemRatings>>({});
  const [submittingMeal, setSubmittingMeal] = useState<string | null>(null);
  const [submittedMeals, setSubmittedMeals] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data: SessionData = await publicApi(
          `/public/feedback/session?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        setSession(data);
        setRatingsByMeal(initRatings(data.sessions));
        setSubmittedMeals(
          new Set(data.sessions.filter((s) => s.alreadySubmitted).map((s) => s.mealType)),
        );
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Could not open this feedback link.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggleItemRating = (mealType: string, itemName: string, r: number) => {
    const current = ratingsByMeal[mealType]?.[itemName] ?? 0;
    setRatingsByMeal((prev) => ({
      ...prev,
      [mealType]: {
        ...prev[mealType],
        [itemName]: current === r ? 0 : r,
      },
    }));
  };

  const handleSubmitMeal = async (s: FeedbackSession) => {
    if (!token || !session) return;
    setSubmittingMeal(s.mealType);
    setError("");
    setSuccess("");
    try {
      const items = s.menuItems.map((it) => ({
        name: it.name,
        rating: ratingsByMeal[s.mealType]?.[it.name] ?? 0,
      }));
      await publicApi("/public/feedback", {
        method: "POST",
        body: JSON.stringify({ token, mealType: s.mealType, items }),
      });
      setSubmittedMeals((prev) => new Set([...prev, s.mealType]));
      setRatingsByMeal((prev) => {
        const next = { ...prev };
        delete next[s.mealType];
        return next;
      });
      setSuccess(`${mealLabel(s.mealType)} feedback submitted. Thank you!`);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback");
    } finally {
      setSubmittingMeal(null);
    }
  };

  const allDone =
    session &&
    session.sessions.every(
      (s) => s.alreadySubmitted || submittedMeals.has(s.mealType),
    );

  if (!token) {
    return (
      <PageShell>
        <Card>
          <InvalidLink message="This page can only be opened from the personal feedback link in your food billing email." />
        </Card>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <Card>
          <div className="p-12 text-center text-gray-600">
            <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading your menu feedback…</p>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (error && !session) {
    return (
      <PageShell>
        <Card>
          <InvalidLink message={error} />
        </Card>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <Card>
          <InvalidLink message="Unable to load feedback. Please use the link from your email." />
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Menu feedback</h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          Hi {session.employeeName.split(" ")[0] || "there"} — rate the menu for{" "}
          <strong>{session.date}</strong>
        </p>
      </div>

      <Card>
        <div className="p-6 sm:p-8 space-y-6">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
            <p className="font-semibold text-gray-900">{session.employeeName}</p>
            <p className="text-gray-600">
              {session.employeeId}
              {session.companyName ? ` · ${session.companyName}` : ""}
            </p>
            <p className="text-gray-500 text-xs mt-2">
              {session.consumed.breakfast && session.consumed.lunch
                ? "Rate breakfast and lunch below (only meals you consumed)."
                : session.consumed.breakfast
                  ? "Rate your breakfast menu below."
                  : "Rate your lunch menu below."}
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">
              {success}
            </div>
          )}

          {session.sessions.map((s) => {
            const done = s.alreadySubmitted || submittedMeals.has(s.mealType);
            return (
              <section
                key={s.mealType}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
                  <h2 className="font-semibold">{mealLabel(s.mealType)}</h2>
                  {done && (
                    <span className="text-xs bg-emerald-500/90 px-2 py-0.5 rounded-full">
                      Submitted
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  {s.alreadySubmitted ? (
                    <p className="text-sm text-gray-500 italic">
                      You already submitted feedback for this meal.
                    </p>
                  ) : done ? (
                    <p className="text-sm text-emerald-700 font-medium">
                      Thank you — feedback saved for {mealLabel(s.mealType).toLowerCase()}.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        Rate each item (optional — tap the same number again to clear):
                      </p>
                      <ul className="space-y-3">
                        {s.menuItems.map((it) => (
                          <li
                            key={it.name}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gray-100 rounded-lg p-3"
                          >
                            <div>
                              <span className="font-medium text-gray-900">{it.name}</span>
                              {it.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{it.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => toggleItemRating(s.mealType, it.name, r)}
                                  className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                                    (ratingsByMeal[s.mealType]?.[it.name] ?? 0) === r
                                      ? "bg-amber-500 text-white"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  }`}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={submittingMeal === s.mealType}
                        onClick={() => handleSubmitMeal(s)}
                        className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submittingMeal === s.mealType
                          ? "Submitting…"
                          : `Submit ${mealLabel(s.mealType)} feedback`}
                      </button>
                    </>
                  )}
                </div>
              </section>
            );
          })}

          {allDone && (
            <p className="text-center text-sm text-emerald-700 font-medium pt-2">
              All available feedback submitted. Thank you!
            </p>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-gray-500 mt-6">
        This link is personal to your billing record for {session.date}.<br />
        <a href="https://refex.group" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
          Powered by Refex AI Team
        </a>
      </p>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <img src={refexLogo} alt="Refex" className="h-12 mx-auto mb-4 object-contain" />
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {children}
    </div>
  );
}

function InvalidLink({ message }: { message: string }) {
  return (
    <div className="p-8 sm:p-10 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
        <i className="ri-link-unlink text-2xl text-amber-700" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Link required</h2>
      <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">{message}</p>
    </div>
  );
}
