import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { DollarSign, CreditCard, Users, CheckCircle, BookOpen, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateSimple } from '../../utils/dateFormat';

const AccountingDashboard = () => {
  const [stats, setStats] = useState(null);
  const [paymentStats, setPaymentStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, paymentStatsRes, paymentsRes] = await Promise.all([
        api.get('/statistics'),
        api.get('/payments-statistics'),
        api.get('/payments?per_page=10'),
      ]);
      
      console.log('Statistics response:', statsRes.data);
      console.log('Payment statistics response:', paymentStatsRes.data);
      console.log('Payments response:', paymentsRes.data);
      
      setStats(statsRes.data);
      setPaymentStats(paymentStatsRes.data);
      setRecentPayments(paymentsRes.data?.data || paymentsRes.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Set default values on error
      setStats({
        active_courses_count: 0,
        finished_courses_count: 0,
        students_count: 0,
        trainers_count: 0,
      });
      setPaymentStats({
        total_amount: 0,
        paid_amount: 0,
        pending_amount: 0,
        monthly_revenue: 0,
        active_courses: 0,
        finished_courses: 0,
        total_students: 0,
        completed_count: 0,
      });
      setRecentPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${Number(amount || 0).toLocaleString('en-US')} د.ع`;
  };

  const getStatusLabel = (status) => {
    const labels = { completed: 'مكتمل', pending: 'معلق' };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const badges = { completed: 'badge-success', pending: 'badge-warning' };
    return badges[status] || 'badge-gray';
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="page-title text-base sm:text-2xl">لوحة تحكم المحاسبة</h1>
          <p className="page-subtitle text-[10px] sm:text-sm">متابعة المدفوعات والتقارير المالية</p>
        </div>
        <Link to="/finance/payments" className="btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-base px-3 sm:px-4 py-1.5 sm:py-2">
          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
          عرض كل المدفوعات
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 animate-stagger">
        <StatCard
          title="إجمالي الإيرادات"
          value={formatCurrency(paymentStats?.total_amount || 0)}
          icon={DollarSign}
          color="success"
        />
        <StatCard
          title="المبالغ المدفوعة"
          value={formatCurrency(paymentStats?.paid_amount || 0)}
          icon={CheckCircle}
          color="primary"
        />
        <StatCard
          title="الكورسات النشطة"
          value={paymentStats?.active_courses || stats?.active_courses_count || 0}
          icon={BookOpen}
          color="blue"
        />
        <StatCard
          title="إيرادات الشهر"
          value={formatCurrency(paymentStats?.monthly_revenue || 0)}
          icon={TrendingUp}
          color="accent"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          title="الكورسات المكتملة"
          value={paymentStats?.finished_courses || stats?.finished_courses_count || 0}
          icon={CheckCircle}
          color="success"
        />
        <StatCard
          title="عدد الطلاب"
          value={paymentStats?.total_students || stats?.students_count || 0}
          icon={Users}
          color="primary"
        />
        <StatCard
          title="المدفوعات المكتملة"
          value={paymentStats?.completed_count || 0}
          icon={CreditCard}
          color="blue"
        />
      </div>

      {/* Recent Payments Table */}
      <div className="card">
        <div className="p-2.5 sm:p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-xs sm:text-lg font-bold text-[var(--color-text-primary)]">
            أحدث المدفوعات
          </h2>
          <Link
            to="/finance/payments"
            className="text-[10px] sm:text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
          >
            عرض الكل ←
          </Link>
        </div>
        
        {/* Mobile Cards View */}
        <div className="md:hidden">
          {(() => {
            const itemsPerPage = 5;
            // Show only first 5 payments
            const currentPayments = recentPayments.slice(0, itemsPerPage);
            
            return (
              <>
                <div className="space-y-2 p-2">
                  {currentPayments.length === 0 ? (
                    <div className="text-center py-6 text-[var(--color-text-muted)] text-xs">
                      لا توجد مدفوعات
                    </div>
                  ) : (
                    currentPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 max-w-full overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-gray-800 dark:text-white">#{payment.id}</span>
                          </div>
                          
                          <div className="flex items-center justify-end">
                            <span className={`badge ${getStatusBadge(payment.status)} text-[9px] px-1.5 py-0.5`}>
                              {getStatusLabel(payment.status)}
                            </span>
                          </div>
                          
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">الطالب:</span>
                            <span className="text-[10px] font-semibold text-gray-800 dark:text-white truncate flex-1">{payment.student?.name || '-'}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">التاريخ:</span>
                            <span className="text-[10px] text-gray-800 dark:text-white">
                              {formatDateSimple(payment.payment_date || payment.date)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">الكورس:</span>
                            <span className="text-[10px] text-gray-800 dark:text-white truncate">{payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}</span>
                          </div>
                          
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">المبلغ:</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="text-xs sm:text-sm">#</th>
                <th className="text-xs sm:text-sm">التاريخ</th>
                <th className="text-xs sm:text-sm">الطالب</th>
                <th className="text-xs sm:text-sm">الكورس</th>
                <th className="text-xs sm:text-sm">المبلغ</th>
                <th className="text-xs sm:text-sm">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="font-semibold text-xs sm:text-sm">{payment.id}</td>
                  <td className="text-xs sm:text-sm">
                    {formatDateSimple(payment.payment_date || payment.date)}
                  </td>
                  <td className="font-semibold text-[var(--color-text-primary)] text-xs sm:text-sm">
                    {payment.student?.name}
                  </td>
                  <td className="text-xs sm:text-sm">{payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}</td>
                  <td className="font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(payment.status)} text-xs`}>
                      {getStatusLabel(payment.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-[var(--color-text-muted)] text-xs sm:text-sm">
                    لا توجد مدفوعات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountingDashboard;
