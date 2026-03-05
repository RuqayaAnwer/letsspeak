import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, DollarSign, GraduationCap, UserCheck, UserX } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';

const roleLabels = {
  customer_service: 'خدمة العملاء',
  finance: 'المالية',
  admin: 'مدير النظام',
  trainer: 'مدرب',
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users'),
      ]);
      setStats(statsRes.data?.data || null);
      const users = usersRes.data?.data || [];
      setRecentUsers(users.slice(0, 8));
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      if (import.meta.env.DEV) {
        setStats({
          users_count: 4,
          customer_service_count: 2,
          finance_count: 1,
          trainers_count: 5,
          active_users: 4,
          inactive_users: 0,
        });
        setRecentUsers([
          { id: 1, name: 'أحمد خدمة العملاء', email: 'cs@letspeak.com', role: 'customer_service', status: 'active', created_at: '2025-01-01' },
          { id: 2, name: 'سارة المالية', email: 'finance@letspeak.com', role: 'finance', status: 'active', created_at: '2025-01-01' },
          { id: 3, name: 'مدير النظام', email: 'admin@letspeak.com', role: 'admin', status: 'active', created_at: '2025-01-01' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':            return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'customer_service': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'finance':          return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'trainer':          return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default:                 return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-500" />
            لوحة تحكم الإدارة
          </h1>
          <p className="page-subtitle">إدارة موظفي النظام وصلاحياتهم</p>
        </div>
        <Link to="/admin/users" className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
          <Users className="w-4 h-4" />
          إدارة المستخدمين
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="موظفو النظام" value={stats?.users_count ?? 0}           icon={Users}         color="primary" />
        <StatCard title="خدمة العملاء" value={stats?.customer_service_count ?? 0} icon={Users}         color="blue" />
        <StatCard title="المالية"       value={stats?.finance_count ?? 0}          icon={DollarSign}    color="accent" />
        <StatCard title="المدربون"      value={stats?.trainers_count ?? 0}         icon={GraduationCap} color="success" />
        <StatCard title="نشط"           value={stats?.active_users ?? 0}           icon={UserCheck}     color="success" />
        <StatCard title="معطّل"         value={stats?.inactive_users ?? 0}         icon={UserX}         color="error" />
      </div>

      {/* Recent Users */}
      <div className="card">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-bold text-[var(--color-text-primary)]">مستخدمو النظام</h2>
          <Link to="/admin/users" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">
            عرض الكل ←
          </Link>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2 p-3">
          {recentUsers.length === 0 ? (
            <p className="text-center py-6 text-[var(--color-text-muted)] text-sm">لا يوجد مستخدمون</p>
          ) : recentUsers.map((u) => (
            <div key={u.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">{u.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeClass(u.role)}`}>
                  {roleLabels[u.role] ?? u.role}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">{u.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                {u.status === 'active' ? 'نشط' : 'معطّل'}
              </span>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الدور / القسم</th>
                <th>الحالة</th>
                <th>تاريخ الإضافة</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-[var(--color-text-muted)]">لا يوجد مستخدمون</td></tr>
              ) : recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="text-sm font-semibold">{u.id}</td>
                  <td className="font-semibold text-[var(--color-text-primary)] text-sm">{u.name}</td>
                  <td className="text-sm" dir="ltr">{u.email}</td>
                  <td>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleBadgeClass(u.role)}`}>
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                      {u.status === 'active' ? 'نشط' : 'معطّل'}
                    </span>
                  </td>
                  <td className="text-sm text-[var(--color-text-muted)]">{u.created_at ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
