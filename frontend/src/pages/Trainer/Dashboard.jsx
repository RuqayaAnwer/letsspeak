import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, BookOpen, CheckCircle } from 'lucide-react';
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

const Dashboard = () => {
  const [todayLectures, setTodayLectures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayLectures();
  }, []);

  const fetchTodayLectures = async () => {
    try {
      const response = await api.get('/trainer/today-lectures').catch(() => null);
      if (response?.data) {
        setTodayLectures(response.data.data || []);
      } else {
        // Demo data
        setTodayLectures([
          { id: 1, course: { id: 1, title: 'محادثة للمبتدئين', student: { name: 'أحمد محمد' }, lecture_time: '18:00' }, status: 'pending' },
          { id: 2, course: { id: 2, title: 'كورس ثنائي', student: { name: 'نور الهدى' }, lecture_time: '20:00' }, status: 'pending' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching lectures:', error);
    } finally {
      setLoading(false);
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
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
                        {lecture.course?.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        الطالب: {lecture.course?.student?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span dir="ltr">{formatTime12Hour(lecture.course?.lecture_time)}</span>
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
    </div>
  );
};

export default Dashboard;
