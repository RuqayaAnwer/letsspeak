import { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Menu, X } from 'lucide-react';

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
          { path: '/customer-service/alerts', label: 'التنبيهات', icon: '⚠️' },
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


      {/* Sidebar */}
      <aside 
        className={`fixed top-0 right-0 h-full w-64 sm:w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <img 
              src="/Letspeak logo.png" 
              alt="LetSpeak Logo" 
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
            <h1 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">LetSpeak</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{getRoleTitle()}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 sm:p-4 min-h-0">
          <ul className="space-y-1 sm:space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all text-sm sm:text-base ${
                    location.pathname === item.path
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg sm:text-xl">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Section */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{user?.name}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40 text-sm sm:text-base"
          >
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Top Header with Logo */}
      <header 
        className={`fixed top-0 left-0 right-0 h-14 sm:h-16 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-md z-30 transition-all duration-300 ${
          sidebarOpen && !isMobile ? 'mr-64' : 'mr-0'
        }`}
      >
        <div className="h-full flex items-center justify-start px-3 sm:px-6">
          {/* Toggle Button - Before Logo */}
          <button
            onClick={toggleSidebar}
            className="p-1.5 sm:p-2 rounded-lg bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 mr-2 sm:mr-3"
            style={{ 
              zIndex: 9999,
              pointerEvents: 'auto'
            }}
            title={sidebarOpen ? 'إخفاء القائمة' : 'إظهار القائمة'}
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            ) : (
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            )}
          </button>
          
          {/* Logo Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            <img 
              src="/Letspeak logo.png" 
              alt="LetSpeak Logo" 
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-sm"
            />
            <h2 className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 hidden xs:block">
              LetSpeak
            </h2>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main 
        className={`transition-all duration-300 pt-20 sm:pt-24 px-3 sm:px-4 md:px-6 lg:px-8 pb-4 sm:pb-6 md:pb-8 relative ${
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
