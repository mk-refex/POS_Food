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

export default function GuestsPage() {
  const [list, setList] = useState<GuestRow[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [qrGuest, setQrGuest] = useState<GuestRow | null>(null);
  const [downloadGuest, setDownloadGuest] = useState<GuestRow | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const downloadContainerRef = useRef<HTMLDivElement>(null);

  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [formNoExpiry, setFormNoExpiry] = useState(false);

  const [bulkRows, setBulkRows] = useState<Array<{ name: string; companyName: string; expirationDate: string; noExpiry: boolean }>>([
    { name: "", companyName: "", expirationDate: "", noExpiry: false },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [expiringId, setExpiringId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
    setFormName("");
    setFormCompany(defaultCompany());
    setFormExpiry("");
    setFormNoExpiry(false);
    setAddOpen(true);
  };

  const openBulk = () => {
    setBulkRows([{ name: "", companyName: defaultCompany(), expirationDate: "", noExpiry: false }]);
    setBulkOpen(true);
  };

  const addRow = () => {
    setBulkRows((r) => [...r, { name: "", companyName: defaultCompany(), expirationDate: "", noExpiry: false }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkRows.length <= 1) return;
    setBulkRows((r) => r.filter((_, i) => i !== index));
  };

  const updateBulkRow = (index: number, field: string, value: string | boolean) => {
    setBulkRows((r) => r.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const submitSingle = async () => {
    const name = formName.trim();
    const company = formCompany.trim();
    if (!name || !company) {
      setError("Name and company are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetchEmployee("/employee/guests", {
        method: "POST",
        body: JSON.stringify({
          name,
          companyName: company,
          expirationDate: formNoExpiry ? null : (formExpiry || null),
        }),
      });
      setAddOpen(false);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create guest");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBulk = async () => {
    const guests = bulkRows
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
    setSubmitting(true);
    setError(null);
    try {
      await apiFetchEmployee("/employee/guests", {
        method: "POST",
        body: JSON.stringify({ guests }),
      });
      setBulkOpen(false);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create guests");
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <i className="ri-user-add-line mr-1" /> Add Guest
            </button>
            <button
              type="button"
              onClick={openBulk}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <i className="ri-group-line mr-1" /> Bulk Create
            </button>
          </div>
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

      {/* Add single guest modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Guest</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Guest name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company *</label>
                <select
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {companyOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formNoExpiry} onChange={(e) => setFormNoExpiry(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">No expiry</span>
                </label>
              </div>
              {!formNoExpiry && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expiration date</label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Cancel
              </button>
              <button type="button" onClick={submitSingle} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk create modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 my-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Bulk Create Guests</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {bulkRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-gray-700/30">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateBulkRow(idx, "name", e.target.value)}
                    placeholder="Name"
                    className="flex-1 min-w-[100px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={row.companyName}
                    onChange={(e) => updateBulkRow(idx, "companyName", e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {companyOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={row.noExpiry} onChange={(e) => updateBulkRow(idx, "noExpiry", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    No expiry
                  </label>
                  {!row.noExpiry && (
                    <input
                      type="date"
                      value={row.expirationDate}
                      onChange={(e) => updateBulkRow(idx, "expirationDate", e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                  <button type="button" onClick={() => removeBulkRow(idx)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Remove row">
                    <i className="ri-close-line text-lg" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addRow} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
              + Add row
            </button>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Cancel
              </button>
              <button type="button" onClick={submitBulk} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                {submitting ? "Creating…" : "Create all"}
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
