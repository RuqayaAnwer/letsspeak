import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus, AlertTriangle, Info, X, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/currencyFormat';

// Updated: 2025-12-21 - Courses separated by status with smaller fonts
const Courses = () => {
  const navigate = useNavigate();
  const { isCustomerService, isFinance, isTrainer } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentPaymentsModal, setStudentPaymentsModal] = useState({
    open: false,
    studentId: null,
    studentName: '',
    courseId: null,
    course: null, // Store course object for dual courses
    payments: [],
    loading: false,
  });
  // Pagination state for each course status section
  const [coursesPages, setCoursesPages] = useState({});

  useEffect(() => {
    fetchCourses();
  }, []);

  // إعادة تحميل الكورسات عند العودة للصفحة
  useEffect(() => {
    const handleFocus = () => {
      fetchCourses();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Reset pagination when courses change
  useEffect(() => {
    setCoursesPages({});
  }, [courses]);

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
        
        console.log(`Fetching page ${currentPage}:`, response.data);
        
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
      
      console.log('All Courses Data:', allCourses);
      console.log('Total courses:', allCourses.length);
      
      setCourses(allCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
      console.error('Error response:', error.response?.data);
      setCourses([]);
    } finally {
      setLoading(false);
    }
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
  const fetchStudentPayments = async (studentId, studentName, courseId, course = null) => {
    try {
      setStudentPaymentsModal({
        open: true,
        studentId,
        studentName,
        courseId,
        course, // Store course object for dual courses
        payments: [],
        loading: true,
      });

      // For dual courses, fetch payments for both students
      if (course?.is_dual && course?.students && course.students.length > 1) {
        const allStudentsPayments = [];
        
        // Fetch payments for each student
        for (const student of course.students) {
          let studentPayments = [];
          let currentPage = 1;
          let hasMorePages = true;

          while (hasMorePages) {
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
          }

          // Filter only completed/paid payments for display
          const completedPayments = studentPayments.filter(p => 
            p.status === 'completed' || p.status === 'paid'
          );

          allStudentsPayments.push({
            studentId: student.id,
            studentName: student.name,
            payments: completedPayments,
          });
        }

        console.log('Dual course payments:', allStudentsPayments);
        setStudentPaymentsModal(prev => ({
          ...prev,
          payments: allStudentsPayments, // Array of {studentId, studentName, payments}
          loading: false,
        }));
      } else {
        // For single courses, check if there's a second student in the course
        // If course has students array with more than one student, fetch payments for both
        if (course?.students && course.students.length > 1) {
          // Course has multiple students, fetch payments for all
          const allStudentsPayments = [];
          
          for (const student of course.students) {
            let studentPayments = [];
            let currentPage = 1;
            let hasMorePages = true;

            while (hasMorePages) {
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
            }

            // Filter only completed/paid payments for display
            const completedPayments = studentPayments.filter(p => 
              p.status === 'completed' || p.status === 'paid'
            );

            allStudentsPayments.push({
              studentId: student.id,
              studentName: student.name,
              payments: completedPayments,
            });
          }

          setStudentPaymentsModal(prev => ({
            ...prev,
            payments: allStudentsPayments, // Array of {studentId, studentName, payments}
            loading: false,
          }));
        } else {
          // Single student course, fetch payments for one student
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

          // Filter only completed/paid payments for display
          const completedPayments = allPayments.filter(p => 
            p.status === 'completed' || p.status === 'paid'
          );
          
          setStudentPaymentsModal(prev => ({
            ...prev,
            payments: completedPayments, // Array of payment objects
            loading: false,
          }));
        }
      }
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
      course: null,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Helper function to check if course is dual
  const isDualCourse = (course) => {
    if (!course) return false;
    return course.is_dual || (course.students && Array.isArray(course.students) && course.students.length > 1);
  };

  const coursesArray = Array.isArray(courses) ? courses : [];
  
  // Filter courses by status and type (single vs dual)
  const activeSingleCourses = coursesArray.filter(c => c.status === 'active' && !isDualCourse(c));
  const activeDualCourses = coursesArray.filter(c => c.status === 'active' && isDualCourse(c));
  const pausedSingleCourses = coursesArray.filter(c => c.status === 'paused' && !isDualCourse(c));
  const pausedDualCourses = coursesArray.filter(c => c.status === 'paused' && isDualCourse(c));
  const finishedSingleCourses = coursesArray.filter(c => c.status === 'finished' && !isDualCourse(c));
  const finishedDualCourses = coursesArray.filter(c => c.status === 'finished' && isDualCourse(c));
  // عرض الكورسات بحالات أخرى (paid, cancelled, إلخ)
  const otherSingleCourses = coursesArray.filter(c => 
    c.status && 
    !['active', 'paused', 'finished'].includes(c.status) &&
    !isDualCourse(c)
  );
  const otherDualCourses = coursesArray.filter(c => 
    c.status && 
    !['active', 'paused', 'finished'].includes(c.status) &&
    isDualCourse(c)
  );

  const renderCourseTable = (coursesList, title, titleColor, sectionKey) => {
    if (coursesList.length === 0) return null;

    // Get pagination state for this section
    const currentPage = coursesPages[sectionKey] || 1;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(coursesList.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentCourses = coursesList.slice(startIndex, endIndex);

    const setPage = (page) => {
      setCoursesPages(prev => ({ ...prev, [sectionKey]: page }));
    };

    return (
      <div className="mb-4 sm:mb-5">
        <h2 className={`text-xs sm:text-base font-bold mb-1.5 sm:mb-2 pr-1 sm:pr-16 ${titleColor}`}>
          {title} ({coursesList.length})
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          {/* Mobile Cards View */}
          <div className="md:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
              {currentCourses.map((course) => {
              const completionPercentage = calculateCompletionPercentage(course);
              const is75Percent = isAt75Percent(course);
              
              return (
                <div
                  key={course.id}
                  className={`p-3 rounded-lg border-2 ${
                    is75Percent 
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' 
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الباقة</span>
                      <div className="text-right flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1">{course.id}</span>
                        {(course.course_package || course.coursePackage) ? (
                          <>
                            <div className="flex items-center gap-1">
                              <div className="text-sm font-medium text-gray-800 dark:text-white">
                                {(course.course_package || course.coursePackage)?.name || '-'}
                              </div>
                              {isDualCourse(course) && (
                                <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-semibold">
                                  ثنائي
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ({course.lectures_count || (course.course_package || course.coursePackage)?.lectures_count || 0} محاضرة)
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الطالب</span>
                      <div className="flex items-center gap-1 flex-wrap justify-end max-w-[65%]">
                        {course.is_dual && course.students && course.students.length > 1 ? (
                          course.students.map((student, index) => (
                            <div key={student.id} className="flex items-center gap-1">
                              <span className="text-sm text-gray-800 dark:text-white">{student.name}</span>
                              {!isTrainer && (
                                <button
                                  onClick={() => fetchStudentPayments(student.id, student.name, course.id, course)}
                                  className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                                  title={`عرض تفاصيل دفعات ${student.name}`}
                                >
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {index < course.students.length - 1 && <span className="text-gray-400 text-xs">،</span>}
                            </div>
                          ))
                        ) : (
                          <>
                            <span className="text-sm text-gray-800 dark:text-white">
                              {course.student_name || 
                               (course.students && course.students.length > 0 
                                 ? course.students.map(s => s.name).join(', ') 
                                 : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-'}
                            </span>
                            {getStudentId(course) && !isTrainer && (
                              <button
                                onClick={() => fetchStudentPayments(getStudentId(course), getStudentName(course), course.id, course)}
                                className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                                title="عرض تفاصيل الدفعات والاشتراك"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">المدرب</span>
                      <span className="text-sm text-gray-800 dark:text-white truncate max-w-[65%]">
                        {course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الحالة</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(course.status)}`}>
                        {getStatusLabel(course.status)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">الإجراءات</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <Link
                          to={`/courses/${course.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                        >
                          التفاصيل
                        </Link>
                        {is75Percent && (
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
                            {completionPercentage}% مكتمل
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  <ChevronRight className="w-3 h-3" />
                  السابق
                </button>

                <span className="text-[9px] text-gray-600 dark:text-gray-400">
                  صفحة {currentPage} من {totalPages}
                </span>

                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  التالي
                  <ChevronLeft className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 dark:text-gray-300" style={{ textAlign: 'center' }}>الباقة</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 dark:text-gray-300" style={{ textAlign: 'center' }}>الطالب</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 dark:text-gray-300" style={{ textAlign: 'center' }}>المدرب</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 dark:text-gray-300" style={{ textAlign: 'center' }}>الحالة</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 dark:text-gray-300" style={{ textAlign: 'center' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {coursesList.map((course) => {
                const completionPercentage = calculateCompletionPercentage(course);
                const is75Percent = isAt75Percent(course);
                
                return (
                  <tr 
                    key={course.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      is75Percent ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500' : ''
                    }`}
                  >
                    <td className="px-2 py-2 text-center text-gray-800 dark:text-white">
                      {(course.course_package || course.coursePackage) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium">{(course.course_package || course.coursePackage)?.name || '-'}</span>
                            {isDualCourse(course) && (
                              <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[9px] font-semibold">
                                ثنائي
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-gray-500 dark:text-gray-400">
                            ({course.lectures_count || (course.course_package || course.coursePackage)?.lectures_count || 0} محاضرة)
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400 text-[10px]">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {course.is_dual && course.students && course.students.length > 1 ? (
                          course.students.map((student, index) => (
                            <div key={student.id} className="flex items-center gap-1">
                              <span>{student.name}</span>
                              {!isTrainer && (
                                <button
                                  onClick={() => fetchStudentPayments(student.id, student.name, course.id, course)}
                                  className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                                  title={`عرض تفاصيل دفعات ${student.name}`}
                                >
                                  <HelpCircle className="w-4 h-4" />
                                </button>
                              )}
                              {index < course.students.length - 1 && <span className="text-gray-400">،</span>}
                            </div>
                          ))
                        ) : (
                          <>
                            <span>
                              {course.student_name || 
                               (course.students && course.students.length > 0 
                                 ? course.students.map(s => s.name).join(', ') 
                                 : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-'}
                            </span>
                            {getStudentId(course) && !isTrainer && (
                              <button
                                onClick={() => fetchStudentPayments(getStudentId(course), getStudentName(course), course.id, course)}
                                className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                                title="عرض تفاصيل الدفعات والاشتراك"
                              >
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400 text-[10px]">
                      {course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'}
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
                      {is75Percent && (
                        <div className="mt-1">
                          <span className="text-[9px] text-orange-600 dark:text-orange-400 font-semibold">
                            {completionPercentage}% مكتمل
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <h1 className="text-base sm:text-xl font-bold text-gray-800 dark:text-white pr-2 sm:pr-20">
            الكورسات
          </h1>
        </div>
        {isCustomerService && (
          <Link 
            to="/customer-service/create-course" 
            className="btn-primary flex items-center gap-1.5 sm:gap-2 w-full sm:w-fit justify-center sm:justify-start text-xs sm:text-base px-3 sm:px-4 py-1.5 sm:py-2"
          >
            <Plus className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            كورس جديد
          </Link>
        )}
      </div>

      {activeSingleCourses.length === 0 && activeDualCourses.length === 0 && 
       pausedSingleCourses.length === 0 && pausedDualCourses.length === 0 && 
       finishedSingleCourses.length === 0 && finishedDualCourses.length === 0 && 
       otherSingleCourses.length === 0 && otherDualCourses.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          لا توجد كورسات
        </div>
      )}

      {/* Active Courses - Single */}
      {renderCourseTable(activeSingleCourses, 'الكورسات النشطة - الفردية', 'text-green-600 dark:text-green-400', 'active-single')}
      {/* Active Courses - Dual */}
      {renderCourseTable(activeDualCourses, 'الكورسات النشطة - الثنائية', 'text-purple-600 dark:text-purple-400', 'active-dual')}
      {/* Paused Courses - Single */}
      {renderCourseTable(pausedSingleCourses, 'الكورسات المتوقفة - الفردية', 'text-yellow-600 dark:text-yellow-400', 'paused-single')}
      {/* Paused Courses - Dual */}
      {renderCourseTable(pausedDualCourses, 'الكورسات المتوقفة - الثنائية', 'text-purple-600 dark:text-purple-400', 'paused-dual')}
      {/* Finished Courses - Single */}
      {renderCourseTable(finishedSingleCourses, 'الكورسات المنتهية - الفردية', 'text-blue-600 dark:text-blue-400', 'finished-single')}
      {/* Finished Courses - Dual */}
      {renderCourseTable(finishedDualCourses, 'الكورسات المنتهية - الثنائية', 'text-purple-600 dark:text-purple-400', 'finished-dual')}
      {/* Other Courses - Single */}
      {renderCourseTable(otherSingleCourses, 'كورسات أخرى - الفردية', 'text-gray-600 dark:text-gray-400', 'other-single')}
      {/* Other Courses - Dual */}
      {renderCourseTable(otherDualCourses, 'كورسات أخرى - الثنائية', 'text-purple-600 dark:text-purple-400', 'other-dual')}

      {/* Student Payments Modal */}
      {studentPaymentsModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                  <h2 className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white truncate">
                    تفاصيل دفعات الطالب: {studentPaymentsModal.studentName}
                  </h2>
                  {(() => {
                    // Check if course is dual - try multiple ways to determine
                    const isDual = studentPaymentsModal.course?.is_dual || 
                                  (studentPaymentsModal.course?.students && studentPaymentsModal.course.students.length > 1) ||
                                  (Array.isArray(studentPaymentsModal.payments) && 
                                   studentPaymentsModal.payments.length > 0 && 
                                   typeof studentPaymentsModal.payments[0] === 'object' && 
                                   studentPaymentsModal.payments[0].studentId);
                    
                    return isDual ? (
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] sm:text-xs font-semibold">
                        كورس ثنائي
                      </span>
                    ) : (
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] sm:text-xs font-semibold">
                        كورس فردي
                      </span>
                    );
                  })()}
                </div>
                <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">
                  الكورس رقم: {studentPaymentsModal.courseId}
                </p>
                {studentPaymentsModal.course?.is_dual && studentPaymentsModal.course?.students && studentPaymentsModal.course.students.length > 1 && (
                  <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                    الطلاب: {studentPaymentsModal.course.students.map(s => s.name).join(' - ')}
                  </p>
                )}
              </div>
              <button
                onClick={closePaymentsModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4">
              {studentPaymentsModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  {/* Check if this is a dual course with multiple students */}
                  {studentPaymentsModal.course?.is_dual && 
                   Array.isArray(studentPaymentsModal.payments) && 
                   studentPaymentsModal.payments.length > 0 && 
                   typeof studentPaymentsModal.payments[0] === 'object' && 
                   studentPaymentsModal.payments[0].studentId ? (
                    // Dual course: Show payments for each student separately
                    <div className="space-y-3 sm:space-y-6">
                      {studentPaymentsModal.payments.map((studentData, studentIndex) => (
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-[10px] sm:text-xs">
                                  <div>
                                    <p className="text-gray-500 dark:text-gray-400">إجمالي الدفعات</p>
                                    <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                                      {studentData.payments.length}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 dark:text-gray-400">المبلغ المدفوع</p>
                                    <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                                      {formatCurrency(studentData.payments
                                        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                        )}
                                    </p>
                                  </div>
                                  <div className="col-span-2 sm:col-span-1">
                                    <p className="text-gray-500 dark:text-gray-400">طريقة الدفع</p>
                                    <p className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                                      {(() => {
                                        const method = studentPaymentsModal.course?.payment_method || studentData.payments[0]?.payment_method || studentData.payments[0]?.course?.payment_method;
                                        if (!method) return '-';
                                        const methods = {
                                          'zain_cash': 'زين كاش',
                                          'qi_card': 'بطاقة كي',
                                          'delivery': 'توصيل',
                                        };
                                        return methods[method] || method;
                                      })()}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Payments List for this student */}
                              <div>
                                <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">قائمة الدفعات</h4>
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                                  <table className="w-full text-[9px] sm:text-xs min-w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                      <tr>
                                        <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">المبلغ</th>
                                        <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">تاريخ الدفع</th>
                                        <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">طريقة الدفع</th>
                                        <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                                        <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">ملاحظات</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                      {studentData.payments.map((payment, index) => {
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
                                            <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-800 dark:text-white text-[9px] sm:text-[10px] font-medium whitespace-nowrap">
                                              {formatCurrency(payment.amount || 0)}
                                            </td>
                                            <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] whitespace-nowrap">
                                              {formattedDate}
                                            </td>
                                            <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] whitespace-nowrap">
                                              {(() => {
                                                const method = payment.payment_method || payment.course?.payment_method || studentPaymentsModal.course?.payment_method;
                                                if (!method) return '-';
                                                const methods = {
                                                  'zain_cash': 'زين كاش',
                                                  'qi_card': 'بطاقة كي',
                                                  'delivery': 'توصيل',
                                                };
                                                return methods[method] || method;
                                              })()}
                                            </td>
                                            <td className="px-1.5 sm:px-3 py-1 sm:py-2">
                                              <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-medium ${
                                                statusColors[payment.status] || 'bg-gray-100 text-gray-700'
                                              }`}>
                                                {statusLabels[payment.status] || payment.status}
                                              </span>
                                            </td>
                                            <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] max-w-[100px] truncate">
                                              {payment.notes || '-'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                              لا توجد دفعات مسجلة لهذا الطالب في هذا الكورس
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Single course: Check if payments is array of student objects or payment objects
                    <>
                      {(() => {
                        // Check if payments is array of student objects (multiple students in single course)
                        const isMultipleStudents = Array.isArray(studentPaymentsModal.payments) && 
                          studentPaymentsModal.payments.length > 0 && 
                          typeof studentPaymentsModal.payments[0] === 'object' && 
                          studentPaymentsModal.payments[0].studentId;
                        
                        if (isMultipleStudents) {
                          // Multiple students in single course - show both
                          return (
                            <div className="space-y-3 sm:space-y-6">
                              {studentPaymentsModal.payments.map((studentData, studentIndex) => (
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
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-[10px] sm:text-xs">
                                          <div>
                                            <p className="text-gray-500 dark:text-gray-400">إجمالي الدفعات</p>
                                            <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                                              {studentData.payments.length}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-gray-500 dark:text-gray-400">المبلغ المدفوع</p>
                                            <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                                              {formatCurrency(studentData.payments
                                                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                                )}
                                            </p>
                                          </div>
                                          <div className="col-span-2 sm:col-span-1">
                                            <p className="text-gray-500 dark:text-gray-400">طريقة الدفع</p>
                                            <p className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                                              {(() => {
                                                const method = studentPaymentsModal.course?.payment_method || studentData.payments[0]?.payment_method || studentData.payments[0]?.course?.payment_method;
                                                if (!method) return '-';
                                                const methods = {
                                                  'zain_cash': 'زين كاش',
                                                  'qi_card': 'بطاقة كي',
                                                  'delivery': 'توصيل',
                                                };
                                                return methods[method] || method;
                                              })()}
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Payments List for this student */}
                                      <div>
                                        <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">قائمة الدفعات</h4>
                                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                                          <table className="w-full text-[9px] sm:text-xs min-w-full">
                                            <thead className="bg-gray-50 dark:bg-gray-700">
                                              <tr>
                                                <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">المبلغ</th>
                                                <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">تاريخ الدفع</th>
                                                <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">طريقة الدفع</th>
                                                <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                                                <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">ملاحظات</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                              {studentData.payments.map((payment, index) => {
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
                                                    <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-800 dark:text-white text-[9px] sm:text-[10px] font-medium whitespace-nowrap">
                                                      {formatCurrency(payment.amount || 0)}
                                                    </td>
                                                    <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] whitespace-nowrap">
                                                      {formattedDate}
                                                    </td>
                                                    <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] whitespace-nowrap">
                                                      {(() => {
                                                        const method = payment.payment_method || payment.course?.payment_method || studentPaymentsModal.course?.payment_method;
                                                        if (!method) return '-';
                                                        const methods = {
                                                          'zain_cash': 'زين كاش',
                                                          'qi_card': 'بطاقة كي',
                                                          'delivery': 'توصيل',
                                                        };
                                                        return methods[method] || method;
                                                      })()}
                                                    </td>
                                                    <td className="px-1.5 sm:px-3 py-1 sm:py-2">
                                                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-medium ${
                                                        statusColors[payment.status] || 'bg-gray-100 text-gray-700'
                                                      }`}>
                                                        {statusLabels[payment.status] || payment.status}
                                                      </span>
                                                    </td>
                                                    <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] max-w-[100px] truncate">
                                                      {payment.notes || '-'}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
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
                          );
                        }
                        
                        // Single student - show payments normally
                        if (!Array.isArray(studentPaymentsModal.payments) || studentPaymentsModal.payments.length === 0) {
                          return (
                            <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-[10px] sm:text-sm">
                              لا توجد دفعات مسجلة لهذا الطالب في هذا الكورس
                            </div>
                          );
                        }
                        
                        return (
                        <div className="space-y-3 sm:space-y-4">
                          {/* Payments Summary */}
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 sm:p-4">
                            <h3 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">ملخص الدفعات</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-[10px] sm:text-xs">
                              <div>
                                <p className="text-gray-500 dark:text-gray-400">إجمالي الدفعات</p>
                                <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                                  {studentPaymentsModal.payments.length}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 dark:text-gray-400">المبلغ المدفوع</p>
                                <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(studentPaymentsModal.payments
                                    .filter(p => p.status === 'paid' || p.status === 'completed')
                                    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                        )}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 dark:text-gray-400">المبلغ المتبقي</p>
                                <p className="text-sm sm:text-lg font-bold text-orange-600 dark:text-orange-400">
                                  {formatCurrency(studentPaymentsModal.payments
                                    .filter(p => p.status === 'pending' || p.status === 'unpaid' || p.status === 'partial')
                                    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                                        )}
                                </p>
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                <p className="text-gray-500 dark:text-gray-400">طريقة الدفع</p>
                                <p className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                                  {(() => {
                                    const method = studentPaymentsModal.course?.payment_method || studentPaymentsModal.payments[0]?.payment_method || studentPaymentsModal.payments[0]?.course?.payment_method;
                                    if (!method) return '-';
                                    const methods = {
                                      'zain_cash': 'زين كاش',
                                      'qi_card': 'بطاقة كي',
                                      'delivery': 'توصيل',
                                    };
                                    return methods[method] || method;
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Payments List */}
                          <div>
                            <h3 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">قائمة الدفعات</h3>
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                              <table className="w-full text-[9px] sm:text-xs min-w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                  <tr>
                                    <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">المبلغ</th>
                                    <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">تاريخ الدفع</th>
                                    <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                                    <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-[9px] sm:text-[10px] font-semibold text-gray-700 dark:text-gray-300">ملاحظات</th>
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
                                        <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-800 dark:text-white text-[9px] sm:text-[10px] font-medium whitespace-nowrap">
                                          {parseFloat(payment.amount || 0).toLocaleString('ar-EG')} د.ع
                                        </td>
                                        <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] whitespace-nowrap">
                                          {formattedDate}
                                        </td>
                                        <td className="px-1.5 sm:px-3 py-1 sm:py-2">
                                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-medium ${
                                            statusColors[payment.status] || 'bg-gray-100 text-gray-700'
                                          }`}>
                                            {statusLabels[payment.status] || payment.status}
                                          </span>
                                        </td>
                                        <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-600 dark:text-gray-400 text-[9px] sm:text-[10px] max-w-[100px] truncate">
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
                        );
                      })()}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closePaymentsModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
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

export default Courses;
