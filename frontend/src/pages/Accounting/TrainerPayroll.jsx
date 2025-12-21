import { useState, useEffect } from 'react';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  DollarSign,
  Users,
  Award,
  TrendingUp,
  Calendar,
  ChevronDown,
  Trophy,
  Repeat,
  BookOpen,
  Star,
} from 'lucide-react';

const TrainerPayroll = () => {
  const [payrollData, setPayrollData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedTrainer, setExpandedTrainer] = useState(null);

  const months = [
    { value: 1, label: 'يناير' },
    { value: 2, label: 'فبراير' },
    { value: 3, label: 'مارس' },
    { value: 4, label: 'أبريل' },
    { value: 5, label: 'مايو' },
    { value: 6, label: 'يونيو' },
    { value: 7, label: 'يوليو' },
    { value: 8, label: 'أغسطس' },
    { value: 9, label: 'سبتمبر' },
    { value: 10, label: 'أكتوبر' },
    { value: 11, label: 'نوفمبر' },
    { value: 12, label: 'ديسمبر' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchPayrollData();
  }, [selectedMonth, selectedYear]);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/trainer-payroll', {
        params: { month: selectedMonth, year: selectedYear },
      });
      setPayrollData(response.data.data || response.data);
    } catch (error) {
      console.error('Error fetching payroll data:', error);
      // إذا لم يكن الـ API موجوداً، نستخدم بيانات افتراضية
      setPayrollData({
        month: selectedMonth,
        year: selectedYear,
        payrolls: [],
        competition_winners: [],
        summary: {
          total_trainers: 0,
          total_lectures: 0,
          total_renewals: 0,
          total_payout: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US').format(amount || 0) + ' د.ع';
  };

  const getVolumeBonus = (lectures) => {
    if (lectures >= 80) return { amount: 80000, label: 'مكافأة 80 محاضرة' };
    if (lectures >= 60) return { amount: 30000, label: 'مكافأة 60 محاضرة' };
    return { amount: 0, label: '-' };
  };

  const isCompetitionWinner = (trainerId) => {
    return payrollData?.competition_winners?.some((w) => w.trainer_id === trainerId);
  };

  const getWinnerRank = (trainerId) => {
    const winner = payrollData?.competition_winners?.find((w) => w.trainer_id === trainerId);
    return winner?.rank || 0;
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  const payrolls = payrollData?.payrolls || [];
  const summary = payrollData?.summary || {};
  const competitionWinners = payrollData?.competition_winners || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            رواتب المدربين
          </h1>
          <p className="page-subtitle">عرض رواتب المدربين والبونصات الشهرية</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="input-field pl-10 pr-4 appearance-none cursor-pointer"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="input-field pl-10 pr-4 appearance-none cursor-pointer"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">إجمالي الرواتب</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.total_payout)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">عدد المدربين</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {summary.total_trainers || payrolls.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">إجمالي المحاضرات</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {summary.total_lectures || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/20">
              <Repeat className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">إجمالي التجديدات</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {summary.total_renewals || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Competition Winners */}
      {competitionWinners.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-b border-amber-200 dark:border-amber-800">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              الفائزون بمكافأة المنافسة
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                (أعلى 3 مدربين بالتجديدات)
              </span>
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {competitionWinners.map((winner, index) => (
                <div
                  key={winner.trainer_id}
                  className={`relative p-4 rounded-xl border-2 ${
                    index === 0
                      ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-400'
                      : index === 1
                      ? 'bg-gradient-to-br from-slate-300/20 to-slate-400/10 border-slate-400'
                      : 'bg-gradient-to-br from-orange-400/20 to-orange-500/10 border-orange-400'
                  }`}
                >
                  <div className="absolute -top-3 -right-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
                        index === 0
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                          : index === 1
                          ? 'bg-gradient-to-br from-slate-400 to-slate-500'
                          : 'bg-gradient-to-br from-orange-400 to-orange-500'
                      }`}
                    >
                      {winner.rank}
                    </div>
                  </div>
                  <div className="pt-2">
                    <h3 className="font-bold text-lg text-[var(--color-text-primary)]">
                      {winner.trainer_name}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      {winner.renewals_count} تجديد
                    </p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      +{formatCurrency(winner.bonus)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      {payrolls.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات رواتب"
          description={`لا توجد بيانات رواتب لشهر ${months[selectedMonth - 1]?.label} ${selectedYear}`}
          icon={DollarSign}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              تفاصيل رواتب المدربين
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>المدرب</th>
                  <th>المحاضرات</th>
                  <th>الراتب الأساسي</th>
                  <th>التجديدات</th>
                  <th>مكافأة التجديد</th>
                  <th>مكافأة الكمية</th>
                  <th>مكافأة المنافسة</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((payroll, index) => {
                  const volumeBonus = getVolumeBonus(payroll.completed_lectures);
                  const isWinner = isCompetitionWinner(payroll.trainer_id);
                  const rank = getWinnerRank(payroll.trainer_id);

                  return (
                    <tr
                      key={payroll.trainer_id}
                      className={`cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                        isWinner ? 'bg-amber-50 dark:bg-amber-900/10' : ''
                      }`}
                      onClick={() =>
                        setExpandedTrainer(
                          expandedTrainer === payroll.trainer_id ? null : payroll.trainer_id
                        )
                      }
                    >
                      <td className="font-semibold">{index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {payroll.trainer_name}
                          </span>
                          {isWinner && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                rank === 1
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : rank === 2
                                  ? 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400'
                                  : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}
                            >
                              <Trophy className="w-3 h-3" />
                              المركز {rank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {payroll.completed_lectures} محاضرة
                        </span>
                      </td>
                      <td className="font-medium">{formatCurrency(payroll.base_pay)}</td>
                      <td>
                        <span className="badge badge-purple">{payroll.renewals_count} تجديد</span>
                      </td>
                      <td className="text-amber-600 dark:text-amber-400 font-medium">
                        {payroll.renewal_total > 0 ? `+${formatCurrency(payroll.renewal_total)}` : '-'}
                      </td>
                      <td>
                        {payroll.volume_bonus > 0 ? (
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                            +{formatCurrency(payroll.volume_bonus)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">-</span>
                        )}
                      </td>
                      <td>
                        {payroll.competition_bonus > 0 ? (
                          <span className="text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-1">
                            <Star className="w-4 h-4" />
                            +{formatCurrency(payroll.competition_bonus)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">-</span>
                        )}
                      </td>
                      <td>
                        <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(payroll.total_pay)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[var(--color-bg-tertiary)]">
                <tr>
                  <td colSpan="3" className="font-bold text-[var(--color-text-primary)]">
                    الإجمالي
                  </td>
                  <td className="font-bold">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.base_pay || 0), 0))}
                  </td>
                  <td></td>
                  <td className="font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.renewal_total || 0), 0))}
                  </td>
                  <td className="font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.volume_bonus || 0), 0))}
                  </td>
                  <td className="font-bold text-yellow-600 dark:text-yellow-400">
                    {formatCurrency(
                      payrolls.reduce((sum, p) => sum + (p.competition_bonus || 0), 0)
                    )}
                  </td>
                  <td className="font-bold text-xl text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(payrolls.reduce((sum, p) => sum + (p.total_pay || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Bonus Info */}
      <div className="card p-6">
        <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-primary-500" />
          نظام المكافآت والبونصات
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">سعر المحاضرة</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">4,000 د.ع</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">لكل محاضرة مكتملة</p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">مكافأة التجديد</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">5,000 د.ع</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">لكل تجديد مع نفس المدرب</p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">مكافأة الكمية</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                60+ = 30,000 د.ع
              </p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                80+ = 80,000 د.ع
              </p>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">محاضرات شهرياً</p>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-[var(--color-text-primary)]">مكافأة المنافسة</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">20,000 د.ع</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              لأفضل 3 مدربين بالتجديدات
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerPayroll;

