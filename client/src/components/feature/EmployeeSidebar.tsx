import { useNavigate, useLocation } from "react-router-dom";
import { clearEmployeeSession } from "../../api/client";
import refexLogo from "../../assets/refex-logo.png";

interface EmployeeSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: "ri-dashboard-line", path: "/employee/dashboard" },
  { id: "menu", label: "Food Menu", icon: "ri-restaurant-line", path: "/employee/menu" },
  { id: "feedback", label: "Feedback & Review", icon: "ri-star-smile-line", path: "/employee/feedback" },
];

export default function EmployeeSidebar({ isOpen, onToggle }: EmployeeSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearEmployeeSession();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300"
          onClick={onToggle}
        />
      )}

      <div
        className={`fixed left-0 top-0 h-full bg-white shadow-xl z-50 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:z-auto w-56 lg:shadow-lg`}
      >
        <div className="p-2 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <img src={refexLogo} alt="Refex Logo" className="h-11 w-28 object-contain" />
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg text-gray-600"></i>
          </button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    navigate(item.path);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap group ${
                    location.pathname === item.path
                      ? "bg-blue-50 text-blue-700 shadow-sm border-l-4 border-blue-600"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <i
                    className={`${item.icon} text-lg mr-2 ${
                      location.pathname === item.path ? "text-blue-600" : "text-gray-500 group-hover:text-gray-700"
                    }`}
                  ></i>
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap group"
          >
            <i className="ri-logout-box-line text-lg mr-2 group-hover:text-red-700"></i>
            <span className="font-medium text-sm group-hover:text-red-700">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
