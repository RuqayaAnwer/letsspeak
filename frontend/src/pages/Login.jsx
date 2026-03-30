import React, { useState, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
// Use backend URL to avoid 422 WAF errors on the frontend server
const logoImage = 'https://api.letspeak.online/logo.png';

const Login = () => {
    const [mode, setMode] = useState('manual'); // 'manual' = تسجيل دخول بالإيميل (للمدربين والموظفين)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, devLogin } = useAuth();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const navigate = useNavigate();

    const handleManualLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const result = await login(email.trim(), password);
            navigateByRole(result?.role);
        } catch (err) {
            setError(err.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات.');
        } finally {
            setLoading(false);
        }
    };

    const handleDevLogin = async (role) => {
        setLoading(true);
        setError('');
        try {
            const result = await devLogin(role);
            navigateByRole(result.role);
        } catch (err) {
            setError(err.message || 'فشل تسجيل الدخول.');
        } finally {
            setLoading(false);
        }
    };

    const navigateByRole = (role) => {
        switch (role) {
            case 'admin':
                navigate('/admin');
                break;
            case 'customer_service':
                navigate('/customer-service');
                break;
            case 'trainer':
                navigate('/trainer');
                break;
            case 'finance':
            case 'accounting':
                navigate('/finance');
                break;
            default:
                navigate('/');
        }
    };

    const roleCards = [
        {
            role: 'admin',
            title: 'الإدارة',
            subtitle: 'Admin',
            description: 'إدارة المستخدمين والصلاحيات',
            icon: '🛡️',
            color: 'from-purple-500 to-purple-600',
            hoverColor: 'hover:from-purple-600 hover:to-purple-700',
        },
        {
            role: 'customer_service',
            title: 'خدمة العملاء',
            subtitle: 'Customer Service',
            description: 'إدارة الطلاب والمدربين والكورسات',
            icon: '👤',
            color: 'from-blue-500 to-blue-600',
            hoverColor: 'hover:from-blue-600 hover:to-blue-700',
        },
        {
            role: 'trainer',
            title: 'المدرب',
            subtitle: 'Trainer',
            description: 'متابعة المحاضرات وتحديث الحضور',
            icon: '🎓',
            color: 'from-green-500 to-green-600',
            hoverColor: 'hover:from-green-600 hover:to-green-700',
        },
        {
            role: 'finance',
            title: 'المالية',
            subtitle: 'Finance',
            description: 'إدارة المدفوعات والرواتب',
            icon: '💰',
            color: 'from-amber-500 to-amber-600',
            hoverColor: 'hover:from-amber-600 hover:to-amber-700',
        },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                className="absolute top-2 sm:top-4 left-2 sm:left-4 p-1.5 sm:p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all text-base sm:text-xl"
            >
                {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex flex-col items-center justify-center">
                        <img 
                            src={logoImage} 
                            alt="LetSpeak Logo" 
                            className="w-20 h-20 sm:w-24 sm:h-24 mb-4 object-contain"
                        />
                        <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 dark:text-white">
                            LetSpeak
                        </h1>
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        نظام إدارة التدريب
                    </p>
                </div>

                {/* Mode Toggle: تسجيل دخول بالإيميل (افتراضي) | دخول سريع للتطوير */}
                <div className="flex justify-center mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-1 shadow-md">
                        <button
                            onClick={() => setMode('manual')}
                            className={`px-4 py-2 rounded-md transition-all ${
                                mode === 'manual'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            تسجيل الدخول
                        </button>
                        <button
                            onClick={() => setMode('dev')}
                            className={`px-4 py-2 rounded-md transition-all ${
                                mode === 'dev'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            دخول سريع
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 rounded-lg text-center">
                        {error}
                    </div>
                )}

                {mode === 'dev' ? (
                    /* Dev Login - Role Cards */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {roleCards.map((card) => (
                            <button
                                key={card.role}
                                onClick={() => handleDevLogin(card.role)}
                                disabled={loading}
                                className={`
                                    bg-gradient-to-br ${card.color} ${card.hoverColor}
                                    text-white rounded-2xl p-6 shadow-lg hover:shadow-xl
                                    transform hover:-translate-y-1 transition-all duration-200
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    flex flex-col items-center text-center
                                `}
                            >
                                <span className="text-5xl mb-4">{card.icon}</span>
                                <h3 className="text-xl font-bold mb-1">{card.title}</h3>
                                <p className="text-sm opacity-80 mb-2">{card.subtitle}</p>
                                <p className="text-sm opacity-70">{card.description}</p>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* Manual Login Form - تسجيل الدخول بالإيميل (المدربون والموظفون) */
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md mx-auto">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white text-center mb-2">
                            تسجيل الدخول
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                            أدخل البريد الإلكتروني وكلمة المرور المسجّلين في النظام
                        </p>
                        <form onSubmit={handleManualLogin}>
                            <div className="mb-4">
                                <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                                    البريد الإلكتروني
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="مثال: trainer@letspeak.online"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                                    كلمة المرور
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="أدخل كلمة المرور"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-right">
                                <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">
                                    🎓 للمدربين
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    استخدموا البريد الإلكتروني المسجّل في لوحة خدمة العملاء (معلومات المدربين) وكلمة المرور التي أُعطيت لكم عند الإضافة.
                                </p>
                                <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                                    في حال واجهتم مشكلة في الدخول، تواصلوا مع الإدارة لإعادة تعيين كلمة المرور.
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        جاري الدخول...
                                    </span>
                                ) : (
                                    'دخول'
                                )}
                            </button>
                        </form>

                        {/* Test Credentials - للاختبار فقط */}
                        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <p className="text-xs text-gray-500 dark:text-gray-500 text-center mb-2">
                                للاختبار: استخدم نفس الإيميل المسجّل في قسم المدربين + كلمة المرور المعطاة للمدرب
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-500 text-center space-y-1">
                                <p>خدمة العملاء / المالية: إيميل الموظف المسجّل في النظام</p>
                                <p>المدرب: <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">نفس الإيميل في معلومات المدرب</span></p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-gray-500 dark:text-gray-500 text-sm mt-8">
                    نظام إدارة LetSpeak - قاعدة بيانات MySQL
                </p>
            </div>
        </div>
    );
};

export default Login;
