/**
 * بيانات تجريبية للعرض محلياً فقط (عند npm run dev).
 * لا تُستخدم في النسخة المُبنية للموقع (npm run build) فلا تؤثر على الموقع الأصلي.
 */

export const sampleCustomerServiceStats = {
  students: 24,
  trainers: 8,
  courses: 18,
  packages: 5,
};

export const samplePaymentStats = {
  total_amount: 125000,
  paid_amount: 85000,
  pending_amount: 40000,
  monthly_revenue: 32000,
  active_courses: 18,
  finished_courses: 12,
  total_students: 24,
  completed_count: 14,
};

export const sampleGeneralStats = {
  active_courses_count: 18,
  finished_courses_count: 12,
  students_count: 24,
  trainers_count: 8,
};

export const sampleTrainers = [
  {
    id: 1,
    name: 'محمد أحمد',
    user: { name: 'محمد أحمد', email: 'mohammed@letspeak.com' },
    phone: '07701234567',
    min_level: 'L1',
    max_level: 'L4',
    specialty: 'محادثة إنجليزية',
    courses_count: 5,
    weekly_lectures_count: 4,
    status: 'active',
    notes: '',
  },
  {
    id: 2,
    name: 'فاطمة علي',
    user: { name: 'فاطمة علي', email: 'fatima@letspeak.com' },
    phone: '07702345678',
    min_level: 'L3',
    max_level: 'L7',
    specialty: 'IELTS وقواعد',
    courses_count: 3,
    weekly_lectures_count: 2,
    status: 'active',
    notes: 'مدربة متخصصة بالـ IELTS',
  },
  {
    id: 3,
    name: 'علي حسن',
    user: { name: 'علي حسن', email: 'ali@letspeak.com' },
    phone: '07703456789',
    min_level: 'L2',
    max_level: 'L6',
    specialty: 'كتابة وقراءة',
    courses_count: 4,
    weekly_lectures_count: 3,
    status: 'active',
    notes: '',
  },
  {
    id: 4,
    name: 'نور الهدى',
    user: { name: 'نور الهدى', email: 'noor@letspeak.com' },
    phone: '07704567890',
    min_level: 'L1',
    max_level: 'L5',
    specialty: 'محادثة للأطفال',
    courses_count: 6,
    weekly_lectures_count: 5,
    status: 'active',
    notes: 'متخصصة بتدريس الأطفال',
  },
  {
    id: 5,
    name: 'خالد إبراهيم',
    user: { name: 'خالد إبراهيم', email: 'khaled@letspeak.com' },
    phone: '07705678901',
    min_level: 'L4',
    max_level: 'L8',
    specialty: 'أعمال وإنجليزي أكاديمي',
    courses_count: 2,
    weekly_lectures_count: 1,
    status: 'active',
    notes: '',
  },
];

export const sampleStudents = [
  { id: 1, name: 'أحمد محمد', phone: '07711234567', level: 'L2', notes: '' },
  { id: 2, name: 'سارة علي', phone: '07722345678', level: 'L4', notes: 'طالبة مجتهدة' },
  { id: 3, name: 'محمد حسن', phone: '07733456789', level: 'L1', notes: '' },
  { id: 4, name: 'فاطمة أحمد', phone: '07744567890', level: 'L3', notes: '' },
  { id: 5, name: 'علي كريم', phone: '07755678901', level: 'L5', notes: 'يحضر دورة IELTS' },
  { id: 6, name: 'نور الدين', phone: '07766789012', level: 'L2', notes: '' },
  { id: 7, name: 'زينب محمود', phone: '07777890123', level: 'L6', notes: 'طالبة متقدمة' },
  { id: 8, name: 'حسن عبدالله', phone: '07788901234', level: 'L1', notes: 'مبتدئ' },
];

export const sampleRecentPayments = [
  {
    id: 1,
    amount: 25000,
    payment_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    student: { name: 'أحمد محمد' },
    course: {
      total_amount: 50000,
      amount_paid: 25000,
      is_dual: false,
      course_package: { name: 'باقة المحادثة - 10 حصص' },
      coursePackage: { name: 'باقة المحادثة - 10 حصص' },
    },
  },
  {
    id: 2,
    amount: 15000,
    payment_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    student: { name: 'سارة علي' },
    course: {
      total_amount: 30000,
      amount_paid: 30000,
      is_dual: false,
      course_package: { name: 'باقة المبتدئين' },
      coursePackage: { name: 'باقة المبتدئين' },
    },
  },
  {
    id: 3,
    amount: 20000,
    payment_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    student: { name: 'محمد حسن' },
    course: {
      total_amount: 40000,
      amount_paid: 20000,
      is_dual: false,
      course_package: { name: 'باقة IELTS' },
      coursePackage: { name: 'باقة IELTS' },
    },
  },
  {
    id: 4,
    amount: 10000,
    payment_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    student: { name: 'فاطمة أحمد' },
    course: {
      total_amount: 20000,
      amount_paid: 10000,
      is_dual: false,
      course_package: { name: 'باقة القواعد' },
      coursePackage: { name: 'باقة القواعد' },
    },
  },
  {
    id: 5,
    amount: 30000,
    payment_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    student: { name: 'علي كريم' },
    course: {
      total_amount: 60000,
      amount_paid: 60000,
      is_dual: false,
      course_package: { name: 'باقة المحادثة - 20 حصة' },
      coursePackage: { name: 'باقة المحادثة - 20 حصة' },
    },
  },
];
