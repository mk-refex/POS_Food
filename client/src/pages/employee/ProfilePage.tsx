import { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/feature/EmployeeLayout';
import { apiFetchEmployee, getEmployeeUser } from '../../api/client';
import refexLogo from '../../assets/refex-logo.png';

export default function EmployeeProfilePage() {
  const session = getEmployeeUser();
  const employeeId = session?.employeeId || null;
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(session || null);
  // always use centered modal for QR (no fullscreen)

  useEffect(() => {
    const load = async () => {
      if (!employeeId) return;
      try {
        setLoading(true);
        const data = await apiFetchEmployee('/employee/profile');
        setUser(data);
      } catch {
        // keep session data as fallback
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [employeeId]);

  const qrSrc = user?.qrCode || '';

  // QR view and download removed

  const openFullscreen = () => {
    setShowModal(true);
  };

  return (
    <EmployeeLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center">
                {qrSrc ? (
                  <img src={qrSrc} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-gray-400 text-center">
                    <i className="ri-qr-code-line text-4xl"></i>
                    <div className="text-sm mt-2">No QR available</div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => openFullscreen()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  View QR
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <h2 className="text-lg font-medium text-gray-800 mb-3">{user?.employeeName || 'Employee'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Employee ID</div>
                  <div className="text-sm text-gray-900">{user?.employeeId || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Company</div>
                  <div className="text-sm text-gray-900">{user?.companyName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="text-sm text-gray-900">{user?.email || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Mobile</div>
                  <div className="text-sm text-gray-900">{user?.mobileNumber || '-'}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-gray-500">Notes</div>
                  <div className="text-sm text-gray-900">Keep your QR code private. If lost, contact admin to regenerate.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen modal (also supports browser fullscreen API) */}
      {showModal && (
        <div
          id="qr-fullscreen"
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm"
        >
          <div
            className="bg-white rounded-md p-6 shadow-lg max-w-sm w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
            {qrSrc ? (
              <div className="flex flex-col items-center">
                <img src={qrSrc} alt="QR" className="w-56 h-56 object-contain mb-4" />
                <div className="flex flex-col items-center gap-2 mb-3">
                  <img src={refexLogo} alt="Logo" className="h-10 object-contain" />
                  <div className="text-sm text-gray-700">Employee ID: <span className="font-medium">{user?.employeeId || '-'}</span></div>
                </div>
                <div />
              </div>
            ) : (
              <div className="text-gray-600 text-center">No QR available</div>
            )}
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}

