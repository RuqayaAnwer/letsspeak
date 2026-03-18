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

      // تأكيد الدور: من الاستجابة أولاً، وإذا كان المستخدم له trainer بدون role فاعتبره مدرباً
      const role = responseRole ?? userData?.role ?? (userData?.trainer ? 'trainer' : null) ?? 'trainer';
      const userWithRole = {
        ...userData,
        role,
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
      const msg = error.response?.data?.message || error.message || 'فشل التسجيل التجريبي';
      throw new Error(msg);
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
