import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, BookOpen, CheckCircle } from 'lucide-react';
import api from '../../api/axios';
import { formatDateShort } from '../../utils/dateFormat';

// Format time to 12-hour format
const formatTime12Hour = (time24) => {
  if (!time24) return '-';
  const [hours, minutes] = time24.split(':');
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const Dashboard = () => {
  const [todayLectures, setTodayLectures] = useState([]);
  const [nextWeekLectures, setNextWeekLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTodayLectures();
    fetchNextWeekLectures();
  }, []);

  const fetchTodayLectures = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      console.log('Token:', token ? token.substring(0, 30) + '...' : 'No token');
      
      const response = await api.get('/trainer/today-lectures');
      if (response?.data?.success) {
        setTodayLectures(response.data.data || []);
      } else {
        setTodayLectures([]);
      }
    } catch (error) {
      console.error('Error fetching today lectures:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      setTodayLectures([]);
      
      // Set error message with more details
      if (error.response?.status === 401) {
        const debugInfo = error.response?.data?.debug || '';
        setError(`غير مصرح - يرجى تسجيل الدخول مرة أخرى. ${debugInfo}`);
      } else if (error.response?.status === 403) {
        setError('غير مصرح - ليس لديك صلاحية للوصول إلى هذه الصفحة');
      } else if (error.response?.status === 404) {
        setError('لم يتم العثور على ملف المدرب. يرجى الاتصال بالمسؤول.');
      } else {
        setError('حدث خطأ أثناء تحميل البيانات');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNextWeekLectures = async () => {
    try {
      const response = await api.get('/trainer/next-week-lectures');
      if (response?.data?.success) {
        setNextWeekLectures(response.data.data || []);
      } else {
        setNextWeekLectures([]);
      }
    } catch (error) {
      console.error('Error fetching next week lectures:', error);
      console.error('Error response:', error.response?.data);
      setNextWeekLectures([]);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'مكتملة';
      case 'cancelled': return 'ملغية';
      default: return 'قادمة';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mr-4 text-gray-600 dark:text-gray-400">جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          <p className="font-semibold">خطأ</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white pr-20">
          جدول اليوم
        </h1>
        <Link
          to="/courses"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          عرض جميع الكورسات ←
        </Link>
      </div>

      {/* Today's Lectures */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">محاضرات اليوم</h2>
        </div>
        {todayLectures.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">لا توجد محاضرات اليوم</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {todayLectures.map((lecture) => (
              <div
                key={lecture.id}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        {lecture.course?.course_package?.name || lecture.course?.coursePackage?.name || 'كورس بدون باقة'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        الطالب: {lecture.course?.student?.name || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span dir="ltr">{formatTime12Hour(lecture.time || lecture.course?.lecture_time)}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(lecture.status)}`}>
                      {getStatusLabel(lecture.status)}
                    </span>
                    <Link
                      to={`/courses/${lecture.course?.id}`}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      التفاصيل
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Week's Lectures */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">محاضرات الأسبوع القادم</h2>
        </div>
        {nextWeekLectures.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">لا توجد محاضرات للأسبوع القادم</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">الوقت</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">الباقة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">الطالب</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {nextWeekLectures.map((lecture) => (
                  <tr key={lecture.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-white">
                      {formatDateShort(lecture.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400" dir="ltr">
                      {formatTime12Hour(lecture.time || lecture.course?.lecture_time)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-white">
                      {lecture.course?.course_package?.name || lecture.course?.coursePackage?.name || 'كورس بدون باقة'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {lecture.course?.student?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(lecture.status)}`}>
                        {getStatusLabel(lecture.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/courses/${lecture.course?.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        التفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
