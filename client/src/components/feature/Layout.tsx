
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { getCurrentUser, logout } from '../../api/client';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app_theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate('/login');
    } else {
      setUser(currentUser);
    }
  }, [navigate]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header - Reduced padding */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-2">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <i className="ri-menu-line text-xl text-gray-600"></i>
            </button>
            
            <div className="flex items-center space-x-4 w-full">
              {/* Date - stick to left */}
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block mr-auto">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <div className="text-xs text-gray-600 sm:hidden mr-auto">
                {new Date().toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <i className={theme === 'dark' ? 'ri-sun-line text-amber-500' : 'ri-moon-line text-gray-600'}></i>
              </button>

              {/* User Info and Logout */}
              {user && (
                <div className="flex items-center space-x-3 ml-auto">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{user.role}</div>
                  </div>
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

        {/* Main Content - Reduced padding */}
        <main className="flex-1 overflow-auto p-3 sm:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
