import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, BookOpen } from 'lucide-react';
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
  const [next7DaysLectures, setNext7DaysLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTodayLectures();
    fetchNext7DaysLectures();
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

  const fetchNext7DaysLectures = async () => {
    try {
      const response = await api.get('/trainer/next-week-lectures');
      if (response?.data?.success) {
        setNext7DaysLectures(response.data.data || []);
      } else {
        setNext7DaysLectures([]);
      }
    } catch (error) {
      console.error('Error fetching next 7 days lectures:', error);
      console.error('Error response:', error.response?.data);
      setNext7DaysLectures([]);
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
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-base sm:text-3xl font-bold text-gray-800 dark:text-white pr-2 sm:pr-20">
          جدول اليوم
        </h1>
        <Link
          to="/courses"
          className="text-blue-600 dark:text-blue-400 hover:underline text-xs sm:text-base"
        >
          عرض جميع الكورسات ←
        </Link>
      </div>

      {/* Today's Lectures */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm sm:text-xl font-semibold text-gray-800 dark:text-white">محاضرات اليوم</h2>
        </div>
        {todayLectures.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
            <p className="text-xs sm:text-base text-gray-500 dark:text-gray-400">لا توجد محاضرات اليوم</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-2 p-2">
              {todayLectures.map((lecture) => (
                <div
                  key={lecture.id}
                  className="p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold text-gray-800 dark:text-white truncate">
                          {lecture.course?.course_package?.name || lecture.course?.coursePackage?.name || 'كورس بدون باقة'}
                        </h3>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          الطالب: {lecture.course?.student?.name || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span dir="ltr">{formatTime12Hour(lecture.time || lecture.course?.lecture_time)}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${getStatusBadge(lecture.status)}`}>
                        {getStatusLabel(lecture.status)}
                      </span>
                    </div>
                    <Link
                      to={`/courses/${lecture.course?.id}`}
                      className="block w-full text-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-[10px]"
                    >
                      التفاصيل
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block divide-y divide-gray-200 dark:divide-gray-700">
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
          </>
        )}
      </div>

      {/* Next 7 Days Lectures */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm sm:text-xl font-semibold text-gray-800 dark:text-white">محاضرات الـ 7 أيام القادمة</h2>
        </div>
        {next7DaysLectures.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
            <p className="text-xs sm:text-base text-gray-500 dark:text-gray-400">لا توجد محاضرات للـ 7 أيام القادمة</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-2 p-2">
              {next7DaysLectures.map((lecture) => (
                <div
                  key={lecture.id}
                  className="p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold text-gray-800 dark:text-white truncate">
                          {lecture.course?.course_package?.name || lecture.course?.coursePackage?.name || 'كورس بدون باقة'}
                        </h3>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          الطالب: {lecture.course?.student?.name || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDateShort(lecture.date)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400" dir="ltr">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime12Hour(lecture.time || lecture.course?.lecture_time)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-600">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${getStatusBadge(lecture.status)}`}>
                        {getStatusLabel(lecture.status)}
                      </span>
                      <Link
                        to={`/courses/${lecture.course?.id}`}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-[10px]"
                      >
                        التفاصيل
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                  {next7DaysLectures.map((lecture) => (
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
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
