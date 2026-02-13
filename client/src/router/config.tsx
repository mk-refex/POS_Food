
import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import Login from "../pages/login/page";
import Dashboard from "../pages/dashboard/page";
import Billing from "../pages/billing/page";
import SelfBillingPage from "../pages/billing/SelfBillingPage";
import Master from "../pages/master/page";
import Reports from "../pages/reports/page";
import AdminPanel from "../pages/admin/page";
import ProtectedRoute from "../components/ProtectedRoute";
import EmployeeLoginPage from "../pages/employee/LoginPage";
import EmployeeCallbackPage from "../pages/employee/CallbackPage";
import EmployeeDashboardPage from "../pages/employee/DashboardPage";
import EmployeeMenuPage from "../pages/employee/MenuPage";
import EmployeeFeedbackPage from "../pages/employee/FeedbackPage";
import EmployeeProfilePage from "../pages/employee/ProfilePage";
import EmployeeProtectedRoute from "../components/EmployeeProtectedRoute";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/employee/login",
    element: <EmployeeLoginPage />,
  },
  {
    path: "/employee/callback",
    element: <EmployeeCallbackPage />,
  },
  {
    path: "/employee/dashboard",
    element: (
      <EmployeeProtectedRoute>
        <EmployeeDashboardPage />
      </EmployeeProtectedRoute>
    ),
  },
  {
    path: "/employee/menu",
    element: (
      <EmployeeProtectedRoute>
        <EmployeeMenuPage />
      </EmployeeProtectedRoute>
    ),
  },
  {
    path: "/employee/profile",
    element: (
      <EmployeeProtectedRoute>
        <EmployeeProfilePage />
      </EmployeeProtectedRoute>
    ),
  },
  {
    path: "/employee/feedback",
    element: (
      <EmployeeProtectedRoute>
        <EmployeeFeedbackPage />
      </EmployeeProtectedRoute>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/billing",
    element: (
      <ProtectedRoute>
        <Billing />
      </ProtectedRoute>
    ),
  },
      {
        path: "/billing/self",
        element: (
          <ProtectedRoute>
            <SelfBillingPage />
          </ProtectedRoute>
        ),
      },
  {
    path: "/master",
    element: (
      <ProtectedRoute>
        <Master />
      </ProtectedRoute>
    ),
  },
  {
    path: "/reports",
    element: (
      <ProtectedRoute>
        <Reports />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <AdminPanel />
      </ProtectedRoute>
    ),
  },
  {
    path: "/home",
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
