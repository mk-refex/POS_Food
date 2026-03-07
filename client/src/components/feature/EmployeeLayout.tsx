import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeSidebar from "./EmployeeSidebar";
import Footer from "../Footer";
import { getEmployeeUser, clearEmployeeSession } from "../../api/client";

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

export default function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ employeeName: string; employeeId: string; companyName?: string } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("app_theme");
    return saved === "dark" ? "dark" : "light";
  });
  const [now, setNow] = useState<Date>(new Date());
  const formatClock = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = getEmployeeUser();
    if (!currentUser) {
      navigate("/employee/login");
    } else {
      setUser(currentUser);
    }
  }, [navigate]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      clearEmployeeSession();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <EmployeeSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-2">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <i className="ri-menu-line text-xl text-gray-600"></i>
            </button>

            <div className="flex items-center space-x-4 w-full">
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block mr-auto">
                {now.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                {formatClock(now)}
              </div>
              <div className="text-xs text-gray-600 sm:hidden mr-auto">
                {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {formatClock(now)}
              </div>

              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                <i className={theme === "dark" ? "ri-sun-line text-amber-500" : "ri-moon-line text-gray-600"}></i>
              </button>

              {user && (
                <div className="flex items-center space-x-3 ml-auto">
                  <div className="text-right mr-2">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-[100px] sm:max-w-none">{user.employeeName}</div>
                    <div className="text-xs text-gray-500">{user.employeeId}</div>
                  </div>
                  <button
                    onClick={() => window.location.href = '/employee/profile'}
                    title="View profile"
                    className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors text-gray-600"
                  >
                    <i className="ri-user-line text-lg"></i>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors text-gray-600 hover:text-red-600"
                    title="Logout"
                  >
                    <i className="ri-logout-box-line text-lg"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4">
          {children}
          <div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
}
