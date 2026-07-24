import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setEmployeeSession } from "../../api/client";

/**
 * Handles redirect from Google OAuth callback. Backend sends token and employee in query params.
 * Stores session and redirects to dashboard.
 */
export default function EmployeeCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const employeeStr = searchParams.get("employee");

  useEffect(() => {
    if (!token || !employeeStr) {
      navigate("/employee/login", { replace: true });
      return;
    }
    try {
      const employee = JSON.parse(decodeURIComponent(employeeStr));
      setEmployeeSession(token, employee);
      navigate("/employee/dashboard", { replace: true });
    } catch {
      navigate("/employee/login", { replace: true });
    }
  }, [token, employeeStr, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Signing you in…</p>
    </div>
  );
}
