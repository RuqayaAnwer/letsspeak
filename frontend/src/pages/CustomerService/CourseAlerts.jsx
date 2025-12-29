import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, HelpCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api/axios';

const CourseAlerts = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentPaymentsModal, setStudentPaymentsModal] = useState({
    open: false,
    studentId: null,
    studentName: '',
    courseId: null,
    payments: [],
    loading: false,
  });
  const [alertsPage, setAlertsPage] = useState(1); // Pagination for mobile cards

  useEffect(() => {
    fetchCourses();
  }, []);

  // Reset pagination when courses change
  useEffect(() => {
    setAlertsPage(1);
  }, [courses]);

  // إعادة تحميل الكورسات عند العودة للصفحة
  useEffect(() => {
    const handleFocus = () => {
      fetchCourses();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      // جلب جميع الكورسات بدون pagination
      let allCourses = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const response = await api.get('/courses', {
          params: { page: currentPage, per_page: 100 }
        });
        
        if (response?.data) {
          let coursesData = [];
          if (response.data.data && Array.isArray(response.data.data)) {
            // Paginated response
            coursesData = response.data.data;
            const totalPages = response.data.last_page || 1;
            hasMorePages = currentPage < totalPages;
            currentPage++;
          } else if (Array.isArray(response.data)) {
            // Direct array response
            coursesData = response.data;
            hasMorePages = false;
          }
          
          allCourses = [...allCourses, ...coursesData];
          
          // إذا لم يكن هناك pagination، توقف
          if (!response.data.last_page) {
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }
      }
      
      setCourses(allCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate completion percentage for a course
  const calculateCompletionPercentage = (course) => {
    // First check if completion_percentage is already calculated from backend
    if (course.completion_percentage !== undefined && course.completion_percentage !== null) {
      return course.completion_percentage;
    }
    
    // Fallback: calculate from lectures if available
    if (course.lectures && Array.isArray(course.lectures) && course.lectures.length > 0) {
      const completedCount = course.lectures.filter(l => 
        l.is_completed || l.attendance === 'present' || l.attendance === 'absent'
      ).length;
      const totalCount = course.lectures.length;
      return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    }
    
    // If no lectures data, return 0
    return 0;
  };

  // Check if course is at 75% completion
  const isAt75Percent = (course) => {
    const percentage = calculateCompletionPercentage(course);
    return percentage >= 75 && percentage < 100;
  };

  // Fetch student payments for a specific course
  const fetchStudentPayments = async (studentId, studentName, courseId) => {
    try {
      setStudentPaymentsModal({
        open: true,
        studentId,
        studentName,
        courseId,
        payments: [],
        loading: true,
      });

      const response = await api.get('/payments', {
        params: {
          student_id: studentId,
          course_id: courseId,
        },
      });

      const payments = response.data?.data || response.data || [];
      
      setStudentPaymentsModal(prev => ({
        ...prev,
        payments,
        loading: false,
      }));
    } catch (error) {
      console.error('Error fetching student payments:', error);
      setStudentPaymentsModal(prev => ({
        ...prev,
        payments: [],
        loading: false,
      }));
    }
  };

  // Close payments modal
  const closePaymentsModal = () => {
    setStudentPaymentsModal({
      open: false,
      studentId: null,
      studentName: '',
      courseId: null,
      payments: [],
      loading: false,
    });
  };

  // Get student ID from course
  const getStudentId = (course) => {
    if (course.student_id) return course.student_id;
    if (course.students && course.students.length > 0) {
      return course.students[0].id;
    }
    if (typeof course.student === 'object' && course.student?.id) {
      return course.student.id;
    }
    return null;
  };

  // Get student name from course
  const getStudentName = (course) => {
    return course.student_name || 
           (course.students && course.students.length > 0 
             ? course.students.map(s => s.name).join(', ') 
             : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-';
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      finished: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      paid: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: 'نشط',
      finished: 'منتهي',
      paused: 'متوقف',
      paid: 'مدفوع',
      cancelled: 'ملغي',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const coursesArray = Array.isArray(courses) ? courses : [];
  const coursesWithAlerts = coursesArray.filter(isAt75Percent);

  return (
    <div>
      {/* Header */}
      <div className="mb-3 sm:mb-6">
        <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-2.5 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <AlertTriangle className="w-5 h-5 sm:w-8 sm:h-8 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div>
              <h1 className="text-base sm:text-2xl font-bold text-orange-800 dark:text-orange-300">
                التنبيهات
              </h1>
              <p className="text-[10px] sm:text-sm text-orange-600 dark:text-orange-400 mt-0.5 sm:mt-1">
                الكورسات التي على وشك الانتهاء (اكتملت 75% من محاضراتها)
              </p>
            </div>
          </div>
        </div>
      </div>

      {coursesWithAlerts.length === 0 ? (
        <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-6">
          <AlertTriangle className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4 text-gray-400" />
          <p className="text-xs sm:text-lg">لا توجد كورسات تحتاج إلى تنبيه</p>
          <p className="text-[10px] sm:text-sm mt-1 sm:mt-2">جميع الكورسات إما لم تكمل 75% أو أنها مكتملة بالفعل</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border-2 border-orange-200 dark:border-orange-800">
          <div className="bg-orange-100 dark:bg-orange-900/30 px-2.5 sm:px-4 py-2 sm:py-3 border-b border-orange-200 dark:border-orange-800">
            <h2 className="text-xs sm:text-lg font-bold text-orange-800 dark:text-orange-300">
              الكورسات التي تحتاج إلى تنبيه ({coursesWithAlerts.length})
            </h2>
          </div>
          
          {/* Mobile Cards View */}
          <div className="md:hidden">
            {(() => {
              const itemsPerPage = 5;
              const totalPages = Math.ceil(coursesWithAlerts.length / itemsPerPage);
              const startIndex = (alertsPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const currentCourses = coursesWithAlerts.slice(startIndex, endIndex);
              
              return (
                <>
                  <div className="space-y-2 p-2 max-w-full mx-auto">
                    {currentCourses.map((course) => {
                      const completionPercentage = calculateCompletionPercentage(course);
                      
                      return (
                        <div
                          key={course.id}
                          className="p-2 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 max-w-full mx-auto overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Course ID */}
                            <div className="col-span-2 flex items-center justify-center gap-1 mb-1">
                              <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500">#{course.id}</span>
                            </div>
                            
                            {/* Package */}
                            <div className="col-span-2 flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">الباقة</span>
                              {(course.course_package || course.coursePackage) ? (
                                <>
                                  <span className="text-[10px] font-semibold text-gray-800 dark:text-white text-center">
                                    {(course.course_package || course.coursePackage)?.name || '-'}
                                  </span>
                                  <span className="text-[9px] text-gray-500 dark:text-gray-400 text-center">
                                    ({course.lectures_count || (course.course_package || course.coursePackage)?.lectures_count || 0} محاضرة)
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400 text-[10px]">-</span>
                              )}
                            </div>
                            
                            {/* Student */}
                            <div className="col-span-2 flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">الطالب</span>
                              <div className="flex items-center gap-1 justify-center flex-wrap">
                                <span className="text-[10px] text-gray-800 dark:text-white text-center">
                                  {course.student_name || 
                                   (course.students && course.students.length > 0 
                                     ? course.students.map(s => s.name).join(', ') 
                                     : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-'}
                                </span>
                                {getStudentId(course) && (
                                  <button
                                    onClick={() => fetchStudentPayments(getStudentId(course), getStudentName(course), course.id)}
                                    className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                                    title="عرض تفاصيل الدفعات والاشتراك"
                                  >
                                    <HelpCircle className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Trainer */}
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">المدرب</span>
                              <span className="text-[10px] text-gray-800 dark:text-white text-center truncate max-w-full">
                                {course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'}
                              </span>
                            </div>
                            
                            {/* Completion Percentage */}
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">الإكتمال</span>
                              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                {completionPercentage}%
                              </span>
                            </div>
                            
                            {/* Status */}
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">الحالة</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${getStatusBadge(course.status)}`}>
                                {getStatusLabel(course.status)}
                              </span>
                            </div>
                            
                            {/* Actions */}
                            <div className="col-span-2 flex items-center justify-center pt-1 border-t border-orange-200 dark:border-orange-700 mt-1">
                              <Link
                                to={`/courses/${course.id}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline text-[10px] font-medium"
                              >
                                التفاصيل
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-2 border-t border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
                      <button
                        onClick={() => setAlertsPage(prev => Math.max(1, prev - 1))}
                        disabled={alertsPage === 1}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                          alertsPage === 1
                            ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        <ChevronRight className="w-3 h-3" />
                        السابق
                      </button>

                      <span className="text-[9px] text-gray-600 dark:text-gray-400">
                        صفحة {alertsPage} من {totalPages}
                      </span>

                      <button
                        onClick={() => setAlertsPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={alertsPage === totalPages}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                          alertsPage === totalPages
                            ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
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
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-orange-50 dark:bg-orange-900/20">
                <tr>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-800 dark:text-orange-300" style={{ textAlign: 'center' }}>#</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-800 dark:text-orange-300" style={{ textAlign: 'center' }}>الباقة</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-800 dark:text-orange-300" style={{ textAlign: 'center' }}>الطالب</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-800 dark:text-orange-300" style={{ textAlign: 'center' }}>المدرب</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-800 dark:text-orange-300" style={{ textAlign: 'center' }}>نسبة الإكتمال</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-800 dark:text-orange-300" style={{ textAlign: 'center' }}>الحالة</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-800 dark:text-orange-300" style={{ textAlign: 'center' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-200 dark:divide-orange-800">
                {coursesWithAlerts.map((course) => {
                  const completionPercentage = calculateCompletionPercentage(course);
                  
                  return (
                    <tr 
                      key={course.id} 
                      className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    >
                      <td className="px-2 py-2 text-center text-gray-800 dark:text-white text-[10px] font-medium">{course.id}</td>
                      <td className="px-2 py-2 text-center text-gray-800 dark:text-white">
                        {(course.course_package || course.coursePackage) ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-medium">{(course.course_package || course.coursePackage)?.name || '-'}</span>
                            <span className="text-[9px] text-gray-500 dark:text-gray-400">
                              ({course.lectures_count || (course.course_package || course.coursePackage)?.lectures_count || 0} محاضرة)
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400 text-[10px]">
                        <div className="flex items-center justify-center gap-1">
                          <span>
                            {course.student_name || 
                             (course.students && course.students.length > 0 
                               ? course.students.map(s => s.name).join(', ') 
                               : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-'}
                          </span>
                          {getStudentId(course) && (
                            <button
                              onClick={() => fetchStudentPayments(getStudentId(course), getStudentName(course), course.id)}
                              className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                              title="عرض تفاصيل الدفعات والاشتراك"
                            >
                              <HelpCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400 text-[10px]">
                        {course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                          {completionPercentage}%
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${getStatusBadge(course.status)}`}>
                          {getStatusLabel(course.status)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Link
                          to={`/courses/${course.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-[10px]"
                        >
                          التفاصيل
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Payments Modal */}
      {studentPaymentsModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-full sm:max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <h2 className="text-xs sm:text-lg font-bold text-gray-800 dark:text-white truncate">
                  تفاصيل دفعات الطالب: {studentPaymentsModal.studentName}
                </h2>
                <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                  الكورس رقم: {studentPaymentsModal.courseId}
                </p>
              </div>
              <button
                onClick={closePaymentsModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4">
              {studentPaymentsModal.loading ? (
                <div className="flex items-center justify-center py-6 sm:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : studentPaymentsModal.payments.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                  لا توجد دفعات مسجلة لهذا الطالب في هذا الكورس
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  {/* Payments Summary */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-4">
                    <h3 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">ملخص الدفعات</h3>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
                      <div className="text-center">
                        <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">إجمالي الدفعات</p>
                        <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                          {studentPaymentsModal.payments.length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">المبلغ المدفوع</p>
                        <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                          {studentPaymentsModal.payments
                            .filter(p => p.status === 'paid' || p.status === 'completed')
                            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                            .toLocaleString('ar-EG')} د.ع
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">المبلغ المتبقي</p>
                        <p className="text-sm sm:text-lg font-bold text-orange-600 dark:text-orange-400">
                          {studentPaymentsModal.payments
                            .filter(p => p.status === 'pending' || p.status === 'unpaid' || p.status === 'partial')
                            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                            .toLocaleString('ar-EG')} د.ع
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payments List */}
                  <div>
                    <h3 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">قائمة الدفعات</h3>
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {/* Mobile Cards View */}
                      <div className="md:hidden space-y-1.5 p-1.5">
                        {studentPaymentsModal.payments.map((payment, index) => {
                          const statusColors = {
                            paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                            completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                            pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
                            unpaid: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
                            partial: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
                          };
                          
                          const statusLabels = {
                            paid: 'مدفوع',
                            completed: 'مكتمل',
                            pending: 'معلق',
                            unpaid: 'غير مدفوع',
                            partial: 'جزئي',
                          };

                          const paymentDate = payment.payment_date || payment.date || payment.created_at;
                          const formattedDate = paymentDate 
                            ? new Date(paymentDate).toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : '-';

                          return (
                            <div key={payment.id || index} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                              <div className="grid grid-cols-2 gap-1.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">#</span>
                                  <span className="text-[10px] font-bold text-gray-800 dark:text-white">{index + 1}</span>
                                </div>
                                <div className="flex items-center justify-end">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                    statusColors[payment.status] || 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {statusLabels[payment.status] || payment.status}
                                  </span>
                                </div>
                                <div className="col-span-2 flex items-center gap-1">
                                  <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">المبلغ:</span>
                                  <span className="text-[10px] font-bold text-gray-800 dark:text-white">
                                    {parseFloat(payment.amount || 0).toLocaleString('ar-EG')} د.ع
                                  </span>
                                </div>
                                <div className="col-span-2 flex items-center gap-1">
                                  <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">التاريخ:</span>
                                  <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{formattedDate}</span>
                                </div>
                                {payment.notes && (
                                  <div className="col-span-2 flex items-start gap-1">
                                    <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">ملاحظات:</span>
                                    <span className="text-[10px] text-gray-600 dark:text-gray-400 break-words flex-1">{payment.notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] font-semibold text-gray-700 dark:text-gray-300">#</th>
                              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] font-semibold text-gray-700 dark:text-gray-300">المبلغ</th>
                              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] font-semibold text-gray-700 dark:text-gray-300">تاريخ الدفع</th>
                              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] font-semibold text-gray-700 dark:text-gray-300">ملاحظات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {studentPaymentsModal.payments.map((payment, index) => {
                              const statusColors = {
                                paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                                completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                                pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
                                unpaid: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
                                partial: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
                              };
                              
                              const statusLabels = {
                                paid: 'مدفوع',
                                completed: 'مكتمل',
                                pending: 'معلق',
                                unpaid: 'غير مدفوع',
                                partial: 'جزئي',
                              };

                              const paymentDate = payment.payment_date || payment.date || payment.created_at;
                              const formattedDate = paymentDate 
                                ? new Date(paymentDate).toLocaleDateString('ar-EG', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })
                                : '-';

                              return (
                                <tr key={payment.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-800 dark:text-white text-[10px]">{index + 1}</td>
                                  <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-800 dark:text-white text-[10px] font-medium">
                                    {parseFloat(payment.amount || 0).toLocaleString('ar-EG')} د.ع
                                  </td>
                                  <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 dark:text-gray-400 text-[10px]">
                                    {formattedDate}
                                  </td>
                                  <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] font-medium ${
                                      statusColors[payment.status] || 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {statusLabels[payment.status] || payment.status}
                                    </span>
                                  </td>
                                  <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 dark:text-gray-400 text-[10px]">
                                    {payment.notes || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-2 sm:p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closePaymentsModal}
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

export default CourseAlerts;

