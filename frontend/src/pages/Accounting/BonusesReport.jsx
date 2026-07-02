import { useState, useEffect } from 'react';
import { Calendar, Trophy, RefreshCcw, BarChart3, Gift, ChevronLeft, ChevronRight, Loader2, Info, X, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import { formatDateShort } from '../../utils/dateFormat';

const BonusesReport = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    loading: false,
    trainerId: null,
    trainerName: '',
    bonusType: '', // 'competition' | 'renewal' | 'volume' | 'manual'
    data: null,
    error: '',
  });

  const openDetails = async (trainerId, trainerName, bonusType) => {
    setDetailsModal({
      open: true,
      loading: true,
      trainerId,
      trainerName,
      bonusType,
      data: null,
      error: '',
    });

    try {
      const response = await api.get('/finance/bonuses-report/details', {
        params: {
          trainer_id: trainerId,
          month: selectedMonth,
          year: selectedYear,
        }
      });
      if (response.data.success) {
        setDetailsModal(prev => ({
          ...prev,
          loading: false,
          data: response.data.data,
        }));
      } else {
        setDetailsModal(prev => ({
          ...prev,
          loading: false,
          error: response.data.message || 'فشل في تحميل التفاصيل',
        }));
      }
    } catch (err) {
      console.error('Error fetching bonus details:', err);
      setDetailsModal(prev => ({
        ...prev,
        loading: false,
        error: 'حدث خطأ أثناء تحميل التفاصيل',
      }));
    }
  };

  const months = [
    { id: 1, name: 'يناير' }, { id: 2, name: 'فبراير' }, { id: 3, name: 'مارس' },
    { id: 4, name: 'أبريل' }, { id: 5, name: 'مايو' }, { id: 6, name: 'يونيو' },
    { id: 7, name: 'يوليو' }, { id: 8, name: 'أغسطس' }, { id: 9, name: 'سبتمبر' },
    { id: 10, name: 'أكتوبر' }, { id: 11, name: 'نوفمبر' }, { id: 12, name: 'ديسمبر' }
  ];

  const fetchBonuses = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/finance/bonuses-report', {
        params: { month: selectedMonth, year: selectedYear }
      });
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.message || 'فشل في جلب البيانات');
      }
    } catch (err) {
      console.error('Error fetching bonuses:', err);
      setError('حدث خطأ أثناء جلب تقرير المكافآت');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBonuses();
  }, [selectedMonth, selectedYear]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  };

  const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-6 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
      <Info className="w-8 h-8 text-gray-400 mb-2" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-10">
      {/* Header & Date Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
              لوحة المكافآت والحوافز
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              تقرير مفصل بأسماء المدربين المستحقين للمكافآت التلقائية والإدارية
            </p>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            
            <div className="flex items-center gap-2 px-2 sm:px-4">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-sm sm:text-base font-bold text-gray-800 dark:text-white outline-none cursor-pointer appearance-none text-center"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                {months.map(m => (
                  <option key={m.id} value={m.id} className="text-gray-800 dark:text-white bg-white dark:bg-gray-800">
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-sm sm:text-base font-bold text-gray-800 dark:text-white outline-none cursor-pointer appearance-none"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                {[...Array(5)].map((_, i) => {
                  const y = today.getFullYear() - 2 + i;
                  return (
                    <option key={y} value={y} className="text-gray-800 dark:text-white bg-white dark:bg-gray-800">
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">جاري احتساب المكافآت واستخراج التقرير...</p>
        </div>
      ) : data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. Competition Bonus */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-900/50 overflow-hidden">
            <div className="bg-gradient-to-l from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 sm:p-5 border-b border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/50 p-2.5 rounded-xl">
                  <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">أبطال التجديدات</h2>
                  <p className="text-xs text-amber-600 dark:text-amber-400">مكافأة المنافسة (أفضل 3 مدربين)</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              {data.competition.length === 0 ? (
                <EmptyState message="لا يوجد مدربين مستحقين لهذه المكافأة في هذا الشهر" />
              ) : (
                <div className="space-y-3">
                  {data.competition.map((item, idx) => (
                    <div key={`comp-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 transition-all hover:border-amber-300 group">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-400 text-white shadow-sm' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-amber-700 text-white'}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p 
                            onClick={() => openDetails(item.trainer_id, item.trainer_name, 'competition')}
                            className="font-bold text-sm text-gray-800 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer hover:underline flex items-center gap-1.5"
                          >
                            {item.trainer_name}
                            <span className="text-[9px] font-normal text-amber-500 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              (عرض التفاصيل)
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.count} تجديدات</p>
                        </div>
                      </div>
                      <div className="font-bold text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Renewal Bonus */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-900/50 overflow-hidden">
            <div className="bg-gradient-to-l from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 sm:p-5 border-b border-emerald-100 dark:border-emerald-900/30">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2.5 rounded-xl">
                  <RefreshCcw className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">مكافأة التجديد</h2>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">للمدربين المحققين 5 أو 7 تجديدات</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              {/* Level 7 */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 px-1 uppercase tracking-wider">مستوى 7 تجديدات فأكثر</h3>
                {data.renewal.level_7.length === 0 ? (
                  <EmptyState message="لم يحقق أحد هذا المستوى" />
                ) : (
                  <div className="space-y-2">
                    {data.renewal.level_7.map((item) => (
                      <div key={`ren7-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 group">
                        <div>
                          <p 
                            onClick={() => openDetails(item.trainer_id, item.trainer_name, 'renewal')}
                            className="font-bold text-sm text-gray-800 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer hover:underline flex items-center gap-1.5"
                          >
                            {item.trainer_name}
                            <span className="text-[9px] font-normal text-emerald-500 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              (عرض التفاصيل)
                            </span>
                          </p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">{item.count} تجديدات</p>
                        </div>
                        <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Level 5 */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 px-1 uppercase tracking-wider">مستوى 5 إلى 6 تجديدات</h3>
                {data.renewal.level_5.length === 0 ? (
                  <EmptyState message="لم يحقق أحد هذا المستوى" />
                ) : (
                  <div className="space-y-2">
                    {data.renewal.level_5.map((item) => (
                      <div key={`ren5-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 group">
                        <div>
                          <p 
                            onClick={() => openDetails(item.trainer_id, item.trainer_name, 'renewal')}
                            className="font-bold text-sm text-gray-800 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer hover:underline flex items-center gap-1.5"
                          >
                            {item.trainer_name}
                            <span className="text-[9px] font-normal text-emerald-500 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              (عرض التفاصيل)
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.count} تجديدات</p>
                        </div>
                        <div className="font-bold text-sm text-gray-700 dark:text-gray-300">
                          {formatCurrency(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Volume Bonus */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-purple-200 dark:border-purple-900/50 overflow-hidden">
            <div className="bg-gradient-to-l from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 sm:p-5 border-b border-purple-100 dark:border-purple-900/30">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900/50 p-2.5 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">مكافأة الإنتاجية</h2>
                  <p className="text-xs text-purple-600 dark:text-purple-400">للمدربين المحققين 60 أو 80 محاضرة</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              {/* Level 80 */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 px-1 uppercase tracking-wider">مستوى 80 محاضرة فأكثر</h3>
                {data.volume.level_80.length === 0 ? (
                  <EmptyState message="لم يحقق أحد هذا المستوى" />
                ) : (
                  <div className="space-y-2">
                    {data.volume.level_80.map((item) => (
                      <div key={`vol80-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 group">
                        <div>
                          <p 
                            onClick={() => openDetails(item.trainer_id, item.trainer_name, 'volume')}
                            className="font-bold text-sm text-gray-800 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer hover:underline flex items-center gap-1.5"
                          >
                            {item.trainer_name}
                            <span className="text-[9px] font-normal text-purple-500 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              (عرض التفاصيل)
                            </span>
                          </p>
                          <p className="text-xs text-purple-600 dark:text-purple-400">{item.count} محاضرة مكتملة</p>
                        </div>
                        <div className="font-bold text-sm text-purple-600 dark:text-purple-400">
                          {formatCurrency(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Level 60 */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 px-1 uppercase tracking-wider">مستوى 60 إلى 79 محاضرة</h3>
                {data.volume.level_60.length === 0 ? (
                  <EmptyState message="لم يحقق أحد هذا المستوى" />
                ) : (
                  <div className="space-y-2">
                    {data.volume.level_60.map((item) => (
                      <div key={`vol60-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 group">
                        <div>
                          <p 
                            onClick={() => openDetails(item.trainer_id, item.trainer_name, 'volume')}
                            className="font-bold text-sm text-gray-800 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer hover:underline flex items-center gap-1.5"
                          >
                            {item.trainer_name}
                            <span className="text-[9px] font-normal text-purple-500 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              (عرض التفاصيل)
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.count} محاضرة مكتملة</p>
                        </div>
                        <div className="font-bold text-sm text-gray-700 dark:text-gray-300">
                          {formatCurrency(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Manual Bonus */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-900/50 overflow-hidden">
            <div className="bg-gradient-to-l from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 sm:p-5 border-b border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2.5 rounded-xl">
                  <Gift className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">المكافآت الإدارية المخصصة</h2>
                  <p className="text-xs text-blue-600 dark:text-blue-400">مكافآت تمت إضافتها يدوياً من قسم الرواتب</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              {data.manual.length === 0 ? (
                <EmptyState message="لا توجد مكافآت إدارية إضافية في هذا الشهر" />
              ) : (
                <div className="space-y-3">
                  {data.manual.map((item) => (
                    <div key={`manual-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 transition-all hover:border-blue-300 group">
                      <div>
                        <p 
                          onClick={() => openDetails(item.trainer_id, item.trainer_name, 'manual')}
                          className="font-bold text-sm text-gray-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer hover:underline flex items-center gap-1.5"
                        >
                          {item.trainer_name}
                          <span className="text-[9px] font-normal text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            (عرض التفاصيل)
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{item.notes}</p>
                      </div>
                      <div className="font-bold text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Details Modal */}
      {detailsModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 shadow-2xl backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden transform transition-all animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Gift className="w-6 h-6 text-indigo-500" />
                  تفاصيل مكافأة المدرب
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  المدرب: <span className="font-semibold text-gray-700 dark:text-gray-200">{detailsModal.trainerName}</span> (شهر {selectedMonth}/{selectedYear})
                </p>
              </div>
              <button 
                onClick={() => setDetailsModal({ open: false, loading: false, trainerId: null, trainerName: '', bonusType: '', data: null, error: '' })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-white dark:bg-gray-700 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
              {detailsModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">جاري تحميل تفاصيل المكافأة...</p>
                </div>
              ) : detailsModal.error ? (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-200 dark:border-red-800">
                  {detailsModal.error}
                </div>
              ) : detailsModal.data ? (
                <div className="space-y-6">
                  
                  {/* Summary Card */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">نوع الجائزة</span>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {detailsModal.bonusType === 'competition' && 'أبطال التجديد (مكافأة المنافسة)'}
                        {detailsModal.bonusType === 'renewal' && 'مكافأة تحقيق تجديدات'}
                        {detailsModal.bonusType === 'volume' && 'مكافأة الإنتاجية (المحاضرات)'}
                        {detailsModal.bonusType === 'manual' && 'مكافأة إدارية مخصصة'}
                      </span>
                    </div>
                    <div className="text-left" dir="rtl">
                      <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">الإحصائيات الكلية للشهر</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {detailsModal.bonusType === 'volume' 
                          ? `${detailsModal.data.lectures_count} محاضرة مكتملة` 
                          : `${detailsModal.data.renewals_count} تجديدات مقبولة`}
                      </span>
                    </div>
                  </div>

                  {/* Details Sections based on bonus type */}
                  {(detailsModal.bonusType === 'competition' || detailsModal.bonusType === 'renewal') && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 border-r-4 border-indigo-500 pr-2">
                        قائمة الكورسات المجددة ({detailsModal.data.renewed_courses.length})
                      </h4>
                      {detailsModal.data.renewed_courses.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900/20 rounded-xl">لا توجد تفاصيل تجديدات مسجلة.</p>
                      ) : (
                        <div className="space-y-3">
                          {detailsModal.data.renewed_courses.map(course => (
                            <div key={`rcourse-${course.id}`} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex flex-col sm:flex-row justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-gray-800 dark:text-white">
                                    {course.package_name}
                                  </span>
                                  {course.is_kids && (
                                    <span className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 text-[10px] px-2 py-0.5 rounded font-semibold">
                                      أطفال 👶
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  الطالب: <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {course.students.map(s => s.name).join(' و ')}
                                  </span>
                                </div>
                              </div>
                              <div className="text-left sm:self-center">
                                <span className="text-[10px] text-gray-400 block">تاريخ البدء</span>
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                  {formatDateShort(course.start_date)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {detailsModal.bonusType === 'volume' && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 border-r-4 border-indigo-500 pr-2">
                        سجل المحاضرات المكتملة في هذا الشهر ({detailsModal.data.completed_lectures.length})
                      </h4>
                      {detailsModal.data.completed_lectures.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900/20 rounded-xl">لا توجد محاضرات مسجلة.</p>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                          {detailsModal.data.completed_lectures.map((lecture, idx) => (
                            <div key={`l-${lecture.id}`} className="p-3.5 flex justify-between items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                                  <span className="font-bold text-sm text-gray-800 dark:text-white">
                                    {lecture.package_name}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  الطالب: {lecture.students.join(' و ')}
                                </div>
                              </div>
                              <div className="text-left text-xs">
                                <span className="font-bold text-gray-700 dark:text-gray-300 block">{formatDateShort(lecture.date)}</span>
                                <span className="text-gray-400 text-[10px]">{lecture.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {detailsModal.bonusType === 'manual' && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 border-r-4 border-indigo-500 pr-2">
                        تفاصيل المكافأة الإدارية
                      </h4>
                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed font-semibold">
                          {detailsModal.data.manual_bonus?.notes || 'لا توجد ملاحظات إضافية'}
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setDetailsModal({ open: false, loading: false, trainerId: null, trainerName: '', bonusType: '', data: null, error: '' })}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl transition-all font-medium text-sm focus:outline-none"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default BonusesReport;
