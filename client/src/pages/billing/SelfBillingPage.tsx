import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getCurrentUser } from "../../api/client";
import Footer from "../../components/Footer";
import refexLogo from "../../assets/refex-logo.png";
import { buildReceiptHtml } from "./receiptBuilder";

function extractEmployeeIdFromUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    // fallback: take last segment after slash
    const m = url.trim().split("/").filter(Boolean);
    return m.length ? m[m.length - 1] : null;
  }
}

export default function SelfBillingPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lockedRef = useRef<boolean>(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(5);
  const [processing, setProcessing] = useState(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const timerRef = useRef<any>(null);
  const scanAutoTimer = useRef<any>(null);
  const [todayMenu, setTodayMenu] = useState<{
    breakfast?: any[];
    lunch?: any[];
  }>({});
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // digital clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (preview && !modalOpen) {
      setCountdown(5);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timerRef.current);
            // auto-confirm only when modal is not open (i.e., no warnings)
            handleConfirm();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [preview, modalOpen]);

  const processScanned = async (v: string) => {
    const val = v.trim();
    if (lockedRef.current) return;
    if (!val) return;
    if (!val.includes("http") && !val.includes("/vcard/")) return;
    setError(null);
    const empId = extractEmployeeIdFromUrl(val);
    if (!empId) {
      setError("Unable to parse employee ID from scanned URL");
      return;
    }
    // lock to avoid duplicate preview/confirm flows
    lockedRef.current = true;
    try {
      const res = await apiFetch(
        `/employee-auth/self-bill/preview?employeeId=${encodeURIComponent(empId)}`,
      );
      setPreview(res);
      // open modal if server returned warnings (already billed)
      if (res && ((res.warnings && Object.keys(res.warnings).length > 0) || res.warnings?.priorException)) {
        setModalOpen(true);
      } else {
        setModalOpen(false);
      }
    } catch (err: any) {
      setError(err?.message || "Preview failed");
      lockedRef.current = false;
    }
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  const handleScanInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.target as HTMLInputElement;
    if (e.key === "Enter") {
      await processScanned(el.value);
      return;
    }
    if (scanAutoTimer.current) clearTimeout(scanAutoTimer.current);
    scanAutoTimer.current = setTimeout(() => {
      processScanned(el.value);
    }, 120);
  };

  useEffect(() => {
    // load today's menu preview
    const load = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await apiFetch(
          `/masters/menus?startDate=${today}&endDate=${today}`,
        );
        const arr = Array.isArray(res) ? res : [];
        const b = arr.find((m: any) => m.mealType === "breakfast")?.items ?? [];
        const l = arr.find((m: any) => m.mealType === "lunch")?.items ?? [];
        setTodayMenu({ breakfast: b, lunch: l });
      } catch (e) {
        // ignore
      }
    };
    load();
  }, []);

  const handleCancel = () => {
    clearInterval(timerRef.current);
    setPreview(null);
    setCountdown(5);
    inputRef.current?.focus();
    setModalOpen(false);
    lockedRef.current = false;
  };

  const handleConfirm = async (forceException: boolean = false) => {
    if (!preview) return;
    // If modal is open, user must accept explicitly — modalAccept will call this handler
    if (modalOpen) setModalOpen(false);
    if (processing) return;
    setProcessing(true);
    try {
      const currentUser = getCurrentUser();
      const res = await fetch(
        `${(import.meta as any).env.VITE_API_URL || "http://localhost:5000/api"}/employee-auth/self-bill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: preview.employee.employeeId,
            quantity: 1,
            userId: currentUser?.id ?? currentUser?.userId ?? undefined,
            forceException: !!forceException,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Billing failed");
      const trx = data.transaction;
      // build receipt html and open print window
      const billingData = {
        id: trx.id,
        date: trx.date,
        time: trx.time,
        customer: {
          employeeName: trx.customerName,
          companyName: trx.companyName,
        },
        items: trx.items,
        totalItems: trx.totalItems,
        totalAmount: trx.totalAmount,
      };
      const html = buildReceiptHtml(billingData);
      // Print via hidden iframe (more reliable than popup)
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        const printAndCleanup = () => {
          try {
            const win = iframe.contentWindow;
            if (win) {
              win.focus();
              win.print();
            }
          } catch (e) {
            console.error("Print error:", e);
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe))
                document.body.removeChild(iframe);
            }, 800);
          }
        };
        if (doc.readyState === "complete") printAndCleanup();
        else iframe.onload = printAndCleanup;
      } else {
        // fallback to popup
        const w = window.open("", "_blank", "noopener,noreferrer");
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => {
            w.print();
            w.close();
          }, 500);
        }
      }
      setPreview(null);
      setError(null);
      lockedRef.current = false;
    } catch (err: any) {
      setError(err?.message || "Billing failed");
    } finally {
      setProcessing(false);
      inputRef.current?.focus();
    }
  };

  // use shared receipt builder

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* header - subtle, no solid bg */}
        <div className="flex items-center justify-between py-3 mb-6">
          <div className="flex items-center gap-4">
            <img src={refexLogo} alt="Refex" className="h-12 object-contain" />
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="text-lg font-medium">
              {now.toLocaleTimeString()}
            </div>
          </div>
          <div>
            <button
              onClick={() => navigate("/billing")}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Menu - full height and scroll if needed */}
          <div className="bg-white rounded-lg shadow p-6 h-full min-h-[60vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-3">Today's Menu</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <h4 className="text-sm font-medium text-orange-600 mb-2">
                  Breakfast
                </h4>
                {todayMenu.breakfast && todayMenu.breakfast.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-700">
                    {todayMenu.breakfast.map((it: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">{it.name}</span>
                        {it.description ? ` — ${it.description}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">
                    No breakfast published
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-2">
                  Lunch
                </h4>
                {todayMenu.lunch && todayMenu.lunch.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-700">
                    {todayMenu.lunch.map((it: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">{it.name}</span>
                        {it.description ? ` — ${it.description}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No lunch published</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Scan & employee details */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg shadow p-6 flex-1">
              <div className="flex flex-col items-center">
                <div className="w-40 h-40 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
                  {/* simple QR icon */}
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="8"
                      height="8"
                      stroke="#111827"
                      strokeWidth="1.2"
                      fill="#fff"
                    />
                    <rect
                      x="14"
                      y="2"
                      width="8"
                      height="8"
                      stroke="#111827"
                      strokeWidth="1.2"
                      fill="#fff"
                    />
                    <rect
                      x="2"
                      y="14"
                      width="8"
                      height="8"
                      stroke="#111827"
                      strokeWidth="1.2"
                      fill="#fff"
                    />
                    <rect x="9" y="9" width="6" height="6" fill="#111827" />
                  </svg>
                </div>
                <p className="text-lg font-medium">Scan your QR code to bill</p>
                <p className="text-sm text-gray-500 mt-2">
                  Show the QR on your phone — the connected barcode scanner will
                  read it automatically.
                </p>
                <input
                  ref={inputRef}
                  onKeyDown={handleScanInput}
                  className="opacity-0 absolute left-0 top-0"
                />
                {error && <div className="text-red-600 mt-4">{error}</div>}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              {preview ? (
                <>
                  <h3 className="text-lg font-semibold mb-3">Employee</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 text-sm text-gray-700">
                      <div className="font-medium">
                        {preview.employee.employeeName}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {preview.employee.employeeId}
                      </div>
                      <div className="text-xs text-gray-500">
                        Company: {preview.employee.companyName}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">
                      <div className="mb-2">
                        <span className="font-medium">Meal:</span>{" "}
                        {preview.meal} •{" "}
                        <span className="font-medium">₹{preview.price}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Monthly • BF:{" "}
                        {preview.monthlySummary?.breakfastCount || 0} · Lunch:{" "}
                        {preview.monthlySummary?.lunchCount || 0}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCancel}
                        disabled={processing}
                        className="px-4 py-2 border rounded text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleConfirm(false)}
                        disabled={processing}
                        className="px-4 py-2 bg-indigo-600 text-white rounded text-sm"
                      >
                        Confirm ({countdown})
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  Employee details will appear here after scan.
                </div>
              )}
            </div>
          </div>
        </div>
        {modalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-2">Confirm Billing</h3>
              <p className="text-sm text-gray-700 mb-4">
                It appears this meal may have already been billed for today.
                {preview?.warnings?.priorException ? (
                  <> A prior billing exists with an exception flag for this meal.</>
                ) : null}
                Do you want to proceed? If this wasn't you, please contact your administrator.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    handleCancel();
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    // call confirm to proceed with exception flag
                    void handleConfirm(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        )}
        <Footer />
      </div>
    </div>
  );
}
