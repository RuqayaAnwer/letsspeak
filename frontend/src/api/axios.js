import axios from 'axios';
import { getMockResponse } from './mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const defaultAdapter = axios.defaults.adapter;

// محلياً: استخدم /api ليمر عبر بروكسي Vite → api.letspeak.online (تجنب CORS)
// على السيرفر: استخدم الرابط المباشر
const baseURL = import.meta.env.DEV ? '/api' : 'https://api.letspeak.online/api';

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

    logApiError(error, `API ${status || 'Network'}`);

    // التوجيه لصفحة الدخول فقط عند 401 (انتهاء الجلسة أو توكن غير صالح)
    // لا نوجّه عند 504/502/503 حتى يظهر الخطأ للمستخدم
    if (status === 401) {
      console.warn('[API] 401 — انتهت الجلسة أو التوكن غير صالح. جاري التوجيه إلى /login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
