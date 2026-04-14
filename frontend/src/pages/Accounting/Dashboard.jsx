import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { DollarSign, CreditCard, Users, CheckCircle, BookOpen, TrendingUp, ChevronLeft, ChevronRight, UserCircle } from 'lucide-react';
import { formatDateSimple } from '../../utils/dateFormat';
import { formatCurrency } from '../../utils/currencyFormat';

const AccountingDashboard = () => {
  const navigate = useNavigate();
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
        api.get('/payments?per_page=5'),
      ]);
      
      console.log('Statistics response:', statsRes.data);
      console.log('Payment statistics response:', paymentStatsRes.data);
      console.log('Payments response:', paymentsRes.data);
      
      const paymentsList = paymentsRes.data?.data || paymentsRes.data || [];
      const paymentsEmpty = !Array.isArray(paymentsList) || paymentsList.length === 0;

      setStats(statsRes.data);
      setPaymentStats(paymentStatsRes.data);
      if (paymentsEmpty && import.meta.env.DEV) {
        const { sampleRecentPayments } = await import('../../data/sampleDashboardData');
        setRecentPayments(sampleRecentPayments);
      } else {
        setRecentPayments(paymentsEmpty ? [] : paymentsList);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (import.meta.env.DEV) {
        const { sampleGeneralStats, samplePaymentStats, sampleRecentPayments } = await import('../../data/sampleDashboardData');
        setStats(sampleGeneralStats);
        setPaymentStats(samplePaymentStats);
        setRecentPayments(sampleRecentPayments);
      } else {
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
      }
    } finally {
      setLoading(false);
    }
  };


  const getStatusLabel = (status) => {
    const labels = { completed: 'مكتمل', pending: 'معلق', partial: 'غير مكتمل' };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const badges = { completed: 'badge-success', pending: 'badge-warning', partial: 'badge-warning' };
    return badges[status] || 'badge-gray';
  };

  // Shared helper for student price calculation
  const getStudentPrice = (course) => {
    if (!course) return 0;
    
    // Use backend's single source of truth if provided
    if (course.student_price !== undefined) {
      return parseFloat(course.student_price);
    }

    const packageName = course.course_package?.name || course.coursePackage?.name || '';
    const isDual = course.is_dual || false;
    const extraFee = parseFloat(course.extra_lectures_fee) || 0;

    if (isDual) {
      let basePrice = 0;
      if (packageName.includes('بمزاجي') || packageName === 'بمزاجي') {
        basePrice = 90000;
      } else if (packageName.includes('توازن') || packageName.includes('التوازن') || packageName === 'التوازن') {
        basePrice = 135000;
      } else if (packageName.includes('سرعة') || packageName.includes('السرعة') || packageName === 'السرعة') {
        basePrice = 225000;
      }
      return basePrice + (extraFee / 2);
    }
    const rawPrice = course.course_package?.price || course.coursePackage?.price || 0;
    return parseFloat(rawPrice || 0) + extraFee;
  };

  // Get payment completion status based on remaining amount
  const getPaymentStatus = (payment) => {
    const remaining = calculateRemainingAmount(payment);
    if (remaining > 0) {
      return 'partial'; // غير مكتمل
    }
    return 'completed'; // مكتمل
  };

  // Calculate actual remaining amount for a payment using course data
  const calculateRemainingAmount = (payment) => {
    if (!payment.course) return 0;
    
    const course = payment.course;
    const studentId = payment.student_id || payment.student?.id;
    const studentPrice = getStudentPrice(course);
    
    // Calculate total paid by THIS specific student in this course
    let totalPaid = 0;
    if (course.payments && Array.isArray(course.payments)) {
      const studentPayments = course.payments.filter(p => p.student_id === studentId);
      totalPaid = studentPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    } else {
      // Fallback if full payments array isn't loaded (backend missing course.payments)
      totalPaid = parseFloat(payment.amount || 0);
    }

    const remaining = studentPrice - totalPaid;
    return remaining > 0 ? remaining : 0;
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
                            <span className={`badge ${getStatusBadge(getPaymentStatus(payment))} text-[9px] px-1.5 py-0.5`}>
                              {getStatusLabel(getPaymentStatus(payment))}
                            </span>
                          </div>
                          
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">الطالب:</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); navigate('/students/' + payment.student_id); }}
                              className="text-[10px] font-semibold text-gray-800 dark:text-white truncate flex-1 text-right hover:text-primary-600 dark:hover:text-primary-400 hover:underline flex items-center gap-1"
                            >
                              {payment.student?.name || '-'}
                              <UserCircle className="w-3 h-3 opacity-60 inline-flex flex-shrink-0" />
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">التاريخ:</span>
                            <span className="text-[10px] text-gray-800 dark:text-white">
                              {formatDateSimple(payment.payment_date || payment.date)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">الكورس:</span>
                            <div className="flex flex-col items-start max-w-full min-w-0">
                              <span className="text-[10px] text-gray-800 dark:text-white truncate">{payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}</span>
                              {payment.course?.extra_lectures_count > 0 && (
                                <span className="mt-0.5 badge badge-purple text-[8px] px-1 py-0.5 whitespace-nowrap">
                                  + {payment.course?.extra_lectures_count} محاضرات (+ {formatCurrency(payment.course?.extra_lectures_fee)})
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">المبلغ:</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount)}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">المتبقي:</span>
                            {(() => {
                              const remaining = calculateRemainingAmount(payment);
                              return remaining > 0 ? (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</span>
                              ) : (
                                <span className="text-[10px] font-bold text-green-600 dark:text-green-400">مكتمل ✓</span>
                              );
                            })()}
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
                <th className="text-xs sm:text-sm">المتبقي</th>
                <th className="text-xs sm:text-sm">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.slice(0, 5).map((payment) => (
                <tr key={payment.id}>
                  <td className="font-semibold text-xs sm:text-sm">{payment.id}</td>
                  <td className="text-xs sm:text-sm">
                    {formatDateSimple(payment.payment_date || payment.date)}
                  </td>
                  <td className="font-semibold text-[var(--color-text-primary)] text-xs sm:text-sm">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate('/students/' + payment.student_id); }}
                      className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline flex items-center gap-1"
                      title="عرض ملف الطالب"
                    >
                      {payment.student?.name || '-'}
                      <UserCircle className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                    </button>
                  </td>
                  <td className="text-xs sm:text-sm">
                    <div className="flex flex-col items-start min-w-0">
                      <span>{payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}</span>
                      {payment.course?.extra_lectures_count > 0 && (
                        <span className="mt-1 badge badge-purple text-[9px] px-1 py-0.5 whitespace-nowrap">
                          + {payment.course?.extra_lectures_count} محاضرات إضافية (+ {formatCurrency(payment.course?.extra_lectures_fee)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="text-xs sm:text-sm">
                    {(() => {
                      const remaining = calculateRemainingAmount(payment);
                      return remaining > 0 ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</span>
                      ) : (
                        <span className="font-bold text-green-600 dark:text-green-400">مكتمل ✓</span>
                      );
                    })()}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(getPaymentStatus(payment))} text-xs`}>
                      {getStatusLabel(getPaymentStatus(payment))}
                    </span>
                  </td>
                </tr>
              ))}
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-[var(--color-text-muted)] text-xs sm:text-sm">
                    لا توجد مدفوعات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Profile Modal */}
          </div>
  );
};

export default AccountingDashboard;
