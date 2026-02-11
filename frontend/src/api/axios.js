import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.letspeak.online/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

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

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || error.config?.baseURL || '';

    logApiError(error, `API ${status || 'Network'}`);

    if (status === 401) {
      console.warn('[API] 401 — جاري حذف التوكن والتوجيه إلى /login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
