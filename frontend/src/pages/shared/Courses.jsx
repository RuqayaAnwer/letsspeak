import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus } from 'lucide-react';
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

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/courses');
      
      if (response?.data) {
        // Handle paginated response
        let coursesData = [];
        if (response.data.data && Array.isArray(response.data.data)) {
          // Paginated response: { data: [...], current_page, etc. }
          coursesData = response.data.data;
        } else if (Array.isArray(response.data)) {
          // Direct array response
          coursesData = response.data;
        }
        
        setCourses(coursesData);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
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

  const coursesArray = Array.isArray(courses) ? courses : [];
  const activeCourses = coursesArray.filter(c => c.status === 'active');
  const pausedCourses = coursesArray.filter(c => c.status === 'paused');
  const finishedCourses = coursesArray.filter(c => c.status === 'finished');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

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
              {coursesList.map((course) => (
                  <tr 
                    key={course.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-2 py-2 text-center text-gray-800 dark:text-white text-[10px] font-medium">{course.id}</td>
                    <td className="px-2 py-2 text-center text-gray-800 dark:text-white">
                      {course.course_package ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-medium">{course.course_package.name}</span>
                          <span className="text-[9px] text-gray-500 dark:text-gray-400">
                            ({course.course_package.lectures_count} محاضرة)
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
                    </td>
                  </tr>
              ))}
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

      {activeCourses.length === 0 && pausedCourses.length === 0 && finishedCourses.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          لا توجد كورسات
        </div>
      )}

      {renderCourseTable(activeCourses, 'الكورسات النشطة', 'text-green-600 dark:text-green-400')}
      {renderCourseTable(pausedCourses, 'الكورسات المتوقفة', 'text-yellow-600 dark:text-yellow-400')}
      {renderCourseTable(finishedCourses, 'الكورسات المنتهية', 'text-blue-600 dark:text-blue-400')}
    </div>
  );
};

export default Courses;
