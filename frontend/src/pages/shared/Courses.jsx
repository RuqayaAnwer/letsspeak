import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus, PlusCircle, AlertTriangle, Info, X, HelpCircle, ChevronLeft, ChevronRight, UserCircle } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/currencyFormat';
import PackageBadge, { deducePackageName } from '../../components/PackageBadge';

// Updated: 2025-12-21 - Courses separated by status with smaller fonts
const Courses = () => {
  const navigate = useNavigate();
  const { isCustomerService, isFinance, isTrainer } = useAuth();
  
  // Helper function to get package name (handles custom packages)
  const getPackageName = (course) => {
    return deducePackageName(course);
  };

  const getLevelLabel = (level) => {
    if (!level) return '';
    const labels = {
      L1: 'المستوى 1',
      L2: 'المستوى 2',
      L3: 'المستوى 3',
      L_PREP: 'المستوى التمهيدي',
      L4: 'المستوى 4',
      L5: 'المستوى 5',
      L6: 'المستوى 6',
      L7: 'المستوى 7',
      L8: 'المستوى 8',
    };
    return labels[level] || level;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    } catch (e) {
      return dateString;
    }
  };
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trainersList, setTrainersList] = useState([]);
  const [packagesList, setPackagesList] = useState([]);
  const [searchStudent, setSearchStudent] = useState(() => sessionStorage.getItem('coursesSearchStudent') || '');
  const [filterTrainerId, setFilterTrainerId] = useState(() => sessionStorage.getItem('coursesFilterTrainerId') || '');
  const [trainerSearchText, setTrainerSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState(() => sessionStorage.getItem('coursesFilterCategory') || 'all');
  const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem('coursesFilterStatus') || 'all');
  const [filterPackageId, setFilterPackageId] = useState(() => sessionStorage.getItem('coursesFilterPackageId') || 'all');
  const [filterStartDate, setFilterStartDate] = useState(() => sessionStorage.getItem('coursesFilterStartDate') || '');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalCourses, setTotalCourses] = useState(0);
  const perPage = 25;

  useEffect(() => {
    sessionStorage.setItem('coursesFilterCategory', filterCategory);
  }, [filterCategory]);

  useEffect(() => {
    sessionStorage.setItem('coursesSearchStudent', searchStudent);
  }, [searchStudent]);

  useEffect(() => {
    sessionStorage.setItem('coursesFilterTrainerId', filterTrainerId);
  }, [filterTrainerId]);

  useEffect(() => {
    sessionStorage.setItem('coursesFilterStatus', filterStatus);
  }, [filterStatus]);

  useEffect(() => {
    sessionStorage.setItem('coursesFilterPackageId', filterPackageId);
  }, [filterPackageId]);

  useEffect(() => {
    sessionStorage.setItem('coursesFilterStartDate', filterStartDate);
  }, [filterStartDate]);

  // Synchronize trainerSearchText with filterTrainerId
  useEffect(() => {
    if (filterTrainerId && trainersList.length > 0) {
      const selected = trainersList.find(t => String(t.id) === String(filterTrainerId));
      if (selected) {
        setTrainerSearchText(selected.name);
      }
    } else if (!filterTrainerId) {
      setTrainerSearchText('');
    }
  }, [filterTrainerId, trainersList]);

  const handleTrainerSearchChange = (e) => {
    const value = e.target.value;
    setTrainerSearchText(value);
    
    // Find if the typed value matches any trainer name exactly (case insensitive)
    const matched = trainersList.find(t => t.name.trim().toLowerCase() === value.trim().toLowerCase());
    if (matched) {
      setFilterTrainerId(String(matched.id));
    } else if (value === '') {
      setFilterTrainerId('');
    }
  };

  const [studentPaymentsModal, setStudentPaymentsModal] = useState({
    open: false,
    studentId: null,
    studentName: '',
    courseId: null,
    course: null,
    payments: [],
    loading: false,
  });

  const fetchTrainers = async () => {
    try {
      const response = await api.get('/trainers-list');
      if (Array.isArray(response.data)) {
        setTrainersList(response.data);
      }
    } catch (error) {
      console.error('Error fetching trainers list:', error);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await api.get('/course-packages');
      const pkgs = response.data?.data || response.data || [];
      setPackagesList(pkgs);
    } catch (error) {
      console.error('Error fetching packages list:', error);
    }
  };

  const fetchCourses = async (pageNumber = 1, showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const params = {
        page: pageNumber,
        per_page: perPage,
      };

      if (searchStudent.trim()) {
        params.search = searchStudent.trim();
      }
      
      if (filterTrainerId) {
        params.trainer_id = filterTrainerId;
      }

      if (filterCategory !== 'all') {
        params.category = filterCategory;
      }

      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      if (filterPackageId !== 'all') {
        params.course_package_id = filterPackageId;
      }

      if (filterStartDate) {
        params.start_date = filterStartDate;
      }

      const response = await api.get('/courses', { params });
      
      if (response?.data) {
        const responseData = response.data;
        if (responseData.data && Array.isArray(responseData.data)) {
          setCourses(responseData.data);
          setCurrentPage(responseData.current_page || 1);
          setLastPage(responseData.last_page || 1);
          setTotalCourses(responseData.total || 0);
        } else if (Array.isArray(responseData)) {
          setCourses(responseData);
          setCurrentPage(1);
          setLastPage(1);
          setTotalCourses(responseData.length);
        }
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchTrainers();
    fetchPackages();
  }, []);

  // Trigger fetch when filters change (with 500ms debounce for search input)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCourses(1, true);
    }, searchStudent.trim() ? 500 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [searchStudent, filterTrainerId, filterCategory, filterStatus, filterPackageId, filterStartDate]);

  // Handle focus event for background refetching
  useEffect(() => {
    const handleFocus = () => {
      fetchCourses(currentPage, false);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentPage, searchStudent, filterTrainerId, filterCategory, filterStatus, filterPackageId, filterStartDate]);


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
      const validLectures = course.lectures.filter(l => 
        l.attendance !== 'postponed_by_trainer' && 
        l.attendance !== 'postponed_by_student' && 
        l.attendance !== 'postponed_holiday'
      );
      
      const completedCount = validLectures.filter(l => 
        l.is_completed || l.attendance === 'present' || l.attendance === 'absent' || l.attendance === 'partially'
      ).length;
      
      const totalCount = validLectures.length;
      
      return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    }
    
    // If no lectures data, return 0
    return 0;
  };

  // Check if course is at 75% completion
  const isAt75Percent = (course) => {
    if (course?.renewal_alert_status === 'renewed') return false;
    const percentage = calculateCompletionPercentage(course);
    return percentage >= 75;
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

  if (loading && courses.length === 0) {
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

  const isKidsCourse = (course) => {
    if (!course) return false;
    
    // Check is_kids attribute directly
    if (course.is_kids) return true;
    
    // Check if any student has is_child flagged
    if (course.students?.some(s => s.is_child)) return true;
    
    // Check package name
    const pkgName = getPackageName(course).toLowerCase();
    if (pkgName.includes('اطفال') || pkgName.includes('kids')) return true;
    
    // Check students enrolled in the course
    const hasKidsStudent = course.students?.some(student => {
      const studentNotes = (student.notes || '').toLowerCase();
      const studentLevel = (student.pivot?.student_level || student.level || '').toLowerCase();
      return student.is_child || studentNotes.includes('اطفال') || studentNotes.includes('kids') || 
             studentNotes.includes('استمارة الاطفال') || 
             studentLevel.includes('اطفال') || studentLevel.includes('kids');
    });
    if (hasKidsStudent) return true;
    
    // Check course attributes
    const courseNotes = (course.notes || '').toLowerCase();
    const source = (course.subscription_source || '').toLowerCase();
    if (courseNotes.includes('اطفال') || courseNotes.includes('kids') || 
        source.includes('اطفال') || source.includes('kids')) {
      return true;
    }
    
    return false;
  };

  const renderUnifiedCourseList = () => {
    if (courses.length === 0) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-5">
        {/* Mobile Cards View */}
        <div className="md:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
            {courses.map((course) => {
              const completionPercentage = calculateCompletionPercentage(course);
              const is75Percent = isAt75Percent(course);
              
              return (
                <div
                  key={course.id}
                  className={`p-3 rounded-lg border-2 ${
                    is75Percent 
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' 
                      : isKidsCourse(course)
                        ? 'bg-pink-50 dark:bg-pink-900/10 border-pink-300 dark:border-pink-700/50'
                        : course.extra_lectures_count > 0
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50'
                          : course.status === 'finished'
                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الكورس #</span>
                      <span className="text-xs font-bold text-gray-800 dark:text-white">{course.id}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الطالب</span>
                      <div className="text-right flex items-center gap-1.5">
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          <span className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1">
                            {isKidsCourse(course) && <span className="ml-1 text-[13px]" title="كورس أطفال">👧👦</span>}
                            {course.is_dual && course.students?.length > 0
                              ? course.students.map((s, idx) => (
                                  <React.Fragment key={s.id}>
                                    {idx > 0 && <span className="font-normal mx-1 text-gray-400">و</span>}
                                    <button onClick={(e) => { e.stopPropagation(); navigate('/students/' + s.id); }} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors focus:outline-none">
                                      {s.name} {(s.pivot?.student_level || s.level) ? `(${getLevelLabel(s.pivot?.student_level || s.level)})` : ''}
                                    </button>
                                  </React.Fragment>
                                ))
                              : (
                                <button onClick={(e) => { e.stopPropagation(); navigate('/students/' + (course.students?.[0]?.id || course.student_id)); }} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors focus:outline-none">
                                  {(course.student_name || course.student?.name || course.students?.[0]?.name || '-')} {(course.student_level || course.students?.[0]?.pivot?.student_level || course.student?.level || course.students?.[0]?.level) ? `(${getLevelLabel(course.student_level || course.students?.[0]?.pivot?.student_level || course.student?.level || course.students?.[0]?.level)})` : ''}
                                </button>
                              )}
                          </span>
                          {isDualCourse(course) && (
                            <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-semibold">
                              ثنائي
                            </span>
                          )}
                          {course.renewal_iteration > 1 && (
                            <span className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-semibold">
                              تجديد {course.renewal_iteration}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الباقة</span>
                      <div className="flex items-center gap-1 flex-wrap justify-end max-w-[65%]">
                        <PackageBadge course={course} className="text-sm font-normal text-gray-800 dark:text-white" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                          ({course.lectures_count ?? (course.course_package || course.coursePackage)?.lectures_count ?? 0} محاضرة)
                        </span>
                        {getStudentId(course) && !isTrainer && (
                          <button
                            onClick={() => fetchStudentPayments(getStudentId(course), getStudentName(course), course.id, course)}
                            className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer mr-2"
                            title="عرض تفاصيل الدفعات والاشتراك"
                          >
                            <HelpCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {course.extra_lectures_count > 0 && (
                      <div className="flex items-center justify-between bg-amber-100/50 dark:bg-amber-800/20 p-1.5 rounded-lg -mx-1 px-2 border-l-2 border-amber-400 text-[10px]">
                        <span className="font-semibold flex items-center gap-1 text-amber-800 dark:text-amber-200">
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>إضافية:</span>
                          <span className="font-bold mx-0.5">{course.extra_lectures_count}</span>
                        </span>
                        {!isTrainer && (
                          <span className="text-amber-700 dark:text-amber-300 font-bold whitespace-nowrap">
                            {formatCurrency(course.extra_lectures_fee)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">المدرب</span>
                      <span className="text-sm text-gray-800 dark:text-white truncate max-w-[65%]">
                        {course.trainer_id ? (
                          <Link to={`/staff-profile/trainer/${course.trainer_id}`} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors font-semibold">
                            {course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'}
                          </Link>
                        ) : (
                          course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">نسبة التقدم</span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {completionPercentage}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">تاريخ البدء</span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {formatDate(course.start_date)}
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
                        {(course.status === 'finished' || completionPercentage >= 100) && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded mt-0.5">
                            ✅ كورس مكتمل
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-1 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">الكورس #</th>
                <th className="px-1 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">الطالب</th>
                <th className="px-1 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">المدرب</th>
                <th className="px-1 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">تاريخ البدء</th>
                <th className="px-1 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">الباقة والتقدم</th>
                <th className="px-1 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                <th className="px-1 py-1.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {courses.map((course) => {
                const completionPercentage = calculateCompletionPercentage(course);
                const is75Percent = isAt75Percent(course);
                
                return (
                  <tr 
                    key={course.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded-xl transition-all ${
                      is75Percent 
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500' 
                        : isKidsCourse(course)
                          ? 'bg-pink-50/70 dark:bg-pink-900/10 border-l-4 border-pink-400 shadow-sm opacity-90'
                          : course.extra_lectures_count > 0
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-400'
                            : course.status === 'finished'
                              ? 'bg-blue-50/70 dark:bg-blue-900/10 shadow-sm opacity-90'
                              : ''
                    }`}
                  >
                    <td className="px-1 py-1.5 text-center font-bold text-gray-600 dark:text-gray-400 text-xs">
                      {course.id}
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-800 dark:text-white font-bold text-xs">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="flex items-center flex-wrap justify-center gap-1 text-xs">
                            {course.is_dual && course.students?.length > 0
                              ? course.students.map((s, idx) => (
                                  <React.Fragment key={s.id}>
                                    {idx > 0 && <span className="font-normal text-gray-400 dark:text-gray-500 mx-0.5 text-xs">و</span>}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); navigate('/students/' + s.id); }} 
                                      className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors focus:outline-none flex items-center gap-0.5 text-xs"
                                      title="عرض ملف الطالب"
                                    >
                                      {isKidsCourse(course) && <span className="ml-1 text-xs">👧👦</span>}
                                      {s.name} {(s.pivot?.student_level || s.level) ? `(${getLevelLabel(s.pivot?.student_level || s.level)})` : ''} <UserCircle className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                                    </button>
                                  </React.Fragment>
                                ))
                              : (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); navigate('/students/' + (course.students?.[0]?.id || course.student_id)); }} 
                                  className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors focus:outline-none flex items-center gap-0.5 text-xs"
                                  title="عرض ملف الطالب"
                                >
                                  {isKidsCourse(course) && <span className="ml-1 text-xs">👧👦</span>}
                                  {course.student_name || course.student?.name || course.students?.[0]?.name || '-'} {(course.student?.level || course.students?.[0]?.level) ? `(${getLevelLabel(course.student?.level || course.students?.[0]?.level)})` : ''}
                                  <UserCircle className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                                </button>
                              )}
                          </span>
                          {isDualCourse(course) && (
                            <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-semibold">
                              ثنائي
                            </span>
                          )}
                          {course.renewal_iteration > 1 && (
                            <span className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-semibold">
                              تجديد {course.renewal_iteration}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-600 dark:text-gray-400 text-xs">
                      {course.trainer_id ? (
                        <Link to={`/staff-profile/trainer/${course.trainer_id}`} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors font-semibold text-xs">
                          {course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'}
                        </Link>
                      ) : (
                        course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-600 dark:text-gray-400 text-xs font-semibold">
                      {formatDate(course.start_date)}
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-600 dark:text-gray-400 text-xs">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <PackageBadge course={course} className="text-xs font-normal" />
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">
                            ({course.lectures_count ?? (course.course_package || course.coursePackage)?.lectures_count ?? 0} محاضرة)
                          </span>
                          {getStudentId(course) && !isTrainer && (
                            <button
                              onClick={() => fetchStudentPayments(getStudentId(course), getStudentName(course), course.id, course)}
                              className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer mr-1"
                              title="عرض تفاصيل الدفعات والاشتراك"
                            >
                              <HelpCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {/* Progress Bar */}
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full ${is75Percent ? 'bg-orange-500' : 'bg-blue-500'}`} 
                            style={{ width: `${completionPercentage}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-semibold mt-0.5">{completionPercentage}% مكتمل</span>
                        {course.extra_lectures_count > 0 && (
                          <div className="mt-1">
                            <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-[10px] text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                              <span className="font-bold">+{course.extra_lectures_count}</span> إضافية
                              {!isTrainer && (
                                <span className="mx-0.5 font-bold">({formatCurrency(course.extra_lectures_fee)})</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center text-xs">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadge(course.status)}`}>
                        {getStatusLabel(course.status)}
                      </span>
                    </td>
                    <td className="px-1 py-1.5 text-center text-xs">
                      <Link
                        to={`/courses/${course.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold"
                      >
                        التفاصيل
                      </Link>
                      {(course.status === 'finished' || completionPercentage >= 100) && (
                        <div className="mt-1">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-955/30 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                            ✅ مكتمل
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
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <h1 className="text-base sm:text-xl font-bold text-gray-800 dark:text-white pr-2 sm:pr-20 flex items-center gap-2">
            الكورسات
            {loading && <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></span>}
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

      {/* Search Filters */}
      <div className="card p-3 sm:p-4 mb-3 sm:mb-4 bg-white dark:bg-gray-800 shadow-md rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              اسم الطالب
            </label>
            <input
              type="text"
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
              placeholder="ابحث باسم الطالب..."
              className="input text-xs w-full"
            />
          </div>
          {!isTrainer && (
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                اسم المدرب
              </label>
              <input
                list="trainers-datalist"
                value={trainerSearchText}
                onChange={handleTrainerSearchChange}
                placeholder="اختر المدرب..."
                className="input text-xs w-full text-right"
                style={{ direction: 'rtl' }}
              />
              <datalist id="trainers-datalist">
                {trainersList.map((trainer) => (
                  <option key={trainer.id} value={trainer.name} />
                ))}
              </datalist>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              الباقة
            </label>
            <select
              value={filterPackageId}
              onChange={(e) => setFilterPackageId(e.target.value)}
              className="select text-xs w-full text-right cursor-pointer"
            >
              <option value="all">جميع الباقات</option>
              {packagesList.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              حالة الكورس
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="select text-xs w-full text-right cursor-pointer"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشط</option>
              <option value="paused">متوقف</option>
              <option value="finished">منتهي</option>
              <option value="paid">مدفوع</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              تصنيف الكورس
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="select text-xs w-full text-right cursor-pointer"
            >
              <option value="all">جميع الكورسات</option>
              <option value="regular">الكورسات العادية (الكبار)</option>
              <option value="kids">كورسات الأطفال 👶</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              تاريخ البدء
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="input text-xs w-full dark:[color-scheme:dark]"
            />
          </div>
        </div>
        
        {(searchStudent || filterTrainerId || filterStatus !== 'all' || filterCategory !== 'all' || filterPackageId !== 'all' || filterStartDate) && (
          <div className="mt-2 sm:mt-3 flex items-center gap-2 text-xs sm:text-sm flex-wrap">
            <span className="text-gray-600 dark:text-gray-400">عوامل التصفية النشطة:</span>
            {searchStudent && (
              <button
                onClick={() => setSearchStudent('')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs"
              >
                طالب: {searchStudent}
                <X className="w-3 h-3" />
              </button>
            )}
            {filterTrainerId && (
              <button
                onClick={() => setFilterTrainerId('')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded text-xs"
              >
                المدرب: {trainersList.find(t => String(t.id) === String(filterTrainerId))?.name || 'محدد'}
                <X className="w-3 h-3" />
              </button>
            )}
            {filterPackageId !== 'all' && (
              <button
                onClick={() => setFilterPackageId('all')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded text-xs"
              >
                الباقة: {packagesList.find(p => String(p.id) === String(filterPackageId))?.name || 'محددة'}
                <X className="w-3 h-3" />
              </button>
            )}
            {filterStatus !== 'all' && (
              <button
                onClick={() => setFilterStatus('all')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded text-xs"
              >
                الحالة: {getStatusLabel(filterStatus)}
                <X className="w-3 h-3" />
              </button>
            )}
            {filterCategory !== 'all' && (
              <button
                onClick={() => setFilterCategory('all')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 rounded text-xs"
              >
                التصنيف: {filterCategory === 'kids' ? 'أطفال 👶' : 'عادي'}
                <X className="w-3 h-3" />
              </button>
            )}
            {filterStartDate && (
              <button
                onClick={() => setFilterStartDate('')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded text-xs"
              >
                تاريخ البدء: {filterStartDate}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => {
                setSearchStudent('');
                setFilterTrainerId('');
                setFilterCategory('all');
                setFilterStatus('all');
                setFilterPackageId('all');
                setFilterStartDate('');
              }}
              className="text-red-600 dark:text-red-400 hover:underline text-xs"
            >
              مسح الكل
            </button>
          </div>
        )}
      </div>

      {courses.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs sm:text-sm bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div>
            <p className="text-base sm:text-lg mb-2">لا توجد نتائج مطابقة لبحثك</p>
            <p className="text-xs sm:text-sm">جرب تغيير معايير البحث</p>
          </div>
        </div>
      )}

      {renderUnifiedCourseList()}

      {/* Pagination Controls */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6">
          <button
            onClick={() => currentPage > 1 && fetchCourses(currentPage - 1, true)}
            disabled={currentPage === 1}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
              currentPage === 1
                ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </button>

          <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold">
            صفحة {currentPage} من {lastPage} | إجمالي الكورسات: {totalCourses}
          </span>

          <button
            onClick={() => currentPage < lastPage && fetchCourses(currentPage + 1, true)}
            disabled={currentPage === lastPage}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
              currentPage === lastPage
                ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            التالي
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

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
                {studentPaymentsModal.course?.extra_lectures_count > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded border border-amber-200 dark:border-amber-700/50">
                    <span className="text-amber-800 dark:text-amber-200 text-[10px] sm:text-xs font-bold">
                      يوجد {studentPaymentsModal.course.extra_lectures_count} محاضرات إضافية
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] sm:text-xs font-semibold">
                      (إجمالي المبلغ المضاف للصندوق: {formatCurrency(studentPaymentsModal.course.extra_lectures_fee)})
                    </span>
                  </div>
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

      {/* Student Profile Modal */}
          </div>
  );
};

export default Courses;
