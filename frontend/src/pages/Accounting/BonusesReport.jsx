import { useState, useEffect } from 'react';
import { Calendar, Trophy, RefreshCcw, BarChart3, Gift, ChevronLeft, ChevronRight, Loader2, Info } from 'lucide-react';
import api from '../../api/axios';

const BonusesReport = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

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
                    <div key={`comp-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 transition-hover hover:border-amber-300">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-400 text-white shadow-sm' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-amber-700 text-white'}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-sm text-gray-800 dark:text-white">{item.trainer_name}</p>
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
                      <div key={`ren7-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                        <div>
                          <p className="font-bold text-sm text-gray-800 dark:text-white">{item.trainer_name}</p>
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
                      <div key={`ren5-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                        <div>
                          <p className="font-bold text-sm text-gray-800 dark:text-white">{item.trainer_name}</p>
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
                      <div key={`vol80-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30">
                        <div>
                          <p className="font-bold text-sm text-gray-800 dark:text-white">{item.trainer_name}</p>
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
                      <div key={`vol60-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                        <div>
                          <p className="font-bold text-sm text-gray-800 dark:text-white">{item.trainer_name}</p>
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
                    <div key={`manual-${item.trainer_id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 transition-hover hover:border-blue-300">
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-white">{item.trainer_name}</p>
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
    </div>
  );
};

export default BonusesReport;
