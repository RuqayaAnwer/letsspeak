import axios from 'axios';
import { getMockResponse } from './mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const defaultAdapter = axios.defaults.adapter;

// محلياً: استخدم /api ليمر عبر بروكسي Vite → api.letspeak.online (تجنب CORS)
// على السيرفر: استخدم الرابط المباشر
const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.letspeak.online';
const baseURL = import.meta.env.DEV ? '/api' : `${apiBase.replace(/\/$/, '')}/api`;

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

if (USE_MOCK) {
  api.defaults.adapter = (config) => {
    const fullUrl = (config.baseURL || '') + (config.url || '');
    const method = (config.method || 'get').toUpperCase();
    const mock = getMockResponse(fullUrl, method, config.data);
    if (mock !== null) {
      if (import.meta.env.DEV) console.log('[Mock API]', method, config.url, '->', mock);
      return Promise.resolve({
        data: mock,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
    return defaultAdapter(config);
  };
}

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper لإنشاء نافذة منبثقة (Toast) للأخطاء بدون مكتبات خارجية
const showToast = (message) => {
  const toast = document.createElement('div');
  toast.innerText = message;
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: #dc2626;
    color: white; padding: 15px 20px; border-radius: 8px; z-index: 9999; 
    box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 350px;
    font-family: inherit; text-align: right; direction: rtl; 
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { 
    toast.style.opacity = '0'; 
    setTimeout(() => toast.remove(), 300); 
  }, 4000);
};

// تشخيص: تسجيل كل أخطاء الـ API في الـ Console
const logApiError = (error, context = '') => {
  const url = error.config?.url || error.config?.baseURL || 'unknown';
  const method = error.config?.method?.toUpperCase() || '';
  const status = error.response?.status;
  const statusText = error.response?.statusText || '';
  const isCors = !error.response && (error.message?.includes('Network') || error.code === 'ERR_NETWORK');

  console.groupCollapsed(
    `%c[API Error] ${context || method + ' ' + url}`,
    'color: #dc2626; font-weight: bold;'
  );
  console.error('الرابط:', method, url);
  if (status) {
    console.error('الحالة:', status, statusText);
    if (status === 401) console.error('السبب: انتهت الجلسة أو التوكن غير صالح — سيتم التوجيه لصفحة تسجيل الدخول');
  }
  if (isCors) {
    console.error('السبب المحتمل: CORS — تحقق من إعداد Nginx على السيرفر (هيدرات Access-Control و OPTIONS)');
  }
  console.error('الرسالة:', error.message);
  if (error.response?.data) console.error('رد السيرفر:', error.response.data);
  console.error('كائن الخطأ الكامل:', error);
  console.groupEnd();
};

// Handle 401 and 5xx errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || error.config?.baseURL || '';
    const isCors = !error.response && (error.message?.includes('Network') || error.code === 'ERR_NETWORK');

    logApiError(error, `API ${status || 'Network'}`);

    if (status === 401) {
      console.warn('[API] 401 — انتهت الجلسة أو التوكن غير صالح. جاري التوجيه إلى /login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (status >= 500) {
      showToast('حدث خطأ في الخادم ' + status + '. يرجى المحاولة لاحقاً مراجعة الدعم الفني.');
    } else if (status === 422) {
      const msg = error.response?.data?.message || 'بيانات غير صحيحة، يرجى مراجعة الحقول.';
      showToast('خطأ في البيانات المكتسلة: ' + msg);
    } else if (isCors || status === undefined) {
      showToast('تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.');
    }
    return Promise.reject(error);
  }
);

export default api;
