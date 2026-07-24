import { Navigate, useLocation } from "react-router-dom";
import { isEmployeeAuthenticated } from "../api/client";

interface EmployeeProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protects employee routes: redirects to /employee/login if not logged in as employee.
 * Uses replace so the protected URL is not left in history (back button won't return to it).
 */
export default function EmployeeProtectedRoute({ children }: EmployeeProtectedRouteProps) {
  const location = useLocation();
  const isEmployee = isEmployeeAuthenticated();

  if (!isEmployee) {
    return <Navigate to="/employee/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
