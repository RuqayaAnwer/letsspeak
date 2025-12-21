import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

// Format time to 12-hour format
const formatTime12Hour = (time24) => {
  if (!time24) return '-';
  const [hours, minutes] = time24.split(':');
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses').catch(() => null);
      if (response?.data) {
        const data = response.data.data || response.data;
        // Ensure we always have an array
        setCourses(Array.isArray(data) ? data : []);
      } else {
        // Demo data
        setCourses([
          { id: 1, title: 'دورة المستوى الأول', student: 'أحمد محمد', trainer: 'محمد علي', status: 'active', progress: 60, lecture_time: '18:00' },
          { id: 2, title: 'دورة المستوى الثاني', student: 'سارة أحمد', trainer: 'أحمد خالد', status: 'active', progress: 80, lecture_time: '20:00' },
          { id: 3, title: 'دورة المستوى الثالث', student: 'خالد سعيد', trainer: 'محمد علي', status: 'completed', progress: 100, lecture_time: '17:00' },
          { id: 4, title: 'دورة المحادثة', student: 'فاطمة علي', trainer: 'سارة محمد', status: 'pending', progress: 0, lecture_time: '19:00' },
        ]);
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
      completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: 'نشط',
      completed: 'مكتمل',
      pending: 'معلق',
      cancelled: 'ملغي',
    };
    return labels[status] || status;
  };

  const coursesArray = Array.isArray(courses) ? courses : [];
  const filteredCourses = filter === 'all' 
    ? coursesArray 
    : coursesArray.filter(c => c.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          الكورسات
        </h1>
        <div className="flex gap-2">
          {['all', 'active', 'completed', 'pending'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg transition-all ${
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {f === 'all' ? 'الكل' : getStatusLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 dark:text-gray-300">#</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 dark:text-gray-300">الباقة</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 dark:text-gray-300">الطالب</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 dark:text-gray-300">المدرب</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 dark:text-gray-300">الوقت</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 dark:text-gray-300">الحالة</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 dark:text-gray-300">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCourses.map((course) => (
                <tr 
                  key={course.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4 text-gray-800 dark:text-white font-medium">{course.id}</td>
                  <td className="px-6 py-4 text-gray-800 dark:text-white font-medium">
                    {course.course_package ? (
                      <span>
                        {course.course_package.name}
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                          ({course.course_package.lectures_count} محاضرة)
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {course.student_name || 
                     (course.students && course.students.length > 0 
                       ? course.students.map(s => s.name).join(', ') 
                       : (typeof course.student === 'object' ? course.student?.name : course.student)) || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {course.trainer_name || (typeof course.trainer === 'object' ? (course.trainer?.user?.name || course.trainer?.name) : course.trainer) || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400" dir="ltr">
                    {formatTime12Hour(course.lecture_time)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(course.status)}`}>
                      {getStatusLabel(course.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/courses/${course.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      التفاصيل
                    </Link>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
        {filteredCourses.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            لا توجد كورسات
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;
