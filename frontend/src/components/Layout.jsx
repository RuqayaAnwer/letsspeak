import { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Menu, X, ChevronRight } from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Sidebar state - get initial state from localStorage or default to true
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Close sidebar on route change (mobile only)
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const getNavItems = () => {
    switch (user?.role) {
      case 'customer_service':
        return [
          { path: '/customer-service', label: 'لوحة التحكم', icon: '📊' },
          { path: '/customer-service/students', label: 'الطلاب', icon: '👥' },
          { path: '/customer-service/trainers', label: 'المدربين', icon: '🎓' },
          { path: '/courses', label: 'الكورسات', icon: '📚' },
          { path: '/customer-service/packages', label: 'الباقات', icon: '📦' },
          { path: '/customer-service/find-time', label: 'أوقات التدريب', icon: '🕐' },
          { path: '/customer-service/activity-logs', label: 'سجل التعديلات', icon: '📝' },
        ];
      case 'trainer':
        return [
          { path: '/trainer', label: 'لوحة التحكم', icon: '📊' },
          { path: '/courses', label: 'الكورسات', icon: '📚' },
          { path: '/trainer/my-times', label: 'أوقاتي', icon: '🕐' },
        ];
      case 'finance':
        return [
          { path: '/finance', label: 'لوحة التحكم', icon: '📊' },
          { path: '/finance/payments', label: 'المدفوعات', icon: '💳' },
          { path: '/finance/payroll', label: 'رواتب المدربين', icon: '💰' },
          { path: '/courses', label: 'الكورسات', icon: '📚' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const getRoleTitle = () => {
    switch (user?.role) {
      case 'customer_service': return 'خدمة العملاء';
      case 'trainer': return 'المدرب';
      case 'finance': return 'المالية';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Overlay for mobile */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Toggle Button - Always visible */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl hover:shadow-2xl border-2 border-blue-500/50 dark:border-blue-400/50 transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-white/90 dark:hover:bg-gray-800/90 ${
          sidebarOpen ? 'right-[17rem]' : 'right-4'
        }`}
        style={{ 
          zIndex: 9999,
          pointerEvents: 'auto',
          position: 'fixed'
        }}
        title={sidebarOpen ? 'إخفاء القائمة' : 'إظهار القائمة'}
      >
        {sidebarOpen ? (
          <X className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        ) : (
          <Menu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 right-0 h-full w-64 bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">LetSpeak</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{getRoleTitle()}</p>
        </div>

        {/* Navigation */}
        <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    location.pathname === item.path
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 right-0 left-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">{user?.name}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
          >
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Collapsed Sidebar Indicator (when closed) */}
      {!sidebarOpen && !isMobile && (
        <div className="fixed top-20 right-4 z-30">
          <button
            onClick={toggleSidebar}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm">القائمة</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main 
        className={`transition-all duration-300 p-8 relative ${
          sidebarOpen && !isMobile ? 'mr-64' : 'mr-0'
        }`}
        style={{ zIndex: 1 }}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
