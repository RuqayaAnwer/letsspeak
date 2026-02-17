import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      // الباكند يتوقع حقل email
      const response = await api.post('/auth/login', { email, password });
      const { token, user: userData, role: responseRole } = response.data;

      const userWithRole = {
        ...userData,
        role: responseRole || userData?.role || 'trainer',
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userWithRole));
      setUser(userWithRole);

      return userWithRole;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'فشل تسجيل الدخول';
      throw new Error(message);
    }
  };

  const devLogin = async (role) => {
    try {
      const response = await api.post('/auth/dev-login', { role });
      const { token, user: userData } = response.data;
      
      // Ensure role is included
      const userWithRole = {
        ...userData,
        role: userData.role || role
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userWithRole));
      setUser(userWithRole);
      
      return userWithRole;
    } catch (error) {
      console.error('Dev login error:', error);
      // على الموقع الحقيقي لا نستخدم توكن وهمي — السيرفر سيرفضه (401)
      const isProduction = typeof window !== 'undefined' && (
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      );
      if (isProduction) {
        const msg = error.response?.data?.message || error.message || 'فشل التسجيل التجريبي';
        throw new Error('على الموقع الحقيقي استخدم تسجيل الدخول العادي (البريد وكلمة المرور). إذا لم يوجد مستخدم للدور المطلوب أضفه من لوحة التحكم.');
      }
      // محلياً فقط: Fallback للعرض التجريبي
      const demoUsers = {
        customer_service: { id: 1, name: 'موظف خدمة العملاء', email: 'cs@letspeak.com', role: 'customer_service' },
        trainer: { id: 2, name: 'المدرب محمد', email: 'trainer@letspeak.com', role: 'trainer' },
        finance: { id: 3, name: 'موظف المالية', email: 'finance@letspeak.com', role: 'finance' },
        accounting: { id: 3, name: 'موظف المالية', email: 'acc@letspeak.com', role: 'accounting' },
      };
      
      const userData = demoUsers[role];
      if (userData) {
        const token = 'dev-token-' + userData.id + '-' + Date.now();
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isCustomerService = user?.role === 'customer_service';
  const isTrainer = user?.role === 'trainer';
  const isFinance = user?.role === 'finance';
  const isAccounting = user?.role === 'accounting' || user?.role === 'finance';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      isCustomerService,
      isTrainer,
      isFinance,
      isAccounting,
      login,
      devLogin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
