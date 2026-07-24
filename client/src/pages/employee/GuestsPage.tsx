import { useState, useEffect, useRef, useMemo } from "react";
import EmployeeLayout from "../../components/feature/EmployeeLayout";
import { apiFetchEmployee, getEmployeeUser } from "../../api/client";
import { useSocketEvent } from "../../contexts/SocketContext";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";
import Pagination from "../../components/Pagination";

interface GuestRow {
  id: number;
  name: string;
  companyName: string;
  createdDate: string;
  expirationDate: string | null;
  status: "active" | "expired";
}

function getTodayLocalDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function GuestsPage() {
  const [list, setList] = useState<GuestRow[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [qrGuest, setQrGuest] = useState<GuestRow | null>(null);
  const [downloadGuest, setDownloadGuest] = useState<GuestRow | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const downloadContainerRef = useRef<HTMLDivElement>(null);

  const [guestRows, setGuestRows] = useState<Array<{ name: string; companyName: string; expirationDate: string; noExpiry: boolean }>>([
    { name: "", companyName: "", expirationDate: "", noExpiry: false },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [expiringId, setExpiringId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const todayLocal = getTodayLocalDate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [guestsRes, companiesRes] = await Promise.all([
        apiFetchEmployee("/employee/guests"),
        apiFetchEmployee("/employee/guest-companies"),
      ]);
      setList(Array.isArray(guestsRes) ? guestsRes : []);
      setCompanies(Array.isArray(companiesRes) ? companiesRes : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useSocketEvent("master:updated", load);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(list.length / itemsPerPage));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [list.length, itemsPerPage, currentPage]);

  const empCompany = (() => {
    const user = getEmployeeUser() as { companyName?: string } | null;
    return user?.companyName?.trim() || "";
  })();
  const companyOptions = empCompany && !companies.includes(empCompany)
    ? [empCompany, ...companies]
    : companies;

  const defaultCompany = () => {
    if (empCompany && (companies.includes(empCompany) || companyOptions.includes(empCompany))) return empCompany;
    return companies[0] || "";
  };

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return list.slice(start, start + itemsPerPage);
  }, [list, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handleItemsPerPageChange = (perPage: number) => {
    setItemsPerPage(perPage);
    setCurrentPage(1);
  };

  const openAdd = () => {
    setGuestRows([{ name: "", companyName: defaultCompany(), expirationDate: "", noExpiry: false }]);
    setAddOpen(true);
  };

  const addGuestRow = () => {
    setGuestRows((r) => [...r, { name: "", companyName: defaultCompany(), expirationDate: "", noExpiry: false }]);
  };

  const removeGuestRow = (index: number) => {
    if (guestRows.length <= 1) return;
    setGuestRows((r) => r.filter((_, i) => i !== index));
  };

  const updateGuestRow = (index: number, field: string, value: string | boolean) => {
    setGuestRows((r) =>
      r.map((row, i) => {
        if (i !== index) return row;
        if (field === "noExpiry" && value === true) {
          return { ...row, noExpiry: true, expirationDate: "" };
        }
        return { ...row, [field]: value };
      }),
    );
  };

  const submitGuests = async () => {
    const today = getTodayLocalDate();
    const guests = guestRows
      .map((r) => ({
        name: r.name.trim(),
        companyName: r.companyName.trim(),
        expirationDate: r.noExpiry ? null : (r.expirationDate || null),
      }))
      .filter((g) => g.name && g.companyName);
    if (guests.length === 0) {
      setError("Add at least one guest with name and company");
      return;
    }
    const missingExpiry = guestRows.some(
      (r) => r.name.trim() && r.companyName.trim() && !r.noExpiry && !r.expirationDate,
    );
    if (missingExpiry) {
      setError("Select an expiration date or check No expiry");
      return;
    }
    const pastExpiry = guests.some((g) => g.expirationDate && g.expirationDate < today);
    if (pastExpiry) {
      setError("Expiration date cannot be in the past");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (guests.length === 1) {
        await apiFetchEmployee("/employee/guests", {
          method: "POST",
          body: JSON.stringify(guests[0]),
        });
      } else {
        await apiFetchEmployee("/employee/guests", {
          method: "POST",
          body: JSON.stringify({ guests }),
        });
      }
      setAddOpen(false);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create guest(s)");
    } finally {
      setSubmitting(false);
    }
  };

  const qrValue = (guest: GuestRow) => (guest.status === "active" ? `GUEST:${guest.id}` : null);

  const expireGuest = async (guest: GuestRow) => {
    if (guest.status !== "active") return;
    setExpiringId(guest.id);
    setError(null);
    try {
      await apiFetchEmployee(`/employee/guests/${guest.id}/expire`, { method: "PATCH" });
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to expire guest");
    } finally {
      setExpiringId(null);
    }
  };

  const downloadQr = async (guest: GuestRow) => {
    if (guest.status !== "active") return;
    const fileName = `guest-qr-${guest.id}-${guest.name.replace(/\s+/g, "-")}.png`;
    const captureFromRef = (el: HTMLDivElement) =>
      html2canvas(el, { useCORS: true, backgroundColor: "#ffffff", scale: 2 }).then((canvas) => {
        const data = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = data;
        a.download = fileName;
        a.click();
      });

    if (qrGuest?.id === guest.id && qrContainerRef.current) {
      await captureFromRef(qrContainerRef.current);
      return;
    }
    setDownloadGuest(guest);
  };

  useEffect(() => {
    if (!downloadGuest || !downloadContainerRef.current) return;
    const el = downloadContainerRef.current;
    const timer = setTimeout(() => {
      html2canvas(el, { useCORS: true, backgroundColor: "#ffffff", scale: 2 })
        .then((canvas) => {
          const data = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = data;
          a.download = `guest-qr-${downloadGuest.id}-${downloadGuest.name.replace(/\s+/g, "-")}.png`;
          a.click();
        })
        .finally(() => setDownloadGuest(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [downloadGuest]);

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Guests</h1>
          <button
              type="button"
              onClick={openAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <i className="ri-user-add-line mr-1" /> Add Guest
            </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-gray-500 dark:text-gray-400">
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-8 text-center text-gray-500 dark:text-gray-400">
            No guests yet. Create one to generate a QR code for self-billing.
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Company</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Created</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Expires</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedList.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{g.name}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{g.companyName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.createdDate}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.expirationDate || "No expiry"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                            g.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {g.status === "active" ? "Active" : "Expired"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {g.status === "active" ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQrGuest(g)}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadQr(g)}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={() => expireGuest(g)}
                              disabled={expiringId === g.id}
                              className="text-amber-600 dark:text-amber-400 hover:underline font-medium disabled:opacity-50"
                            >
                              {expiringId === g.id ? "Expiring…" : "Expire"}
                            </button>
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              totalItems={list.length}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        )}
      </div>

      {/* Add guest modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl p-4 sm:p-6 my-4 sm:my-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Guest</h2>

            <div className="hidden md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(14rem,1.5fr)_2.5rem] gap-3 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>Name</span>
              <span>Company</span>
              <span>Expiration</span>
              <span className="sr-only">Remove</span>
            </div>

            <div className="space-y-3 max-h-[min(24rem,60vh)] overflow-y-auto">
              {guestRows.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-gray-700/30"
                >
                  <div className="md:hidden flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Guest {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeGuestRow(idx)}
                      disabled={guestRows.length <= 1}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30"
                      title="Remove guest"
                    >
                      <i className="ri-close-line text-lg" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(14rem,1.5fr)_2.5rem] gap-3 md:items-center">
                    <div className="min-w-0">
                      <label className="md:sr-only block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateGuestRow(idx, "name", e.target.value)}
                        placeholder="Name"
                        className="w-full min-w-0 h-[38px] px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="min-w-0">
                      <label className="md:sr-only block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company</label>
                      <select
                        value={row.companyName}
                        onChange={(e) => updateGuestRow(idx, "companyName", e.target.value)}
                        className="w-full min-w-0 h-[38px] px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {companyOptions.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="min-w-0">
                      <label className="md:sr-only block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Expiration</label>
                      <div className="flex flex-col sm:flex-row md:flex-row items-stretch sm:items-center gap-2 min-h-[38px]">
                        <label className="inline-flex items-center gap-2 h-[38px] shrink-0 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={row.noExpiry}
                            onChange={(e) => updateGuestRow(idx, "noExpiry", e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">No expiry</span>
                        </label>
                        {!row.noExpiry && (
                          <input
                            type="date"
                            value={row.expirationDate}
                            min={todayLocal}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value && value < todayLocal) return;
                              updateGuestRow(idx, "expirationDate", value);
                            }}
                            className="w-full min-w-0 h-[38px] flex-1 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        )}
                      </div>
                      {!row.noExpiry && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 md:hidden">
                          Valid through selected date (expires the next day)
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeGuestRow(idx)}
                      disabled={guestRows.length <= 1}
                      className="hidden md:flex h-[38px] w-[38px] items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30 justify-self-center"
                      title="Remove guest"
                    >
                      <i className="ri-close-line text-lg" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="hidden md:block mt-2 px-1 text-xs text-gray-500 dark:text-gray-400">
              Expiration is the last valid day. Selecting today allows access only today; the guest expires tomorrow.
            </p>

            <button
              type="button"
              onClick={addGuestRow}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <i className="ri-user-add-line mr-1" /> Add Guest
            </button>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitGuests}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {submitting ? "Creating…" : guestRows.length > 1 ? "Create all" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden div for QR download when triggered from table */}
      {downloadGuest && (
        <div
          ref={downloadContainerRef}
          style={{ position: "absolute", left: "-9999px", top: 0, background: "#fff", padding: 16, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}
          className="qr-download-source"
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#111" }}>{downloadGuest.name}</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>{downloadGuest.companyName}</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <QRCodeCanvas value={`GUEST:${downloadGuest.id}`} size={200} />
          </div>
        </div>
      )}

      {/* QR view modal */}
      {qrGuest && qrValue(qrGuest) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setQrGuest(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 text-center border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div ref={qrContainerRef} className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{qrGuest.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{qrGuest.companyName}</p>
              <div style={{ display: "flex", justifyContent: "center" }}>
              <QRCodeCanvas value={qrValue(qrGuest)!} size={200} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Scan at self-billing to bill this guest</p>
            </div>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => downloadQr(qrGuest)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Download
              </button>
              <button type="button" onClick={() => setQrGuest(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}
