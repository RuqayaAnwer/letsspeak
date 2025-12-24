import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';

// Updated: 2025-12-21 - Courses separated by status with smaller fonts
const Courses = () => {
  const navigate = useNavigate();
  const { isCustomerService } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const coursesArray = Array.isArray(courses) ? courses : [];
  const activeCourses = coursesArray.filter(c => c.status === 'active');
  const pausedCourses = coursesArray.filter(c => c.status === 'paused');
  const finishedCourses = coursesArray.filter(c => c.status === 'finished');
  // عرض الكورسات بحالات أخرى (paid, cancelled, إلخ)
  const otherCourses = coursesArray.filter(c => 
    c.status && 
    !['active', 'paused', 'finished'].includes(c.status)
  );
  
  // Get all courses at 75% completion (regardless of status)
  const coursesAt75 = coursesArray.filter(isAt75Percent);

  const renderCourseTable = (coursesList, title, titleColor) => {
    if (coursesList.length === 0) return null;

    return (
      <div className="mb-5">
        <h2 className={`text-sm font-bold mb-2 pr-16 ${titleColor}`}>
          {title} ({coursesList.length})
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 dark:text-gray-300" style={{ textAlign: 'center' }}>#</th>
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
                      {course.student_name || 
                       (course.students && course.students.length > 0 
                         ? course.students.map(s => s.name).join(', ') 
                         : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-'}
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
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white pr-20">
            الكورسات
          </h1>
        </div>
        {isCustomerService && (
          <Link 
            to="/customer-service/create-course" 
            className="btn-primary flex items-center gap-2 w-fit"
          >
            <Plus className="w-5 h-5" />
            كورس جديد
          </Link>
        )}
      </div>

      {activeCourses.length === 0 && pausedCourses.length === 0 && finishedCourses.length === 0 && otherCourses.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          لا توجد كورسات
        </div>
      )}

      {/* Special Table for Courses at 75% Completion */}
      {isCustomerService && coursesAt75.length > 0 && (
        <div className="mb-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-orange-800 dark:text-orange-300">
                  تنبيه: كورسات قريبة من الإكتمال
                </h2>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {coursesAt75.length} كورس وصل إلى 75% من الإكتمال
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border-2 border-orange-200 dark:border-orange-800">
            <table className="w-full text-xs">
              <thead className="bg-orange-100 dark:bg-orange-900/30">
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
                {coursesAt75.map((course) => {
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
                              ({(course.course_package || course.coursePackage)?.lectures_count || 0} محاضرة)
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400 text-[10px]">
                        {course.student_name || 
                         (course.students && course.students.length > 0 
                           ? course.students.map(s => s.name).join(', ') 
                           : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-'}
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

      {renderCourseTable(activeCourses, 'الكورسات النشطة', 'text-green-600 dark:text-green-400')}
      {renderCourseTable(pausedCourses, 'الكورسات المتوقفة', 'text-yellow-600 dark:text-yellow-400')}
      {renderCourseTable(finishedCourses, 'الكورسات المنتهية', 'text-blue-600 dark:text-blue-400')}
      {renderCourseTable(otherCourses, 'كورسات أخرى', 'text-gray-600 dark:text-gray-400')}
    </div>
  );
};

export default Courses;
