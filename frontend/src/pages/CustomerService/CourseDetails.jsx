import { useState, useEffect } from 'react';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDateSimple } from '../../utils/dateFormat';
import { formatCurrency } from '../../utils/currencyFormat';

const CourseDetails = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, finished, paused
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState({}); // Track which course is being updated
  const [selectedRow, setSelectedRow] = useState(null); // Track selected row
  const [editingCell, setEditingCell] = useState(null); // Track which cell is being edited {courseId, field}
  const [editValue, setEditValue] = useState(''); // Value being edited
  const [notesModal, setNotesModal] = useState({ open: false, courseId: null, notes: '' }); // Notes modal state

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // جلب جميع الكورسات بدون pagination
      let allCourses = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await api.get(`/courses?page=${currentPage}&per_page=100`);
        const data = response.data;
        
        if (data.data && Array.isArray(data.data)) {
          allCourses = [...allCourses, ...data.data];
          hasMorePages = data.current_page < data.last_page;
          currentPage++;
        } else if (Array.isArray(data)) {
          allCourses = [...allCourses, ...data];
          hasMorePages = false;
        } else {
          hasMorePages = false;
        }
      }

      // جلب تفاصيل إضافية لكل كورس
      const coursesWithDetails = await Promise.all(
        allCourses.map(async (course) => {
          try {
            // جلب تفاصيل الكورس الكاملة
            const courseResponse = await api.get(`/courses/${course.id}`);
            const fullCourse = courseResponse.data?.data || courseResponse.data || course;
            
            // استخراج معلومات الطالب
            let studentName = '-';
            if (fullCourse.student_name) {
              studentName = fullCourse.student_name;
            } else if (fullCourse.students && Array.isArray(fullCourse.students) && fullCourse.students.length > 0) {
              studentName = fullCourse.students.map(s => (typeof s === 'object' ? s.name : s)).filter(Boolean).join(', ');
            } else if (fullCourse.student) {
              studentName = typeof fullCourse.student === 'object' ? fullCourse.student?.name : fullCourse.student;
            }
            
            // استخراج معلومات الطالب الثاني (للثنائي)
            let secondStudentName = '-';
            if (fullCourse.students && Array.isArray(fullCourse.students) && fullCourse.students.length > 1) {
              secondStudentName = fullCourse.students.slice(1).map(s => (typeof s === 'object' ? s.name : s)).filter(Boolean).join(' / ');
            }
            
            // استخراج معلومات المدرب
            let trainerName = '-';
            if (fullCourse.trainer_name) {
              trainerName = fullCourse.trainer_name;
            } else if (fullCourse.trainer) {
              if (typeof fullCourse.trainer === 'object') {
                trainerName = fullCourse.trainer?.user?.name || fullCourse.trainer?.name || '-';
              } else {
                trainerName = fullCourse.trainer;
              }
            }
            
            // استخراج المستوى (من بيانات الطالب)
            let level = '-';
            // محاولة الحصول على المستوى من بيانات الطالب
            if (fullCourse.students && Array.isArray(fullCourse.students) && fullCourse.students.length > 0) {
              // أخذ المستوى من الطالب الأول
              const firstStudent = fullCourse.students[0];
              if (typeof firstStudent === 'object' && firstStudent.level) {
                level = firstStudent.level;
              }
            } else if (fullCourse.student && typeof fullCourse.student === 'object' && fullCourse.student.level) {
              level = fullCourse.student.level;
            } else if (fullCourse.student_level) {
              level = fullCourse.student_level;
            }
            
            // تنسيق الوقت
            let lectureTime = '-';
            if (fullCourse.lecture_time) {
              // إذا كان الوقت بصيغة H:i (مثل 20:00:00 أو 20:00)
              if (typeof fullCourse.lecture_time === 'string') {
                const timeParts = fullCourse.lecture_time.split(':');
                if (timeParts.length >= 2) {
                  lectureTime = `${timeParts[0]}:${timeParts[1]}`;
                } else {
                  lectureTime = fullCourse.lecture_time;
                }
              } else {
                lectureTime = String(fullCourse.lecture_time);
              }
            }
            
            return {
              ...fullCourse,
              student_name: studentName,
              second_student_name: secondStudentName,
              trainer_name: trainerName,
              payment_method: fullCourse.payment_method || null,
              start_date: fullCourse.start_date || fullCourse.created_at || null,
              lecture_days: fullCourse.lecture_days || null,
              lecture_time: lectureTime,
              status: fullCourse.status || 'active',
              level: level,
            };
          } catch (err) {
            console.error(`Error fetching details for course ${course.id}:`, err);
            return course;
          }
        })
      );

      setCourses(coursesWithDetails);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // تصفية الكورسات
  const filteredCourses = courses.filter(course => {
    // تصفية حسب الحالة
    if (filterStatus !== 'all' && course.status !== filterStatus) {
      return false;
    }
    
    // تصفية حسب البحث
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        course.student_name?.toLowerCase().includes(searchLower) ||
        course.second_student_name?.toLowerCase().includes(searchLower) ||
        course.trainer_name?.toLowerCase().includes(searchLower) ||
        course.level?.toLowerCase().includes(searchLower) ||
        course.payment_method?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // ترتيب الكورسات حسب التاريخ (الأحدث أولاً)
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    const dateA = a.start_date ? new Date(a.start_date) : new Date(0);
    const dateB = b.start_date ? new Date(b.start_date) : new Date(0);
    return dateB - dateA;
  });

  // تنسيق حالة الكورس
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'finished':
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'paused':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'نشط';
      case 'finished':
      case 'completed':
        return 'مكتمل';
      case 'paused':
        return 'متوقف';
      case 'cancelled':
        return 'ملغي';
      case 'paid':
        return 'مدفوع';
      default:
        return status || '-';
    }
  };

  // تحديث حالة الكورس
  const handleStatusChange = async (courseId, newStatus) => {
    try {
      setUpdatingStatus(prev => ({ ...prev, [courseId]: true }));
      
      await api.put(`/courses/${courseId}`, {
        status: newStatus
      });

      // تحديث الحالة محلياً
      setCourses(prevCourses =>
        prevCourses.map(course =>
          course.id === courseId ? { ...course, status: newStatus } : course
        )
      );
    } catch (err) {
      console.error('Error updating course status:', err);
      alert('حدث خطأ أثناء تحديث حالة الكورس');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [courseId]: false }));
    }
  };

  // بدء تعديل خلية
  const startEditing = (courseId, field, currentValue) => {
    setEditingCell({ courseId, field });
    setEditValue(currentValue || '');
  };

  // حفظ التعديل
  const saveEdit = async () => {
    if (!editingCell) return;

    const { courseId, field } = editingCell;
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    try {
      setUpdatingStatus(prev => ({ ...prev, [courseId]: true }));

      const updateData = { [field]: editValue };
      
      // معالجة خاصة لبعض الحقول
      if (field === 'lecture_days' && typeof editValue === 'string') {
        // تحويل string إلى array إذا لزم الأمر
        updateData.lecture_days = editValue.split(',').map(d => d.trim());
      }

      await api.put(`/courses/${courseId}`, updateData);

      // تحديث محلياً
      setCourses(prevCourses =>
        prevCourses.map(c =>
          c.id === courseId ? { ...c, [field]: editValue } : c
        )
      );

      setEditingCell(null);
      setEditValue('');
    } catch (err) {
      console.error('Error updating course:', err);
      alert('حدث خطأ أثناء تحديث البيانات');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [courseId]: false }));
    }
  };

  // إلغاء التعديل
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // فتح modal الملاحظات
  const openNotesModal = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    setNotesModal({
      open: true,
      courseId: courseId,
      notes: course?.notes || ''
    });
  };

  // حفظ الملاحظات
  const saveNotes = async () => {
    try {
      setUpdatingStatus(prev => ({ ...prev, [notesModal.courseId]: true }));

      await api.put(`/courses/${notesModal.courseId}`, {
        notes: notesModal.notes
      });

      // تحديث محلياً
      setCourses(prevCourses =>
        prevCourses.map(c =>
          c.id === notesModal.courseId ? { ...c, notes: notesModal.notes } : c
        )
      );

      setNotesModal({ open: false, courseId: null, notes: '' });
    } catch (err) {
      console.error('Error updating notes:', err);
      alert('حدث خطأ أثناء حفظ الملاحظات');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [notesModal.courseId]: false }));
    }
  };

  // تنسيق الأيام
  const formatDays = (days) => {
    if (!days || days === '-' || (Array.isArray(days) && days.length === 0)) return '-';
    
    const daysMap = {
      'sun': 'أحد',
      'mon': 'اثنين',
      'tue': 'ثلاثاء',
      'wed': 'أربعاء',
      'thu': 'خميس',
      'fri': 'جمعة',
      'sat': 'سبت',
      'sunday': 'أحد',
      'monday': 'اثنين',
      'tuesday': 'ثلاثاء',
      'wednesday': 'أربعاء',
      'thursday': 'خميس',
      'friday': 'جمعة',
      'saturday': 'سبت',
    };
    
    // ترتيب الأيام حسب ترتيب الأسبوع
    const dayOrder = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    const sortDays = (dayArray) => {
      return dayArray.sort((a, b) => {
        const aIndex = dayOrder.findIndex(d => String(a).trim().toLowerCase().startsWith(d));
        const bIndex = dayOrder.findIndex(d => String(b).trim().toLowerCase().startsWith(d));
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    };
    
    // إذا كان array
    if (Array.isArray(days)) {
      const sorted = sortDays([...days]);
      return sorted.map(d => {
        const trimmed = String(d).trim().toLowerCase();
        return daysMap[trimmed] || trimmed;
      }).join('، ');
    }
    
    // إذا كان string
    if (typeof days === 'string') {
      const dayArray = days.split(',').map(d => d.trim());
      const sorted = sortDays([...dayArray]);
      return sorted.map(d => {
        const trimmed = d.trim().toLowerCase();
        return daysMap[trimmed] || trimmed;
      }).join('، ');
    }
    
    return days;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
          <button
            onClick={fetchCourses}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          تفاصيل الكورسات
        </h1>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="بحث (اسم الطالب، المدرب، المستوى...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          
          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشط</option>
              <option value="finished">مكتمل</option>
              <option value="paused">متوقف</option>
            </select>
          </div>
        </div>
      </div>

      {sortedCourses.length === 0 ? (
        <EmptyState message="لا توجد كورسات" />
      ) : (
        <div className="w-full">
          {/* Desktop Table */}
          <table className="hidden lg:table w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm text-[5px] table-fixed">
            <thead className="bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-900/20">
              <tr>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[7%]">
                  تاريخ البدء
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[10%]">
                  اسم المتدرب
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[9%]">
                  المتدرب الثاني
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[5%]">
                  الوقت
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[9%]">
                  اسم المدرب
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[5%]">
                  المستوى
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[7%]">
                  طريقة الدفع
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[12%]">
                  ملاحظات
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[10%]">
                  الأيام
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[8%]">
                  الحالة
                </th>
                <th className="px-0.5 py-0.5 text-center text-[5px] font-semibold text-gray-800 dark:text-gray-200 border-b-2 border-orange-300 dark:border-orange-700 w-[9%]">
                  كان مع المدرب
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedCourses.map((course, index) => (
                <tr
                  key={course.id}
                  onClick={() => setSelectedRow(course.id)}
                  className={`transition-all duration-200 cursor-pointer ${
                    selectedRow === course.id
                      ? 'bg-blue-200 dark:bg-blue-800/50 border-2 border-blue-600 dark:border-blue-400 shadow-md ring-2 ring-blue-300 dark:ring-blue-500 ring-opacity-50'
                      : index % 2 === 0 
                        ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50' 
                        : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/70'
                  }`}
                >
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-gray-700 dark:text-gray-300 whitespace-nowrap"
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.start_date ? formatDateSimple(course.start_date) : '-'}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-gray-900 dark:text-white font-medium truncate" 
                    title={course.student_name}
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.student_name}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-gray-600 dark:text-gray-400 truncate" 
                    title={course.second_student_name !== '-' ? course.second_student_name : ''}
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.second_student_name !== '-' ? course.second_student_name : '-'}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-blue-700 dark:text-blue-300 font-medium whitespace-nowrap"
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.lecture_time ? (typeof course.lecture_time === 'string' ? course.lecture_time : course.lecture_time) : '-'}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-purple-700 dark:text-purple-300 font-medium truncate" 
                    title={course.trainer_name}
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.trainer_name}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-indigo-700 dark:text-indigo-300 font-medium whitespace-nowrap"
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.level}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-teal-700 dark:text-teal-300 font-medium whitespace-nowrap"
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.payment_method && course.payment_method !== '-' ? (
                      course.payment_method === 'zain_cash' ? 'زين كاش' :
                      course.payment_method === 'q_card' || course.payment_method === 'qi_card' ? 'بطاقة كي' :
                      course.payment_method === 'delivery' ? 'توصيل' :
                      course.payment_method
                    ) : '-'}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-gray-600 dark:text-gray-400 truncate cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" 
                    title={course.notes || 'انقر نقراً مزدوجاً لإضافة/تعديل الملاحظات'}
                    onClick={() => setSelectedRow(course.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openNotesModal(course.id);
                    }}
                  >
                    {course.notes ? (
                      <span className="text-orange-600 dark:text-orange-400 text-[6px] font-medium">📝 {course.notes.substring(0, 20)}{course.notes.length > 20 ? '...' : ''}</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 text-[6px] font-medium">أضف ملاحظة</span>
                    )}
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[3px] text-gray-700 dark:text-gray-300 leading-tight"
                    onClick={() => setSelectedRow(course.id)}
                    style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', maxWidth: '100%' }}
                  >
                    <div className="whitespace-normal break-words">
                      {formatDays(course.lecture_days)}
                    </div>
                  </td>
                  <td 
                    className="px-1 py-1 text-center" 
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <select
                      value={course.status || 'active'}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(course.id, e.target.value);
                      }}
                      disabled={updatingStatus[course.id]}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`text-[6px] px-1.5 py-1 rounded border-0 font-semibold cursor-pointer focus:ring-1 focus:ring-orange-500 w-full ${
                        course.status === 'active' ? 'bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100' :
                        course.status === 'finished' || course.status === 'completed' ? 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100' :
                        course.status === 'paused' ? 'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100' :
                        'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                      } ${updatingStatus[course.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ fontSize: '6px', minHeight: '18px' }}
                    >
                      <option value="active" style={{ fontSize: '6px' }}>نشط</option>
                      <option value="paused" style={{ fontSize: '6px' }}>متوقف</option>
                      <option value="finished" style={{ fontSize: '6px' }}>مكتمل</option>
                      <option value="cancelled" style={{ fontSize: '6px' }}>ملغي</option>
                    </select>
                  </td>
                  <td 
                    className="px-0.5 py-0.5 text-center text-[5px] text-gray-600 dark:text-gray-400 truncate" 
                    title={course.trainer_name || ''}
                    onClick={() => setSelectedRow(course.id)}
                  >
                    {course.trainer_name || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {sortedCourses.map((course, index) => (
              <div
                key={course.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 ${
                  index % 2 === 0 
                    ? 'border-orange-200 dark:border-orange-800' 
                    : 'border-orange-100 dark:border-orange-900/50'
                } overflow-hidden`}
              >
                {/* Header with Status */}
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/20 px-3 py-2 flex items-center justify-between border-b border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">#{course.id}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {course.student_name}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${getStatusBadge(course.status)}`}>
                    {getStatusLabel(course.status)}
                  </span>
                </div>

                {/* Content */}
                <div className="p-3 space-y-2.5">
                  {/* تاريخ البدء والوقت */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded p-2">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">تاريخ البدء</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {course.start_date ? formatDateSimple(course.start_date) : '-'}
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded p-2">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">الوقت</span>
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        {course.lecture_time || '-'}
                      </span>
                    </div>
                  </div>

                  {/* اسم المتدرب الثاني (إن وجد) */}
                  {course.second_student_name !== '-' && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2 border-r-2 border-purple-300 dark:border-purple-700">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">اسم المتدرب الثاني</span>
                      <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        {course.second_student_name}
                      </span>
                    </div>
                  )}

                  {/* المدرب والمستوى */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded p-2 border-r-2 border-indigo-300 dark:border-indigo-700">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">اسم المدرب</span>
                      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        {course.trainer_name}
                      </span>
                    </div>
                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded p-2 border-r-2 border-teal-300 dark:border-teal-700">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">المستوى</span>
                      <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                        {course.level}
                      </span>
                    </div>
                  </div>

                  {/* طريقة الدفع والأيام */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded p-2 border-r-2 border-cyan-300 dark:border-cyan-700">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">طريقة الدفع</span>
                      <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">
                        {course.payment_method && course.payment_method !== '-' ? (
                          course.payment_method === 'zain_cash' ? 'زين كاش' :
                          course.payment_method === 'q_card' || course.payment_method === 'qi_card' ? 'بطاقة كي' :
                          course.payment_method === 'delivery' ? 'توصيل' :
                          course.payment_method
                        ) : '-'}
                      </span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-2 border-r-2 border-amber-300 dark:border-amber-700">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">الأيام</span>
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {formatDays(course.lecture_days)}
                      </span>
                    </div>
                  </div>

                  {/* ملاحظات */}
                  {course.notes && (
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded p-2 border-r-2 border-gray-300 dark:border-gray-600">
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">ملاحظات</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                        {course.notes}
                      </span>
                    </div>
                  )}

                  {/* كان مع المدرب */}
                  <div className="bg-slate-50 dark:bg-slate-900/30 rounded p-2 border-r-2 border-slate-300 dark:border-slate-700">
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 block mb-0.5">كان مع المدرب</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {course.trainer_name || '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          إجمالي الكورسات: <span className="font-semibold">{sortedCourses.length}</span>
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          💡 انقر على الصف لتحديده | انقر نقراً مزدوجاً على الملاحظات لإضافتها/تعديلها
        </p>
      </div>

      {/* Notes Modal */}
      {notesModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setNotesModal({ open: false, courseId: null, notes: '' })}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              إضافة/تعديل الملاحظات
            </h3>
            <textarea
              value={notesModal.notes}
              onChange={(e) => setNotesModal(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={4}
              placeholder="أدخل الملاحظات هنا..."
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={saveNotes}
                disabled={updatingStatus[notesModal.courseId]}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingStatus[notesModal.courseId] ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button
                onClick={() => setNotesModal({ open: false, courseId: null, notes: '' })}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetails;

