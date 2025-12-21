import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, Package, Plus, Search, FileText, BarChart3 } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/StatCard';

const Dashboard = () => {
  const [stats, setStats] = useState({
    students: 0,
    trainers: 0,
    courses: 0,
    packages: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats').catch(() => null);
      if (response?.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'طالب جديد', icon: Plus, path: '/customer-service/students', color: 'blue' },
    { label: 'كورس جديد', icon: FileText, path: '/customer-service/create-course', color: 'green' },
    { label: 'بحث متقدم', icon: Search, path: '/customer-service/find-time', color: 'purple' },
    { label: 'التقارير', icon: BarChart3, path: '/customer-service/activity-logs', color: 'orange' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          لوحة التحكم - خدمة العملاء
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="الطلاب"
          value={stats.students}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="المدربين"
          value={stats.trainers}
          icon={GraduationCap}
          color="green"
        />
        <StatCard
          title="الكورسات النشطة"
          value={stats.courses}
          icon={BookOpen}
          color="purple"
        />
        <StatCard
          title="الباقات"
          value={stats.packages}
          icon={Package}
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          إجراءات سريعة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
            >
              <action.icon className="w-6 h-6 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
