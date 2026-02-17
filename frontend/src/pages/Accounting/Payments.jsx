import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, CreditCard, X, Edit2, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateSimple } from '../../utils/dateFormat';
import { formatCurrency } from '../../utils/currencyFormat';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [packages, setPackages] = useState([]);
  const [dualCoursesData, setDualCoursesData] = useState([]); // Store dual courses with all students
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    course_package_id: '',
    amount: '',
    remaining_amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [editFormData, setEditFormData] = useState({
    student_id: '',
    course_id: '',
    course_package_id: '',
    amount: '',
    remaining_amount: '',
    date: '',
    notes: '',
  });
  const [remainingPayment, setRemainingPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [paymentInfoModal, setPaymentInfoModal] = useState({
    open: false,
    studentId: null,
    courseId: null,
    studentName: '',
    course: null, // Store course object for dual courses
    payments: [],
    loading: false,
  });
  const [paymentCompletionModal, setPaymentCompletionModal] = useState({
    open: false,
    studentName: '',
    studentId: null,
    coursesPayments: [], // Array of {courseId, courseName, payments: [{date, amount}]}
    loading: false,
  });
  // Pagination states for mobile cards
  const [singlePaymentsPage, setSinglePaymentsPage] = useState(1);
  const [dualPaymentsPage, setDualPaymentsPage] = useState(1);
  const [showAllSinglePayments, setShowAllSinglePayments] = useState(false);
  const [showAllDualPayments, setShowAllDualPayments] = useState(false);

  // تشخيص: يظهر في الكونسول لمعرفة سبب عدم ظهور بيانات المدفوعات
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const baseURL = 'https://api.letspeak.online/api';
    console.group('%c[Payments] تشخيص — صفحة المدفوعات', 'color: #2563eb; font-weight: bold; font-size: 12px;');
    console.log('1. الرابط الأساسي للـ API:', baseURL);
    console.log('2. هل يوجد توكن؟', token ? `نعم (${token.substring(0, 20)}...)` : 'لا — سيُعاد توجيهك لصفحة الدخول عند أول طلب 401');
    console.log('3. هل يوجد user محفوظ؟', user ? 'نعم' : 'لا');
    console.log('4. الطلبات التي ستُنفذ: GET /payments, /students, /courses, /course-packages');
    console.log('5. إذا ظهر 401 = انتهت الجلسة أو التوكن غير مقبول من السيرفر');
    console.log('6. إذا ظهر 504 = السيرفر لم يرد في الوقت المحدد');
    console.groupEnd();
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchStudentsAndCourses();
    fetchDualCourses(); // Fetch dual courses to show all students
  }, [search]);

  // Reset pagination when payments change
  useEffect(() => {
    setSinglePaymentsPage(1);
    setDualPaymentsPage(1);
    setShowAllSinglePayments(false);
    setShowAllDualPayments(false);
  }, [payments]);

  // Ensure date is properly formatted when edit modal opens
  useEffect(() => {
    if (isEditModalOpen && editFormData.date) {
      // Validate and format the date
      const dateStr = String(editFormData.date);
      if (dateStr.includes('T')) {
        const formattedDate = dateStr.split('T')[0];
        if (formattedDate !== editFormData.date) {
          setEditFormData(prev => ({ ...prev, date: formattedDate }));
        }
      }
    }
  }, [isEditModalOpen, editFormData.date]);


  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (search) params.search = search;

      console.log('[Payments] جاري طلب GET /payments ...');
      const token = localStorage.getItem('token');
      if (!token) console.warn('[Payments] لا يوجد توكن — الطلب قد يرجع 401');

      // Fetch all pages of payments to ensure we have all data
      let allPayments = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await api.get('/payments', { 
          params: { ...params, page: currentPage } 
        });
        
        const responseData = response.data;
        // تشخيص: شكل الاستجابة (للمساعدة إذا اختفت البيانات)
        if (currentPage === 1) {
          console.log('[Payments] شكل الاستجابة:', {
            hasData: !!responseData?.data,
            dataLength: responseData?.data?.length ?? (Array.isArray(responseData) ? responseData.length : 0),
            keys: responseData ? Object.keys(responseData) : [],
          });
        }
        // دعم أكثر من شكل: Laravel paginate { data: [] } أو مصفوفة مباشرة
        const paymentsData = Array.isArray(responseData?.data)
          ? responseData.data
          : Array.isArray(responseData)
            ? responseData
            : [];
        
        if (paymentsData.length > 0) {
          allPayments = [...allPayments, ...paymentsData];
          hasMorePages = responseData?.current_page < responseData?.last_page;
          currentPage++;
        } else {
          hasMorePages = false;
        }
      }

      console.log('[Payments] نجاح: تم جلب', allPayments.length, 'مدفوعة');

      // Sort payments by student name + course name alphabetically
      // This ensures each course is treated as a separate entry, even if same student
      const sortedPayments = allPayments.sort((a, b) => {
        const nameA = (a.student?.name || '').toLowerCase();
        const nameB = (b.student?.name || '').toLowerCase();
        const courseA = (a.course?.course_package?.name || a.course?.coursePackage?.name || '').toLowerCase();
        const courseB = (b.course?.course_package?.name || b.course?.coursePackage?.name || '').toLowerCase();
        
        // First sort by student name
        const nameCompare = nameA.localeCompare(nameB, 'ar');
        if (nameCompare !== 0) return nameCompare;
        
        // If same student name, sort by course name
        // This ensures each course appears as a separate entry
        return courseA.localeCompare(courseB, 'ar');
      });
      
      setPayments(sortedPayments);
      console.log('Payments fetched:', sortedPayments.length);
    } catch (err) {
      const status = err.response?.status;
      const statusText = err.response?.statusText || '';
      console.group('%c[Payments] فشل جلب المدفوعات — السبب أدناه', 'color: #dc2626; font-weight: bold; font-size: 12px;');
      console.error('الرابط:', 'GET https://api.letspeak.online/api/payments');
      console.error('الحالة:', status, statusText);
      if (status === 401) {
        console.error('%cالسبب: 401 Unauthorized — التوكن منتهي أو غير مقبول. التطبيق سيوجّهك لصفحة الدخول.', 'color: #ea580c; font-weight: bold;');
      } else if (status === 504 || err.code === 'ECONNABORTED') {
        console.error('%cالسبب: 504 أو انتهاء الوقت — السيرفر لم يرد في الوقت المحدد (تحقق من Nginx/PHP-FPM).', 'color: #ea580c; font-weight: bold;');
      } else if (status === 403) {
        console.error('%cالسبب: 403 Forbidden — ليس لديك صلاحية لهذا الطلب.', 'color: #ea580c; font-weight: bold;');
      } else if (!err.response) {
        console.error('%cالسبب: خطأ شبكة أو CORS — لم يصل رد من السيرفر (تحقق من الرابط و CORS).', 'color: #ea580c; font-weight: bold;');
      }
      console.error('الرسالة:', err.message);
      console.error('رد السيرفر:', err.response?.data);
      console.error('كائن الخطأ:', err);
      console.groupEnd();
      setPayments([]); // Set empty array on error
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndCourses = async () => {
    try {
      console.log('[Payments] جاري طلب GET /students, /courses, /course-packages ...');
      const [studentsRes, coursesRes, packagesRes] = await Promise.all([
        api.get('/students'),
        api.get('/courses'),
        api.get('/course-packages'),
      ]);
      setStudents(studentsRes.data.data || studentsRes.data || []);
      setCourses(coursesRes.data.data || coursesRes.data || []);
      setPackages(packagesRes.data.data || packagesRes.data || []);
      console.log('[Payments] نجاح: طلاب، كورسات، باقات تم جلبها');
    } catch (error) {
      const status = error.response?.status;
      console.group('%c[Payments] فشل جلب الطلاب/الكورسات/الباقات', 'color: #dc2626; font-weight: bold;');
      console.error('الروابط: GET /students, /courses, /course-packages');
      console.error('الحالة:', status, error.response?.statusText);
      if (status === 401) console.error('%cالسبب: 401 — سيتم توجيهك لصفحة الدخول', 'color: #ea580c; font-weight: bold;');
      else if (status === 504) console.error('%cالسبب: 504 — السيرفر لم يرد في الوقت', 'color: #ea580c; font-weight: bold;');
      console.error('الرسالة:', error.message);
      console.error('كامل:', error);
      console.groupEnd();
    }
  };

  // Fetch dual courses with all students
  const fetchDualCourses = async () => {
    try {
      // Fetch all courses
      let allCourses = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await api.get('/courses', { params: { page: currentPage } });
        const responseData = response.data;
        const coursesData = responseData?.data || responseData || [];
        
        if (Array.isArray(coursesData) && coursesData.length > 0) {
          allCourses = [...allCourses, ...coursesData];
          hasMorePages = responseData?.current_page < responseData?.last_page;
          currentPage++;
        } else {
          hasMorePages = false;
        }
      }

      // Filter dual courses and ensure they have students loaded
      const dualCourses = allCourses.filter(c => c.is_dual && c.students && c.students.length > 1);
      
      // For each dual course, fetch full details to ensure students are loaded
      const dualCoursesWithStudents = await Promise.all(
        dualCourses.map(async (course) => {
          try {
            const courseResponse = await api.get(`/courses/${course.id}`);
            return courseResponse.data;
          } catch (error) {
            console.error(`Error fetching course ${course.id}:`, error);
            return course; // Return original course if fetch fails
          }
        })
      );

      setDualCoursesData(dualCoursesWithStudents);
    } catch (error) {
      console.group('%c[Payments] فشل جلب الكورسات المزدوجة', 'color: #dc2626; font-weight: bold;');
      console.error('الرابط: GET /api/courses (صفحات متعددة)');
      console.error('الحالة:', error.response?.status, error.response?.statusText);
      console.error('الرسالة:', error.message);
      console.error('كامل:', error);
      console.groupEnd();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // New payment only
      const data = {
        student_id: parseInt(formData.student_id),
        course_id: parseInt(formData.course_id),
        amount: parseFloat(formData.amount),
        payment_date: formData.date,
        status: 'completed',
        notes: formData.notes || '',
      };
      await api.post('/payments', data);
      
      // Check if payment is completed (remaining amount is 0)
      if (parseFloat(formData.remaining_amount) === 0 && formData.student_id) {
        // Wait a bit to ensure the payment is saved, then fetch all payments for this student
        await new Promise(resolve => setTimeout(resolve, 500));
        await showPaymentCompletionInfo(parseInt(formData.student_id));
      } else {
        fetchPayments();
        closeModal();
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء الحفظ');
      setSubmitting(false);
    }
  };

  // Show payment completion info (all courses payments grouped)
  const showPaymentCompletionInfo = async (studentId) => {
    try {
      setPaymentCompletionModal({
        open: true,
        studentName: students.find(s => s.id === studentId)?.name || 'غير محدد',
        studentId: studentId,
        coursesPayments: [],
        loading: true,
      });

      // Fetch all payments for this student
      const response = await api.get('/payments', {
        params: {
          student_id: studentId,
        },
      });

      const allPayments = response.data?.data || response.data || [];
      
      // Filter completed/paid payments
      const completedPayments = allPayments.filter(p => 
        p.status === 'completed' || p.status === 'paid'
      );

      // Group payments by course
      const coursesPaymentsMap = {};
      completedPayments.forEach(payment => {
        const courseId = payment.course_id;
        if (!coursesPaymentsMap[courseId]) {
          const course = courses.find(c => c.id === courseId);
          coursesPaymentsMap[courseId] = {
            courseId: courseId,
            courseName: course?.course_package?.name || course?.coursePackage?.name || `كورس #${courseId}`,
            payments: [],
          };
        }
        
        // Get payment date - prioritize payment_date, then date, then created_at
        const paymentDate = payment.payment_date || payment.date || payment.created_at;
        
        // Add payment with unique ID to avoid duplicates
        coursesPaymentsMap[courseId].payments.push({
          id: payment.id, // Use payment ID to ensure uniqueness
          date: paymentDate,
          amount: parseFloat(payment.amount) || 0,
          created_at: payment.created_at, // Keep original creation date for sorting
          payment_date: payment.payment_date || payment.date, // Keep original payment date
        });
      });

      // Sort payments within each course by creation date (created_at) first, then by ID
      // This ensures the first payment (by creation order) remains constant
      // regardless of payment_date values
      Object.keys(coursesPaymentsMap).forEach(courseId => {
        coursesPaymentsMap[courseId].payments.sort((a, b) => {
          // First priority: Sort by creation date (created_at) - oldest first
          // This preserves the original order of when payments were created
          const createdA = new Date(a.created_at || a.date || 0);
          const createdB = new Date(b.created_at || b.date || 0);
          
          if (createdA.getTime() !== createdB.getTime()) {
            return createdA - createdB;
          }
          
          // Second priority: If creation dates are the same, sort by ID (oldest first)
          // This ensures consistent ordering
          return (a.id || 0) - (b.id || 0);
        });
      });

      // Convert to array and sort by course name
      const coursesPayments = Object.values(coursesPaymentsMap).sort((a, b) => 
        a.courseName.localeCompare(b.courseName, 'ar')
      );

      setPaymentCompletionModal(prev => ({
        ...prev,
        coursesPayments,
        loading: false,
      }));

      setSubmitting(false);
    } catch (error) {
      console.error('Error fetching payment completion info:', error);
      setPaymentCompletionModal(prev => ({
        ...prev,
        loading: false,
      }));
      fetchPayments();
      closeModal();
      setSubmitting(false);
    }
  };

  // Close payment completion modal
  const closePaymentCompletionModal = () => {
    setPaymentCompletionModal({
      open: false,
      studentName: '',
      studentId: null,
      coursesPayments: [],
      loading: false,
    });
    fetchPayments();
    closeModal();
  };

  const openModal = (payment = null) => {
    if (payment) {
      // Open modal with pre-filled data for adding remaining payment
      const course = payment.course;
      const packageId = course?.course_package_id || course?.coursePackage?.id || '';
      const rawPrice = course?.course_package?.price || course?.coursePackage?.price || 0;
      const packagePrice = getPackagePrice(rawPrice);
      
      // Calculate total paid for this course and student
      const totalPaid = payments
        .filter(p => p.course_id === payment.course_id && p.student_id === payment.student_id && p.status === 'completed')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      const remainingAmount = packagePrice - totalPaid;
      
      setFormData({
        student_id: payment.student_id.toString(),
        course_id: payment.course_id.toString(),
        course_package_id: packageId.toString(),
        amount: remainingAmount > 0 ? remainingAmount.toString() : '',
        remaining_amount: '0.00',
        date: new Date().toISOString().split('T')[0],
        notes: 'دفعة المتبقي',
      });
    } else {
      setFormData({
        student_id: '',
        course_id: '',
        course_package_id: '',
        amount: '',
        remaining_amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      student_id: '',
      course_id: '',
      course_package_id: '',
      amount: '',
      remaining_amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setSubmitting(false);
  };


  const getPaymentMethodLabel = (method) => {
    if (!method) return '-';
    const methods = {
      'zain_cash': 'زين كاش',
      'qi_card': 'كي كارد',
      'delivery': 'توصيل',
    };
    return methods[method] || method;
  };

  const getPaymentMethodColor = (method) => {
    const colors = {
      'zain_cash': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'qi_card': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'delivery': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return colors[method] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const getPaymentMethodBadge = (method) => {
    if (!method) return <span className="text-gray-400">-</span>;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getPaymentMethodColor(method)}`}>
        {getPaymentMethodLabel(method)}
      </span>
    );
  };

  const getStatusLabel = (status) => {
    const labels = { completed: 'مكتمل', pending: 'معلق' };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const badges = { completed: 'badge-success', pending: 'badge-warning' };
    return badges[status] || 'badge-gray';
  };

  // Get package price (multiply by 1000 if less than 1000 to match display format)
  const getPackagePrice = (packagePrice) => {
    if (!packagePrice && packagePrice !== 0) return 0;
    const price = parseFloat(packagePrice);
    // If price is less than 1000, multiply by 1000 (e.g., 250 -> 250000)
    return price < 1000 ? price * 1000 : price;
  };

  // Calculate remaining amount for a course (total paid vs package price)
  // Calculate price per student for dual courses
  const getStudentPrice = (course) => {
    if (!course) return 0;
    
    const packageName = course.course_package?.name || course.coursePackage?.name || '';
    const isDual = course.is_dual || false;
    
    // For dual courses, each student pays a fixed amount based on package
    if (isDual) {
      if (packageName.includes('بمزاجي') || packageName === 'بمزاجي') {
        return 90000;
      } else if (packageName.includes('توازن') || packageName.includes('التوازن') || packageName === 'التوازن') {
        return 135000;
      } else if (packageName.includes('سرعة') || packageName.includes('السرعة') || packageName === 'السرعة') {
        return 225000;
      }
    }
    
    // For single courses, use the full package price (with conversion if needed)
    const rawPrice = course.course_package?.price || course.coursePackage?.price || 0;
    return getPackagePrice(rawPrice);
  };

  // CRITICAL: Each course+student combination is calculated independently
  const calculateRemainingAmount = (payment) => {
    const course = payment.course;
    if (!course) return 0;
    
    // Get the price for this specific student (handles dual courses)
    const studentPrice = getStudentPrice(course);
    if (studentPrice === 0) return 0; // No price set, consider as completed
    
    // Calculate total paid for THIS SPECIFIC COURSE AND STUDENT ONLY
    // IMPORTANT: Filter by BOTH course_id AND student_id
    // This handles:
    // 1. Same student in different courses (each course separate)
    // 2. Different students in same course (each student separate)
    const totalPaid = payments
      .filter(p => 
        p.course_id === payment.course_id && 
        p.student_id === payment.student_id && 
        p.status === 'completed'
      )
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    
    const remaining = studentPrice - totalPaid;
    
    return remaining > 0 ? remaining : 0;
  };

  // Get payment status (completed or remaining)
  const getPaymentStatus = (payment) => {
    const remaining = calculateRemainingAmount(payment);
    if (remaining > 0) {
      return { label: '', badge: 'badge-warning', amount: remaining };
    }
    return { label: 'مكتمل', badge: 'badge-success', amount: 0 };
  };

  // Get first payment date for a student in a specific course
  const getFirstPaymentDate = (studentId, courseId) => {
    if (!studentId || !courseId) return null;
    
    const coursePayments = payments
      .filter(p => 
        p.student_id === studentId && 
        p.course_id === courseId && 
        (p.status === 'completed' || p.status === 'paid')
      )
      .sort((a, b) => {
        const createdA = new Date(a.created_at || a.date || 0);
        const createdB = new Date(b.created_at || b.date || 0);
        if (createdA.getTime() !== createdB.getTime()) {
          return createdA - createdB;
        }
        return (a.id || 0) - (b.id || 0);
      });
    
    if (coursePayments.length === 0) return null;
    
    const firstPayment = coursePayments[0];
    return firstPayment.payment_date || firstPayment.date || firstPayment.created_at;
  };

  // Open edit modal
  const openEditModal = (payment) => {
    const course = payment.course;
    const packageId = course?.course_package_id || course?.coursePackage?.id || '';
    const rawPrice = course?.course_package?.price || course?.coursePackage?.price || 0;
    const packagePrice = getPackagePrice(rawPrice);
    
    // Calculate total paid for this course
    const totalPaid = payments
      .filter(p => p.course_id === payment.course_id && p.student_id === payment.student_id && p.status === 'completed')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    
    const remainingAmount = packagePrice - totalPaid;
    
    // Get payment date and format it to YYYY-MM-DD for date input
    let paymentDate = null;
    
    // Try different date fields in order of priority
    if (payment.payment_date) {
      paymentDate = payment.payment_date;
    } else if (payment.date) {
      paymentDate = payment.date;
    } else if (payment.created_at) {
      paymentDate = payment.created_at;
    }
    
    // Format date to YYYY-MM-DD for HTML date input
    if (paymentDate) {
      // Convert to string if not already
      const dateStr = String(paymentDate);
      
      // Handle ISO 8601 format (e.g., "2025-12-25T00:00:00.000000Z")
      if (dateStr.includes('T')) {
        paymentDate = dateStr.split('T')[0];
      } 
      // Handle space-separated format (e.g., "2025-12-25 00:00:00")
      else if (dateStr.includes(' ')) {
        paymentDate = dateStr.split(' ')[0];
      }
      // If already in YYYY-MM-DD format, use as is
      else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        paymentDate = dateStr;
      }
      // Try to parse and reformat
      else {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          paymentDate = parsedDate.toISOString().split('T')[0];
        } else {
          paymentDate = new Date().toISOString().split('T')[0];
        }
      }
    } else {
      // Fallback to today's date if no date found
      paymentDate = new Date().toISOString().split('T')[0];
    }
    
    // Final validation: ensure it's in YYYY-MM-DD format
    if (!paymentDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.warn('Invalid date format, using today:', paymentDate);
      paymentDate = new Date().toISOString().split('T')[0];
    }
    
    // Ensure paymentDate is a valid YYYY-MM-DD string
    const todayDate = new Date().toISOString().split('T')[0];
    
    console.log('Payment date loaded:', paymentDate, 'from payment:', {
      payment_date: payment.payment_date,
      date: payment.date,
      created_at: payment.created_at,
      formatted_date: paymentDate
    });
    
    // Double-check the date format before setting
    if (!paymentDate || !paymentDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.warn('Invalid date format detected, using today:', paymentDate);
      paymentDate = todayDate;
    }
    
    setEditingPayment(payment);
    setEditFormData({
      student_id: payment.student_id?.toString() || '',
      course_id: payment.course_id?.toString() || '',
      course_package_id: packageId.toString(),
      amount: payment.amount?.toString() || '',
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
      date: paymentDate, // This should be in YYYY-MM-DD format
      notes: payment.notes || '',
    });
    setRemainingPayment({
      amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '',
      date: todayDate, // Always set to today's date for remaining payment
      notes: '',
    });
    
    // Force a re-render by logging the state
    console.log('Edit form data set:', {
      date: paymentDate,
      amount: payment.amount?.toString() || '',
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00'
    });
    
    setIsEditModalOpen(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingPayment(null);
    setEditFormData({
      student_id: '',
      course_id: '',
      course_package_id: '',
      amount: '',
      remaining_amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setRemainingPayment({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  // Handle edit submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate first payment date
      let paymentDate = editFormData.date;
      
      console.log('handleEditSubmit - editFormData:', editFormData);
      console.log('handleEditSubmit - paymentDate before processing:', paymentDate);
      
      if (!paymentDate || paymentDate === '' || paymentDate === null || paymentDate === undefined) {
        alert('يرجى اختيار تاريخ الدفعة الأولى');
        setSubmitting(false);
        return;
      }

      // Ensure paymentDate is a string
      paymentDate = String(paymentDate).trim();
      
      if (paymentDate === '' || paymentDate === 'null' || paymentDate === 'undefined') {
        alert('يرجى اختيار تاريخ الدفعة الأولى');
        setSubmitting(false);
        return;
      }

      // Format date to YYYY-MM-DD
      if (paymentDate.includes('T')) {
        paymentDate = paymentDate.split('T')[0];
      } else if (paymentDate.includes(' ')) {
        paymentDate = paymentDate.split(' ')[0];
      }
      
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(paymentDate)) {
        // Try to parse and reformat
        const parsedDate = new Date(paymentDate);
        if (isNaN(parsedDate.getTime())) {
          alert('تاريخ غير صالح. يرجى اختيار تاريخ صحيح');
          setSubmitting(false);
          return;
        }
        paymentDate = parsedDate.toISOString().split('T')[0];
      }

      // Validate amount
      const amount = parseFloat(editFormData.amount);
      if (isNaN(amount) || amount <= 0) {
        alert('يرجى إدخال مبلغ صحيح');
        setSubmitting(false);
        return;
      }

      console.log('Submitting payment with date:', paymentDate, 'from editFormData.date:', editFormData.date);

      // Update original payment
      const data = {
        amount: parseFloat(amount), // Ensure it's a number
        payment_date: paymentDate,
        notes: editFormData.notes || '',
      };
      
      // Final validation before sending
      if (isNaN(data.amount) || data.amount <= 0) {
        alert('المبلغ غير صالح');
        setSubmitting(false);
        return;
      }
      
      if (!data.payment_date || !data.payment_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        alert('تاريخ الدفع غير صالح');
        setSubmitting(false);
        return;
      }
      
      console.log('Sending data to API:', data);
      console.log('Payment ID:', editingPayment.id);
      console.log('Data type check:', {
        amount: typeof amount,
        amountValue: amount,
        paymentDate: typeof paymentDate,
        paymentDateValue: paymentDate,
        notes: typeof (editFormData.notes || ''),
      });
      
      // Ensure amount is a number, not NaN
      if (isNaN(amount) || amount <= 0) {
        alert('المبلغ غير صالح');
        setSubmitting(false);
        return;
      }
      
      // Ensure payment_date is a valid date string
      if (!paymentDate || !paymentDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        alert('تاريخ الدفع غير صالح');
        setSubmitting(false);
        return;
      }
      
      try {
        await api.put(`/payments/${editingPayment.id}`, data);
      } catch (error) {
        console.error('API Error:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error validation:', error.response?.data?.errors);
        throw error; // Re-throw to be caught by outer catch
      }
      
      // If remaining payment amount is provided, create new payment
      if (remainingPayment.amount && parseFloat(remainingPayment.amount) > 0) {
        // Validate remaining payment date
        if (!remainingPayment.date || remainingPayment.date.trim() === '') {
          alert('يرجى اختيار تاريخ الدفعة الثانية');
          setSubmitting(false);
          return;
        }

        // Validate remaining payment data
        const remainingAmount = parseFloat(remainingPayment.amount);
        if (isNaN(remainingAmount) || remainingAmount <= 0) {
          alert('مبلغ الدفعة المتبقية غير صالح');
          setSubmitting(false);
          return;
        }

        const remainingDate = remainingPayment.date;
        if (!remainingDate || !remainingDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          alert('تاريخ الدفعة المتبقية غير صالح');
          setSubmitting(false);
          return;
        }

        const newPaymentData = {
          student_id: parseInt(editFormData.student_id),
          course_id: parseInt(editFormData.course_id),
          amount: remainingAmount,
          payment_date: remainingDate,
          status: 'completed',
          notes: remainingPayment.notes || 'دفعة المتبقي',
        };
        
        console.log('Creating remaining payment:', newPaymentData);
        
        await api.post('/payments', newPaymentData);
      }
      
      fetchPayments();
      closeEditModal();
      setSubmitting(false);
    } catch (error) {
      console.error('Error updating payment:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        validation: error.response?.data?.errors
      });
      
      // Show detailed error message
      let errorMessage = 'حدث خطأ أثناء التعديل';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorList = Object.entries(errors).map(([key, value]) => {
          return `${key}: ${Array.isArray(value) ? value.join(', ') : value}`;
        }).join('\n');
        errorMessage = `خطأ في التحقق من البيانات:\n${errorList}`;
      }
      
      alert(errorMessage);
      setSubmitting(false);
    }
  };

  // Open payment info modal
  const openPaymentInfoModal = async (studentId, courseId, studentName, payment = null) => {
    try {
      // Always fetch course details from API to ensure we have students array
      let course = null;
      if (courseId) {
        try {
          const courseResponse = await api.get(`/courses/${courseId}`);
          course = courseResponse.data;
          console.log('Fetched course with students:', course?.students?.length || 0, 'students');
        } catch (error) {
          console.error('Error fetching course details:', error);
          // If API call fails, try to use the course from payment object
          course = payment?.course || null;
        }
      } else {
        // Fallback to payment course if no courseId
        course = payment?.course || null;
      }
      
      setPaymentInfoModal({
        open: true,
        studentId,
        courseId,
        studentName,
        course, // Store course object for dual courses
        payments: [],
        loading: true,
      });

      // For dual courses, fetch payments for both students
      if (course?.is_dual && course?.students && course.students.length > 1) {
        const allStudentsPayments = [];
        
        // Fetch payments for each student (even if they have no payments, show them)
        for (const student of course.students) {
          let studentPayments = [];
          let currentPage = 1;
          let hasMorePages = true;

          while (hasMorePages) {
            try {
              const response = await api.get('/payments', {
                params: {
                  student_id: student.id,
                  course_id: courseId,
                  page: currentPage,
                },
              });

              const responseData = response.data;
              const paymentsData = responseData?.data || responseData || [];
              
              if (Array.isArray(paymentsData) && paymentsData.length > 0) {
                studentPayments = [...studentPayments, ...paymentsData];
                hasMorePages = responseData?.current_page < responseData?.last_page;
                currentPage++;
              } else {
                hasMorePages = false;
              }
            } catch (error) {
              console.error(`Error fetching payments for student ${student.id}:`, error);
              hasMorePages = false;
            }
          }

          // Filter only completed/paid payments for display
          const completedPayments = studentPayments
            .filter(p => (p.status === 'completed' || p.status === 'paid'))
            .sort((a, b) => {
              const createdA = new Date(a.created_at || a.date || 0);
              const createdB = new Date(b.created_at || b.date || 0);
              if (createdA.getTime() !== createdB.getTime()) {
                return createdA - createdB;
              }
              return (a.id || 0) - (b.id || 0);
            });

          // Always add student to the list, even if they have no payments
          allStudentsPayments.push({
            studentId: student.id,
            studentName: student.name,
            payments: completedPayments,
          });
          
          console.log(`Student ${student.name} (ID: ${student.id}) - Payments: ${completedPayments.length}`);
        }
        
        console.log('All students payments:', allStudentsPayments.map(s => ({ name: s.studentName, paymentsCount: s.payments.length })));

        setPaymentInfoModal(prev => ({
          ...prev,
          payments: allStudentsPayments, // Array of {studentId, studentName, payments}
          loading: false,
        }));
      } else {
        // Single course: fetch payments for one student
        let allPayments = [];
        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages) {
          const response = await api.get('/payments', {
            params: {
              student_id: studentId,
              course_id: courseId,
              page: currentPage,
            },
          });

          const responseData = response.data;
          const paymentsData = responseData?.data || responseData || [];
          
          if (Array.isArray(paymentsData) && paymentsData.length > 0) {
            allPayments = [...allPayments, ...paymentsData];
            hasMorePages = responseData?.current_page < responseData?.last_page;
            currentPage++;
          } else {
            hasMorePages = false;
          }
        }

        const coursePayments = allPayments
          .filter(p => (p.status === 'completed' || p.status === 'paid'))
          .sort((a, b) => {
            const createdA = new Date(a.created_at || a.date || 0);
            const createdB = new Date(b.created_at || b.date || 0);
            if (createdA.getTime() !== createdB.getTime()) {
              return createdA - createdB;
            }
            return (a.id || 0) - (b.id || 0);
          });

        setPaymentInfoModal(prev => ({
          ...prev,
          payments: coursePayments, // Array of payment objects
          loading: false,
        }));
      }
    } catch (error) {
      console.error('Error fetching payment info:', error);
      setPaymentInfoModal(prev => ({
        ...prev,
        loading: false,
      }));
    }
  };

  // Close payment info modal
  const closePaymentInfoModal = () => {
    setPaymentInfoModal({
      open: false,
      studentId: null,
      courseId: null,
      studentName: '',
      course: null,
      payments: [],
      loading: false,
    });
  };


  // Calculate price per student for dual courses (helper function)
  const getStudentPriceForPackage = (packageName, isDual) => {
    if (!isDual) {
      return 0; // Will use package price for single courses
    }
    
    // For dual courses, each student pays a fixed amount based on package
    if (packageName?.includes('بمزاجي') || packageName === 'بمزاجي') {
      return 90000;
    } else if (packageName?.includes('توازن') || packageName?.includes('التوازن')) {
      return 135000;
    } else if (packageName?.includes('سرعة') || packageName?.includes('السرعة')) {
      return 225000;
    }
    
    return 0;
  };

  const handlePackageChange = (packageId) => {
    const selectedPackage = packages.find((p) => p.id.toString() === packageId);
    const selectedCourse = courses.find(c => c.id === parseInt(formData.course_id));
    const isDual = selectedCourse?.is_dual || false;
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPriceForPackage(selectedPackage?.name, isDual);
    const packagePrice = isDual && studentPrice > 0 
      ? studentPrice 
      : (selectedPackage ? (selectedPackage.price || 0) : 0);
    
    const paidAmount = parseFloat(formData.amount) || 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      course_package_id: packageId,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
  };

  const handleAmountChange = (value) => {
    const paidAmount = parseFloat(value) || 0;
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    const selectedCourse = courses.find(c => c.id === parseInt(formData.course_id));
    const isDual = selectedCourse?.is_dual || false;
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPriceForPackage(selectedPackage?.name, isDual);
    const packagePrice = isDual && studentPrice > 0 
      ? studentPrice 
      : (selectedPackage ? (selectedPackage.price || 0) : 0);
    
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      amount: value,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
  };

  const getStudentCourses = () => {
    if (!formData.student_id) return [];
    const studentId = formData.student_id.toString();
    
    // Combine courses from both sources (regular courses and dual courses data)
    const allCourses = [...courses];
    
    // Add dual courses from dualCoursesData if they're not already in courses
    dualCoursesData.forEach(dualCourse => {
      const exists = allCourses.some(c => c.id === dualCourse.id);
      if (!exists) {
        allCourses.push(dualCourse);
      }
    });
    
    return allCourses.filter((c) => {
      // For single courses: check student_id directly
      if (c.student_id?.toString() === studentId) {
        return true;
      }
      
      // For dual courses: check if student is in students array
      if (c.students && Array.isArray(c.students)) {
        return c.students.some(s => {
          const studentIdFromArray = typeof s === 'object' ? s.id?.toString() : s?.toString();
          return studentIdFromArray === studentId;
        });
      }
      
      // Also check if course has student object (for backward compatibility)
      if (c.student && typeof c.student === 'object' && c.student.id?.toString() === studentId) {
        return true;
      }
      
      return false;
    });
  };



  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          <p className="font-semibold">خطأ</p>
          <p>{error}</p>
          <button 
            onClick={() => {
              setError(null);
              fetchPayments();
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="page-title text-base sm:text-2xl">إدارة المدفوعات</h1>
          <p className="page-subtitle text-[10px] sm:text-sm">تسجيل ومتابعة المدفوعات</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-base px-3 sm:px-4 py-1.5 sm:py-2">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          إضافة دفعة
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              id="search-payments"
              name="search-payments"
              placeholder="البحث باسم الطالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pr-10"
            />
          </div>
        </div>
      </div>

      {/* Payments Tables - Separated by course type */}
      {payments.length === 0 ? (
        <EmptyState
          title="لا توجد مدفوعات"
          description="قم بتسجيل أول دفعة للبدء"
          icon={CreditCard}
          action={
            <button onClick={() => openModal()} className="btn-primary">
              إضافة دفعة
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Single Courses Payments */}
          {(() => {
            const singleCoursePayments = payments.filter(p => {
              const isDual = p.course?.is_dual || false;
              return !isDual;
            });

            return singleCoursePayments.length > 0 ? (
              <div className="card">
                <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 sm:gap-2">
                    <span>الكورسات الفردية</span>
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] sm:text-xs font-semibold">
                      {singleCoursePayments.length} دفعة
                    </span>
                  </h2>
                </div>
                {/* Mobile Cards View */}
                <div className="md:hidden">
                  {(() => {
                    const itemsPerPage = 5;
                    
                    // If not showing all, only show first 5
                    const paymentsToShow = showAllSinglePayments ? singleCoursePayments : singleCoursePayments.slice(0, itemsPerPage);
                    
                    // Calculate pagination only when showing all
                    const totalPages = showAllSinglePayments ? Math.ceil(singleCoursePayments.length / itemsPerPage) : 1;
                    const startIndex = showAllSinglePayments ? (singlePaymentsPage - 1) * itemsPerPage : 0;
                    const endIndex = showAllSinglePayments ? startIndex + itemsPerPage : itemsPerPage;
                    const currentPayments = showAllSinglePayments 
                      ? singleCoursePayments.slice(startIndex, endIndex)
                      : paymentsToShow;
                    
                    return (
                      <>
                        <div className="space-y-2 p-2">
                          {currentPayments.length === 0 ? (
                            <div className="text-center py-6 text-[var(--color-text-muted)] text-xs">
                              لا توجد مدفوعات
                            </div>
                          ) : (
                            currentPayments.map((payment, index) => {
                              const paymentStatus = getPaymentStatus(payment);
                              const firstDate = getFirstPaymentDate(payment.student_id, payment.course_id);
                              const displayIndex = showAllSinglePayments ? startIndex + index + 1 : index + 1;
                              return (
                                <div key={payment.id} className="p-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 max-w-full overflow-hidden">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-bold text-gray-800 dark:text-white">{displayIndex}</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => openPaymentInfoModal(
                                          payment.student_id,
                                          payment.course_id,
                                          payment.student?.name || '-',
                                          payment
                                        )}
                                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                        title="عرض معلومات الدفعات"
                                      >
                                        <Info className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => openEditModal(payment)}
                                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                        title="تعديل الدفعة"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    
                                    <div className="col-span-2 flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الطالب:</span>
                                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate flex-1">{payment.student?.name || '-'}</span>
                                    </div>
                                    
                                    <div className="col-span-2 flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الهاتف:</span>
                                      <span className="text-sm text-gray-800 dark:text-white">{payment.student?.phone || '-'}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الباقة:</span>
                                      <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">التاريخ:</span>
                                      <span className="text-sm text-gray-800 dark:text-white">
                                        {firstDate ? formatDateSimple(firstDate) : '—'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">المدفوع:</span>
                                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(payment.amount)}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">المتبقي:</span>
                                        {paymentStatus.amount > 0 ? (
                                          <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                            {formatCurrency(paymentStatus.amount)}
                                          </span>
                                        ) : (
                                          <span className={`badge ${paymentStatus.badge} text-xs px-1 py-0.5`}>
                                            {paymentStatus.label}
                                          </span>
                                        )}
                                      </div>
                                      {paymentStatus.amount > 0 && (
                                        <button
                                          onClick={() => openModal(payment)}
                                          className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                          title="إضافة المتبقي"
                                        >
                                          إضافة
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        
                        {/* Show "عرض الكل" button if not showing all and there are more than 5 payments */}
                        {!showAllSinglePayments && singleCoursePayments.length > itemsPerPage && (
                          <div className="flex items-center justify-center p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <button
                              onClick={() => {
                                setShowAllSinglePayments(true);
                                setSinglePaymentsPage(1);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] bg-blue-500 text-white hover:bg-blue-600"
                            >
                              عرض الكل
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        
                        {/* Pagination Controls - Only show when showing all */}
                        {showAllSinglePayments && totalPages > 1 && (
                          <div className="flex items-center justify-between p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <button
                              onClick={() => setSinglePaymentsPage(prev => Math.max(1, prev - 1))}
                              disabled={singlePaymentsPage === 1}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                                singlePaymentsPage === 1
                                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              <ChevronRight className="w-3 h-3" />
                              السابق
                            </button>

                            <span className="text-[9px] text-gray-600 dark:text-gray-400">
                              صفحة {singlePaymentsPage} من {totalPages}
                            </span>

                            <button
                              onClick={() => setSinglePaymentsPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={singlePaymentsPage === totalPages}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                                singlePaymentsPage === totalPages
                                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              التالي
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
                  <table className="table text-sm min-w-[800px]">
                    <thead>
                      <tr>
                        <th className="text-center text-xs py-2 px-2">#</th>
                        <th className="text-center text-xs py-2 px-2">اسم الطالب</th>
                        <th className="text-center text-xs py-2 px-2">رقم الهاتف</th>
                        <th className="text-center text-xs py-2 px-2">الباقة</th>
                        <th className="text-center text-xs py-2 px-2">تاريخ الدفع</th>
                        <th className="text-center text-xs py-2 px-2">المبلغ المدفوع</th>
                        <th className="text-center text-xs py-2 px-2">طريقة الدفع</th>
                        <th className="text-center text-xs py-2 px-2">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singleCoursePayments.map((payment, index) => {
                        const paymentStatus = getPaymentStatus(payment);
                        return (
                          <tr key={payment.id}>
                            <td className="font-semibold text-center text-xs py-2 px-2">{index + 1}</td>
                            <td className="text-center text-xs py-2 px-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openPaymentInfoModal(
                                    payment.student_id,
                                    payment.course_id,
                                    payment.student?.name || '-',
                                    payment
                                  )}
                                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                  title="عرض معلومات الدفعات"
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                <div className="flex flex-col items-center">
                                  <span className="font-semibold text-xs">{payment.student?.name || '-'}</span>
                                  <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    ({payment.course?.course_package?.name || payment.course?.coursePackage?.name || 'كورس'})
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              <span className="text-[var(--color-text-primary)]">
                                {payment.student?.phone || '-'}
                              </span>
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              <span className="font-medium text-[var(--color-text-primary)]">
                                {payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}
                              </span>
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              {(() => {
                                const firstDate = getFirstPaymentDate(payment.student_id, payment.course_id);
                                return firstDate ? formatDateSimple(firstDate) : '—';
                              })()}
                            </td>
                            <td className="font-bold text-emerald-600 dark:text-emerald-400 text-center text-xs py-2 px-2">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="text-center text-[10px] py-2 px-2">
                              {getPaymentMethodBadge(payment.payment_method || payment.course?.payment_method)}
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              {paymentStatus.amount > 0 ? (
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">
                                    {formatCurrency(paymentStatus.amount)}
                                  </span>
                                  <button
                                    onClick={() => openModal(payment)}
                                    className="text-[9px] px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    title="إضافة المتبقي"
                                  >
                                    إضافة
                                  </button>
                                </div>
                              ) : (
                                <span className={`badge ${paymentStatus.badge} text-xs`}>
                                  {paymentStatus.label}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;
          })()}

          {/* Dual Courses Payments */}
          {(() => {
            // Build rows for dual courses: show all students for each dual course
            const dualCoursesRows = [];
            let rowIndex = 0;

            // Group payments by course_id
            const paymentsByCourse = {};
            payments.forEach(payment => {
              if (payment.course?.is_dual) {
                const courseId = payment.course_id;
                if (!paymentsByCourse[courseId]) {
                  paymentsByCourse[courseId] = [];
                }
                paymentsByCourse[courseId].push(payment);
              }
            });

            // For each dual course, show all students
            dualCoursesData.forEach(course => {
              if (course.students && course.students.length > 1) {
                course.students.forEach(student => {
                  // Find payment for this student in this course
                  const studentPayments = paymentsByCourse[course.id]?.filter(
                    p => p.student_id === student.id
                  ) || [];
                  
                  // Get the first payment (if any) for display
                  const firstPayment = studentPayments.length > 0 ? studentPayments[0] : null;
                  
                  // Create a row for this student
                  dualCoursesRows.push({
                    courseId: course.id,
                    course: course,
                    student: student,
                    studentId: student.id,
                    studentName: student.name,
                    studentPhone: student.phone,
                    payment: firstPayment, // First payment for this student in this course
                    allPayments: studentPayments, // All payments for this student in this course
                  });
                });
              }
            });

            return dualCoursesRows.length > 0 ? (
              <div className="card">
                <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 sm:gap-2">
                    <span>الكورسات الثنائية</span>
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] sm:text-xs font-semibold">
                      {dualCoursesRows.length} طالب
                    </span>
                  </h2>
                </div>
                {/* Mobile Cards View */}
                <div className="md:hidden">
                  {(() => {
                    const itemsPerPage = 5;
                    
                    // If not showing all, only show first 5
                    const rowsToShow = showAllDualPayments ? dualCoursesRows : dualCoursesRows.slice(0, itemsPerPage);
                    
                    // Calculate pagination only when showing all
                    const totalPages = showAllDualPayments ? Math.ceil(dualCoursesRows.length / itemsPerPage) : 1;
                    const startIndex = showAllDualPayments ? (dualPaymentsPage - 1) * itemsPerPage : 0;
                    const endIndex = showAllDualPayments ? startIndex + itemsPerPage : itemsPerPage;
                    const currentRows = showAllDualPayments 
                      ? dualCoursesRows.slice(startIndex, endIndex)
                      : rowsToShow;
                    
                    return (
                      <>
                        <div className="space-y-2 p-2">
                          {currentRows.length === 0 ? (
                            <div className="text-center py-6 text-[var(--color-text-muted)] text-xs">
                              لا توجد مدفوعات
                            </div>
                          ) : (
                            currentRows.map((row, index) => {
                              // Calculate payment status for this student
                              const totalPaid = row.allPayments
                                .filter(p => p.status === 'completed' || p.status === 'paid')
                                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                              
                              const studentPrice = getStudentPrice(row.course);
                              const remaining = studentPrice > 0 ? Math.max(0, studentPrice - totalPaid) : 0;
                              
                              const paymentStatus = remaining > 0 
                                ? { label: '', badge: 'badge-warning', amount: remaining }
                                : { label: 'مكتمل', badge: 'badge-success', amount: 0 };

                              // Get first payment date
                              const firstPayment = row.allPayments
                                .filter(p => p.status === 'completed' || p.status === 'paid')
                                .sort((a, b) => {
                                  const dateA = new Date(a.created_at || a.payment_date || 0);
                                  const dateB = new Date(b.created_at || b.payment_date || 0);
                                  return dateA - dateB;
                                })[0];
                              
                              const firstDate = firstPayment 
                                ? (firstPayment.payment_date || firstPayment.created_at) 
                                : null;

                              const displayIndex = showAllDualPayments ? startIndex + index + 1 : index + 1;

                              return (
                                <div key={`${row.courseId}-${row.studentId}`} className="p-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 max-w-full overflow-hidden">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-bold text-gray-800 dark:text-white">{displayIndex}</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => openPaymentInfoModal(
                                          row.studentId,
                                          row.courseId,
                                          row.studentName,
                                          row.payment
                                        )}
                                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                        title="عرض معلومات الدفعات"
                                      >
                                        <Info className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => openEditModal(row.payment)}
                                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                        title="تعديل الدفعة"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    
                                    <div className="col-span-2 flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الطالب:</span>
                                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate flex-1">{row.studentName}</span>
                                    </div>
                                    
                                    <div className="col-span-2 flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الهاتف:</span>
                                      <span className="text-sm text-gray-800 dark:text-white">{row.studentPhone || '-'}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">الباقة:</span>
                                      <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{row.course?.course_package?.name || row.course?.coursePackage?.name || '-'}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">التاريخ:</span>
                                      <span className="text-sm text-gray-800 dark:text-white">
                                        {firstDate ? formatDateSimple(firstDate) : '—'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">المدفوع:</span>
                                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(totalPaid)}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">المتبقي:</span>
                                      {paymentStatus.amount > 0 ? (
                                        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                          {formatCurrency(paymentStatus.amount)}
                                        </span>
                                      ) : (
                                        <span className={`badge ${paymentStatus.badge} text-xs px-1 py-0.5`}>
                                          {paymentStatus.label}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">طريقة الدفع:</span>
                                      {getPaymentMethodBadge(row.payment?.payment_method || row.course?.payment_method)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        
                        {/* Show "عرض الكل" button if not showing all and there are more than 5 payments */}
                        {!showAllDualPayments && dualCoursesRows.length > itemsPerPage && (
                          <div className="flex items-center justify-center p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <button
                              onClick={() => {
                                setShowAllDualPayments(true);
                                setDualPaymentsPage(1);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] bg-purple-500 text-white hover:bg-purple-600"
                            >
                              عرض الكل
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        
                        {/* Pagination Controls - Only show when showing all */}
                        {showAllDualPayments && totalPages > 1 && (
                          <div className="flex items-center justify-between p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <button
                              onClick={() => setDualPaymentsPage(prev => Math.max(1, prev - 1))}
                              disabled={dualPaymentsPage === 1}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                                dualPaymentsPage === 1
                                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                  : 'bg-purple-500 text-white hover:bg-purple-600'
                              }`}
                            >
                              <ChevronRight className="w-3 h-3" />
                              السابق
                            </button>

                            <span className="text-[9px] text-gray-600 dark:text-gray-400">
                              صفحة {dualPaymentsPage} من {totalPages}
                            </span>

                            <button
                              onClick={() => setDualPaymentsPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={dualPaymentsPage === totalPages}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                                dualPaymentsPage === totalPages
                                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                  : 'bg-purple-500 text-white hover:bg-purple-600'
                              }`}
                            >
                              التالي
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
                  <table className="table text-sm min-w-[800px]">
                    <thead>
                      <tr>
                        <th className="text-center text-xs py-2 px-2">#</th>
                        <th className="text-center text-xs py-2 px-2">اسم الطالب</th>
                        <th className="text-center text-xs py-2 px-2">رقم الهاتف</th>
                        <th className="text-center text-xs py-2 px-2">الباقة</th>
                        <th className="text-center text-xs py-2 px-2">تاريخ الدفع</th>
                        <th className="text-center text-xs py-2 px-2">المبلغ المدفوع</th>
                        <th className="text-center text-xs py-2 px-2">طريقة الدفع</th>
                        <th className="text-center text-xs py-2 px-2">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dualCoursesRows.map((row, index) => {
                        // Calculate payment status for this student
                        const totalPaid = row.allPayments
                          .filter(p => p.status === 'completed' || p.status === 'paid')
                          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                        
                        const studentPrice = getStudentPrice(row.course);
                        const remaining = studentPrice > 0 ? Math.max(0, studentPrice - totalPaid) : 0;
                        
                        const paymentStatus = remaining > 0 
                          ? { label: '', badge: 'badge-warning', amount: remaining }
                          : { label: 'مكتمل', badge: 'badge-success', amount: 0 };

                        // Get first payment date
                        const firstPayment = row.allPayments
                          .filter(p => p.status === 'completed' || p.status === 'paid')
                          .sort((a, b) => {
                            const dateA = new Date(a.created_at || a.payment_date || 0);
                            const dateB = new Date(b.created_at || b.payment_date || 0);
                            return dateA - dateB;
                          })[0];

                        const firstDate = firstPayment 
                          ? (firstPayment.payment_date || firstPayment.created_at)
                          : null;

                        // Create a mock payment object for getPaymentStatus if needed
                        const mockPayment = row.payment || {
                          id: `mock-${row.courseId}-${row.studentId}`,
                          course_id: row.courseId,
                          student_id: row.studentId,
                          course: row.course,
                          student: row.student,
                          amount: totalPaid,
                        };

                        return (
                          <tr key={`${row.courseId}-${row.studentId}`}>
                            <td className="font-semibold text-center text-xs py-2 px-2">{index + 1}</td>
                            <td className="text-center text-xs py-2 px-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openPaymentInfoModal(
                                    row.studentId,
                                    row.courseId,
                                    row.studentName,
                                    mockPayment
                                  )}
                                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                  title="عرض معلومات الدفعات"
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                <div className="flex flex-col items-center">
                                  <span className="font-semibold text-xs">{row.studentName}</span>
                                  <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    ({row.course?.course_package?.name || row.course?.coursePackage?.name || 'كورس'})
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              <span className="text-[var(--color-text-primary)]">
                                {row.studentPhone || '-'}
                              </span>
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              <span className="font-medium text-[var(--color-text-primary)]">
                                {row.course?.course_package?.name || row.course?.coursePackage?.name || '-'}
                              </span>
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              {firstDate ? formatDateSimple(firstDate) : '—'}
                            </td>
                            <td className="font-bold text-emerald-600 dark:text-emerald-400 text-center text-xs py-2 px-2">
                              {totalPaid > 0 ? formatCurrency(totalPaid) : '—'}
                            </td>
                            <td className="text-center text-[10px] py-2 px-2">
                              {getPaymentMethodBadge(row.payment?.payment_method || row.course?.payment_method)}
                            </td>
                            <td className="text-center text-xs py-2 px-2">
                              {paymentStatus.amount > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">
                                  {formatCurrency(paymentStatus.amount)}
                                </span>
                              ) : (
                                <span className={`badge ${paymentStatus.badge} text-xs`}>
                                  {paymentStatus.label}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="إضافة دفعة جديدة"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="payment-student">الطالب *</label>
              <select
                id="payment-student"
                name="payment-student"
                value={formData.student_id}
                onChange={(e) => {
                  const studentId = e.target.value;
                  setFormData({ ...formData, student_id: studentId, course_id: '', course_package_id: '', amount: '', remaining_amount: '' });
                }}
                className="select"
                required
              >
                <option value="">اختر الطالب</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="payment-course">الكورس *</label>
              <select
                id="payment-course"
                name="payment-course"
                value={formData.course_id}
                onChange={(e) => {
                  const courseId = e.target.value;
                  const selectedCourse = courses.find(c => c.id.toString() === courseId);
                  const packageId = selectedCourse?.course_package_id || selectedCourse?.coursePackage?.id || '';
                  const rawPrice = selectedCourse?.course_package?.price || selectedCourse?.coursePackage?.price || 0;
                  const packagePrice = getPackagePrice(rawPrice);
                  
                  // Calculate total paid for this course and student
                  const totalPaid = payments
                    .filter(p => p.course_id?.toString() === courseId && p.student_id?.toString() === formData.student_id && p.status === 'completed')
                    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                  
                  const remainingAmount = packagePrice - totalPaid;
                  
                  setFormData({
                    ...formData,
                    course_id: courseId,
                    course_package_id: packageId.toString(),
                    remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
                  });
                }}
                className="select"
                required
                disabled={!formData.student_id}
              >
                <option value="">اختر الكورس</option>
                {formData.student_id && getStudentCourses().map((course) => {
                  const isDual = course.is_dual || (course.students && Array.isArray(course.students) && course.students.length > 1);
                  const courseName = course.course_package?.name || course.coursePackage?.name || `كورس #${course.id}`;
                  return (
                    <option key={course.id} value={course.id}>
                      {courseName} {isDual ? '(ثنائي)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {formData.course_id && (
            <div>
              <label className="label" htmlFor="payment-package">الباقة</label>
              <input
                type="text"
                id="payment-package"
                value={(() => {
                  const selectedCourse = courses.find(c => c.id.toString() === formData.course_id);
                  return selectedCourse?.course_package?.name || selectedCourse?.coursePackage?.name || '-';
                })()}
                className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                readOnly
                disabled
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المبلغ المدفوع (د.ع) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="input"
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="payment-remaining">المتبقي (د.ع)</label>
              <input
                type="number"
                id="payment-remaining"
                name="payment-remaining"
                value={formData.remaining_amount}
                className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                placeholder="0.00"
                readOnly
                disabled
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="payment-date">التاريخ *</label>
            <input
              type="date"
              id="payment-date"
              name="payment-date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="payment-notes">ملاحظات</label>
            <textarea
              id="payment-notes"
              name="payment-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input min-h-[80px]"
              placeholder="أضف أي ملاحظات..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeModal} className="btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جاري الحفظ...' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Completion Modal */}
      {paymentCompletionModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                  تم إتمام الدفع بنجاح
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  معلومات الدفع للطالب: {paymentCompletionModal.studentName}
                </p>
              </div>
              <button
                onClick={closePaymentCompletionModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-300">
                      تم إتمام دفع الكورس بالكامل
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {paymentCompletionModal.studentName}
                    </p>
                  </div>
                </div>
              </div>

              {paymentCompletionModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                </div>
              ) : paymentCompletionModal.coursesPayments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  لا توجد دفعات مسجلة
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {paymentCompletionModal.coursesPayments.map((courseData, courseIndex) => (
                    <div key={courseData.courseId} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white">
                          {courseData.courseName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          إجمالي الدفعات: {courseData.payments.length} دفعة
                        </p>
                      </div>

                      <div className="space-y-2">
                        {courseData.payments.map((payment, paymentIndex) => {
                          // Format date properly
                          const paymentDate = new Date(payment.date);
                          const formattedDate = paymentDate && !isNaN(paymentDate.getTime())
                            ? paymentDate.toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : 'تاريخ غير محدد';

                          return (
                            <div key={payment.id || paymentIndex} className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  الدفعة {paymentIndex + 1}
                                </p>
                                <p className="text-xs font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(payment.amount)}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  تاريخ الدفع:
                                </p>
                                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                  {formattedDate}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closePaymentCompletionModal}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="تعديل الدفعة"
      >
        <form onSubmit={handleEditSubmit} className="space-y-3 sm:space-y-4">
          {/* Original Payment Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 sm:p-4 border border-gray-200 dark:border-gray-600">
            <h3 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">معلومات الدفعة الأصلية</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div>
                <label className="label text-[10px] sm:text-sm" htmlFor="edit-payment-amount">المبلغ المدفوع (د.ع) *</label>
                <input
                  type="number"
                  id="edit-payment-amount"
                  name="edit-payment-amount"
                  value={editFormData.amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditFormData({ ...editFormData, amount: value });
                    // Recalculate remaining amount
                    const course = editingPayment?.course;
                    const rawPrice = course?.course_package?.price || course?.coursePackage?.price || 0;
    const packagePrice = getPackagePrice(rawPrice);
                    const totalPaid = payments
                      .filter(p => p.course_id === editingPayment?.course_id && p.student_id === editingPayment?.student_id && p.status === 'completed' && p.id !== editingPayment?.id)
                      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) + (parseFloat(value) || 0);
                    const newRemaining = packagePrice - totalPaid;
                    setEditFormData(prev => ({
                      ...prev,
                      remaining_amount: newRemaining > 0 ? newRemaining.toFixed(2) : '0.00',
                    }));
                  }}
                  className="input text-xs sm:text-sm py-1.5 sm:py-2"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="label text-[10px] sm:text-sm" htmlFor="edit-payment-date">تاريخ الدفع *</label>
                <input
                  type="date"
                  id="edit-payment-date"
                  name="edit-payment-date"
                  value={editFormData.date || ''}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    console.log('First payment date changed to:', newDate);
                    setEditFormData({ ...editFormData, date: newDate });
                  }}
                  className="input text-xs sm:text-sm py-1.5 sm:py-2"
                  required
                  min="2020-01-01"
                  max={new Date().toISOString().split('T')[0]}
                />
                {!editFormData.date && (
                  <p className="text-red-500 text-[9px] sm:text-xs mt-1">يرجى اختيار تاريخ الدفع</p>
                )}
                {editFormData.date && (
                  <p className="text-gray-500 text-[9px] sm:text-xs mt-1">تاريخ الدفعة الأولى: {editFormData.date}</p>
                )}
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <label className="label text-[10px] sm:text-sm" htmlFor="edit-payment-notes">ملاحظات</label>
              <textarea
                id="edit-payment-notes"
                name="edit-payment-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className="input min-h-[50px] sm:min-h-[60px] text-xs sm:text-sm py-1.5 sm:py-2"
                placeholder="أضف أي ملاحظات..."
              />
            </div>
          </div>

          {/* Remaining Payment Section */}
          {parseFloat(editFormData.remaining_amount) > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 sm:p-4 border border-blue-200 dark:border-blue-700">
              <h3 className="text-[10px] sm:text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 sm:mb-3">
                إضافة دفعة المتبقي
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="label text-[10px] sm:text-sm">المبلغ المتبقي (د.ع)</label>
                  <input
                    type="number"
                    value={remainingPayment.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      const maxAmount = parseFloat(editFormData.remaining_amount) || 0;
                      const numValue = parseFloat(value) || 0;
                      setRemainingPayment({ 
                        ...remainingPayment, 
                        amount: numValue > maxAmount ? maxAmount.toString() : value 
                      });
                    }}
                    className="input text-xs sm:text-sm py-1.5 sm:py-2"
                    placeholder={editFormData.remaining_amount}
                    min="0"
                    step="0.01"
                    max={editFormData.remaining_amount}
                  />
                  <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                    المتبقي الكلي: {formatCurrency(editFormData.remaining_amount)}
                  </p>
                </div>
                <div>
                  <label className="label text-[10px] sm:text-sm" htmlFor="remaining-payment-date">
                    تاريخ الدفعة الثانية {remainingPayment.amount && parseFloat(remainingPayment.amount) > 0 ? '*' : ''}
                  </label>
                  <input
                    type="date"
                    id="remaining-payment-date"
                    name="remaining-payment-date"
                    value={remainingPayment.date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      console.log('Second payment date changed to:', newDate);
                      setRemainingPayment({ ...remainingPayment, date: newDate });
                    }}
                    className="input text-xs sm:text-sm py-1.5 sm:py-2"
                    required={remainingPayment.amount && parseFloat(remainingPayment.amount) > 0}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {remainingPayment.date && (
                    <p className="text-gray-500 text-[9px] sm:text-xs mt-1">تاريخ الدفعة الثانية: {remainingPayment.date}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <label className="label text-[10px] sm:text-sm" htmlFor="remaining-payment-notes">ملاحظات دفعة المتبقي</label>
                <textarea
                  id="remaining-payment-notes"
                  name="remaining-payment-notes"
                  value={remainingPayment.notes}
                  onChange={(e) => setRemainingPayment({ ...remainingPayment, notes: e.target.value })}
                  className="input min-h-[50px] sm:min-h-[60px] text-xs sm:text-sm py-1.5 sm:py-2"
                  placeholder="أضف ملاحظات لدفعة المتبقي..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeEditModal} className="btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
              {submitting ? 'جاري الحفظ...' : 'تحديث'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Info Modal */}
      {paymentInfoModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-2.5 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                  <h2 className="text-xs sm:text-lg font-bold text-gray-800 dark:text-white truncate">
                    معلومات الدفعات: {paymentInfoModal.studentName}
                  </h2>
                  {(() => {
                    const isDual = paymentInfoModal.course?.is_dual || 
                                  (paymentInfoModal.course?.students && paymentInfoModal.course.students.length > 1) ||
                                  (Array.isArray(paymentInfoModal.payments) && 
                                   paymentInfoModal.payments.length > 0 && 
                                   typeof paymentInfoModal.payments[0] === 'object' && 
                                   paymentInfoModal.payments[0].studentId);
                    
                    return isDual ? (
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[9px] sm:text-xs font-semibold">
                        كورس ثنائي
                      </span>
                    ) : (
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[9px] sm:text-xs font-semibold">
                        كورس فردي
                      </span>
                    );
                  })()}
                </div>
                <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">
                  الكورس رقم: {paymentInfoModal.courseId}
                </p>
                {paymentInfoModal.course?.is_dual && paymentInfoModal.course?.students && paymentInfoModal.course.students.length > 1 && (
                  <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                    الطلاب: {paymentInfoModal.course.students.map(s => s.name).join(' - ')}
                  </p>
                )}
              </div>
              <button
                onClick={closePaymentInfoModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4">
              {paymentInfoModal.loading ? (
                <div className="flex items-center justify-center py-6 sm:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  {/* Check if this is a dual course with multiple students */}
                  {paymentInfoModal.course?.is_dual && 
                   Array.isArray(paymentInfoModal.payments) && 
                   paymentInfoModal.payments.length > 0 && 
                   typeof paymentInfoModal.payments[0] === 'object' && 
                   paymentInfoModal.payments[0].studentId ? (
                    // Dual course: Show payments for each student separately
                    <div className="space-y-3 sm:space-y-6">
                      {paymentInfoModal.payments.map((studentData, studentIndex) => (
                        <div key={studentData.studentId} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 sm:p-4 border border-blue-200 dark:border-blue-800">
                          {/* Student Header */}
                          <div className="mb-2 sm:mb-4 pb-2 sm:pb-3 border-b border-blue-300 dark:border-blue-700">
                            <h3 className="text-xs sm:text-base font-bold text-blue-800 dark:text-blue-300">
                              {studentIndex === 0 ? 'الطالب الأول' : 'الطالب الثاني'}: {studentData.studentName}
                            </h3>
                          </div>

                          {/* Payments Summary for this student */}
                          {studentData.payments && studentData.payments.length > 0 ? (
                            <>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3">
                                <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">ملخص الدفعات</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
                                  <div>
                                    <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">إجمالي الدفعات</p>
                                    <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                                      {studentData.payments.length}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">المبلغ المدفوع</p>
                                    <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                                        {formatCurrency(studentData.payments
                                          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                          )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">المتبقي</p>
                                    <p className="text-sm sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                                      {(() => {
                                        const course = paymentInfoModal.course;
                                        const studentPrice = getStudentPrice(course);
                                        const totalPaid = studentData.payments
                                          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                                        const remaining = studentPrice - totalPaid;
                                        return remaining > 0 ? remaining.toLocaleString('en-US') + ' د.ع' : '0 د.ع';
                                      })()}
                                    </p>
                                  </div>
                                  <div className="col-span-2 sm:col-span-1">
                                    <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">طريقة الدفع</p>
                                    <div>
                                      {getPaymentMethodBadge(
                                        paymentInfoModal.course?.payment_method || 
                                        studentData.payments[0]?.payment_method || 
                                        studentData.payments[0]?.course?.payment_method
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Payments List for this student */}
                              <div>
                                <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">قائمة الدفعات</h4>
                                <div className="space-y-2 sm:space-y-3">
                                  {studentData.payments.map((payment, index) => {
                                    const paymentDate = payment.payment_date || payment.date || payment.created_at;
                                    const formattedDate = paymentDate 
                                      ? formatDateSimple(paymentDate)
                                      : '-';

                                    return (
                                      <div key={payment.id || index} className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-4 border border-gray-200 dark:border-gray-600">
                                        <div className="grid grid-cols-2 gap-2 items-center mb-1.5 sm:mb-2">
                                          <p className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            الدفعة {index + 1}
                                          </p>
                                          <p className="text-[10px] sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 text-left">
                                            {formatCurrency(payment.amount)}
                                          </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">تاريخ الدفع:</p>
                                            <p className="text-[10px] sm:text-sm font-semibold text-gray-800 dark:text-white">
                                              {formattedDate}
                                            </p>
                                          </div>
                                          {payment.notes && (
                                            <div>
                                              <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">ملاحظات:</p>
                                              <p className="text-[9px] sm:text-xs text-gray-700 dark:text-gray-300 truncate">{payment.notes}</p>
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">طريقة الدفع:</p>
                                            {getPaymentMethodBadge(payment.payment_method || payment.course?.payment_method)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-3 sm:py-4 text-gray-500 dark:text-gray-400 text-[10px] sm:text-sm">
                              لا توجد دفعات مسجلة لهذا الطالب في هذا الكورس
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Single course: Show payments for one student
                    paymentInfoModal.payments.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-xs sm:text-base">
                        لا توجد دفعات مسجلة
                      </div>
                    ) : (
                      <>
                        {/* Payments Summary for single course */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                          <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">ملخص الدفعات</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
                            <div>
                              <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">إجمالي الدفعات</p>
                              <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                                {paymentInfoModal.payments.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">المبلغ المدفوع</p>
                              <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                                {formatCurrency(paymentInfoModal.payments
                                  .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                  )}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">المتبقي</p>
                              <p className="text-sm sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                                {(() => {
                                  const course = paymentInfoModal.course;
                                  const studentPrice = getStudentPrice(course);
                                  const totalPaid = paymentInfoModal.payments
                                    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                                  const remaining = studentPrice - totalPaid;
                                  return remaining > 0 ? remaining.toLocaleString('en-US') + ' د.ع' : '0 د.ع';
                                })()}
                              </p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">طريقة الدفع</p>
                              <div>
                                {getPaymentMethodBadge(
                                  paymentInfoModal.course?.payment_method || 
                                  paymentInfoModal.payments[0]?.payment_method || 
                                  paymentInfoModal.payments[0]?.course?.payment_method
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Payments List */}
                        <div>
                          <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">قائمة الدفعات</h4>
                          <div className="space-y-2 sm:space-y-3">
                            {paymentInfoModal.payments.map((payment, index) => {
                              const paymentDate = payment.payment_date || payment.date || payment.created_at;
                              const formattedDate = paymentDate 
                                ? formatDateSimple(paymentDate)
                                : '-';

                              return (
                                <div key={payment.id || index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-4 border border-gray-200 dark:border-gray-600">
                                  <div className="grid grid-cols-2 gap-2 items-center mb-1.5 sm:mb-2">
                                    <p className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                                      الدفعة {index + 1}
                                    </p>
                                    <p className="text-[10px] sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 text-left">
                                      {formatCurrency(payment.amount)}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">تاريخ الدفع:</p>
                                      <p className="text-[10px] sm:text-sm font-semibold text-gray-800 dark:text-white">
                                        {formattedDate}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">طريقة الدفع:</p>
                                      {getPaymentMethodBadge(payment.payment_method || payment.course?.payment_method)}
                                    </div>
                                    {payment.notes && (
                                      <div className="col-span-2">
                                        <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">ملاحظات:</p>
                                        <p className="text-[9px] sm:text-xs text-gray-700 dark:text-gray-300 truncate">{payment.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-2.5 sm:p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closePaymentInfoModal}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-[10px] sm:text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Payments;
