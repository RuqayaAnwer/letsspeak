/**
 * بيانات افتراضية للتجريب محلياً فقط.
 * تُستخدم عندما VITE_USE_MOCK=true في .env.development
 */

export const mockStudents = {
  data: [
    { id: 1, name: 'أحمد محمد', phone: '+964 770 123 4567', level: 'L1', notes: '' },
    { id: 2, name: 'سارة علي', phone: '+964 771 234 5678', level: 'L2', notes: '' },
    { id: 3, name: 'عمر حسن', phone: '+964 772 345 6789', level: 'L1', notes: 'ملاحظة تجريبية' },
  ],
};

export const mockTrainers = {
  data: [
    { id: 1, name: 'المدرب محمد', phone: '+964 750 111 2233', user: { id: 1, name: 'المدرب محمد', email: 'trainer1@letspeak.online' } },
    { id: 2, name: 'المدربة فاطمة', phone: '+964 750 222 3344', user: { id: 2, name: 'المدربة فاطمة', email: 'trainer2@letspeak.online' } },
  ],
};

// إحصائيات اللوحة = نفس أعداد القوائم الفعلية (لتجنب اختلاف العدد بين اللوحة وإدارة الطلاب/المدربين)
export const mockDashboardStats = {
  data: {
    get students() { return mockStudents.data.length; },
    get trainers() { return mockTrainers.data.length; },
    get active_courses() { return mockCourses.data.length; },
    get packages() { return mockCoursePackages.data.length; },
  },
};

export const mockCoursePackages = {
  data: [
    { id: 1, name: 'باقة أساسية', lectures_count: 8, price: 80000, description: '8 محاضرات' },
    { id: 2, name: 'باقة متوسطة', lectures_count: 12, price: 110000, description: '12 محاضرة' },
    { id: 3, name: 'باقة مكثفة', lectures_count: 16, price: 140000, description: '16 محاضرة' },
  ],
};

export const mockCourses = {
  data: [
    {
      id: 1,
      status: 'active',
      lectures_count: 8,
      start_date: '2025-01-15',
      student: { id: 1, name: 'أحمد محمد' },
      course_package: { id: 1, name: 'باقة أساسية', lectures_count: 8 },
      coursePackage: { id: 1, name: 'باقة أساسية', lectures_count: 8 },
    },
    {
      id: 2,
      status: 'active',
      lectures_count: 12,
      start_date: '2025-02-01',
      student: { id: 2, name: 'سارة علي' },
      course_package: { id: 2, name: 'باقة متوسطة', lectures_count: 12 },
      coursePackage: { id: 2, name: 'باقة متوسطة', lectures_count: 12 },
    },
  ],
  current_page: 1,
  last_page: 1,
};

const demoUsersByRole = {
  customer_service: { id: 1, name: 'موظف خدمة العملاء', email: 'cs@letspeak.com', role: 'customer_service' },
  trainer: { id: 2, name: 'المدرب محمد', email: 'trainer@letspeak.com', role: 'trainer' },
  finance: { id: 3, name: 'موظف المالية', email: 'finance@letspeak.com', role: 'finance' },
  accounting: { id: 3, name: 'موظف المالية', email: 'acc@letspeak.com', role: 'accounting' },
};

export function getMockDevLogin(role) {
  const user = demoUsersByRole[role] || demoUsersByRole.customer_service;
  return {
    user: { ...user, role: user.role || role },
    token: 'dev-token-' + user.id + '-' + Date.now(),
  };
}

/**
 * يُرجع بيانات وهمية للمسار والطريقة المطلوبة، أو null إذا لا يوجد mock.
 */
export function getMockResponse(url, method, data) {
  const path = url.replace(/^https?:\/\/[^/]+/, '') || url;
  if (method === 'GET') {
    if (path.includes('/dashboard/stats')) return mockDashboardStats;
    if (path.includes('/students')) return mockStudents;
    if (path.includes('/trainers') && !path.includes('/trainers/')) return mockTrainers;
    if (path.includes('/course-packages')) return mockCoursePackages;
    if (path.includes('/courses') && !path.match(/\/courses\/\d+/)) return mockCourses;
  }
  if (method === 'POST' && path.includes('/auth/dev-login') && data?.role) {
    return getMockDevLogin(data.role);
  }
  return null;
}
