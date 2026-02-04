import { useState, useEffect } from 'react';
import { Trophy, CheckCircle, BookOpen, Target, TrendingUp } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/currencyFormat';

const Achievements = () => {
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/trainer/achievements');
      console.log('Achievements response:', response);
      if (response?.data?.success) {
        setAchievements(response.data.data);
      } else {
        setError(response?.data?.message || 'فشل تحميل البيانات');
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'حدث خطأ أثناء تحميل البيانات';
      if (error.response?.status === 401) {
        errorMessage = 'غير مصرح - يرجى تسجيل الدخول مرة أخرى';
      } else if (error.response?.status === 403) {
        errorMessage = 'غير مصرح - ليس لديك صلاحية للوصول إلى هذه الصفحة';
      } else if (error.response?.status === 404) {
        errorMessage = 'لم يتم العثور على ملف المدرب. يرجى الاتصال بالمسؤول.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
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

  if (!achievements) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-500 dark:text-gray-400">لا توجد بيانات متاحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
          <Trophy className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
        </div>
        <h1 className="text-lg sm:text-3xl font-bold text-gray-800 dark:text-white">
          إنجازاتي
        </h1>
      </div>

      {/* Monthly Earnings Section */}
      {achievements.earnings && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg sm:rounded-xl shadow-md sm:shadow-lg overflow-hidden border border-purple-200 dark:border-purple-700">
          <div className="p-3 sm:p-4 border-b border-purple-200 dark:border-purple-700">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <h2 className="text-sm sm:text-2xl font-bold text-gray-800 dark:text-white">
                استحقاقي لهذا الشهر
              </h2>
            </div>
          </div>
          <div className="p-3 sm:p-6">
            <div className="space-y-2.5 sm:space-y-4">
              {/* Base Pay */}
              <div className="flex items-center justify-between p-2.5 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-base">💰</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">الراتب الأساسي</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                      {achievements.completed_lectures || 0} محاضرة × {formatCurrency(achievements.earnings.lecture_rate || 4000)}
                    </p>
                  </div>
                </div>
                <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white mr-2 sm:mr-0 flex-shrink-0">
                  {formatCurrency(achievements.earnings.base_pay || 0)}
                </p>
              </div>

              {/* Renewal Bonus */}
              {achievements.earnings.renewal_bonus > 0 && (
                <div className="flex items-center justify-between p-2.5 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-base">🔄</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">مكافأة التجديد</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                        {achievements.renewals_count || 0} تجديد
                      </p>
                    </div>
                  </div>
                  <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400 mr-2 sm:mr-0 flex-shrink-0">
                    +{formatCurrency(achievements.earnings.renewal_bonus || 0)}
                  </p>
                </div>
              )}

              {/* Competition Bonus */}
              {achievements.earnings.competition_bonus > 0 && (
                <div className="flex items-center justify-between p-2.5 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-base">🏆</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">مكافأة المنافسة</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                        من أفضل 3 مدربين
                      </p>
                    </div>
                  </div>
                  <p className="text-sm sm:text-lg font-bold text-yellow-600 dark:text-yellow-400 mr-2 sm:mr-0 flex-shrink-0">
                    +{formatCurrency(achievements.earnings.competition_bonus || 0)}
                  </p>
                </div>
              )}

              {/* Volume Bonus */}
              {achievements.earnings.volume_bonus > 0 && (
                <div className="flex items-center justify-between p-2.5 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-base">📊</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">مكافأة الكمية</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                        {achievements.completed_lectures || 0} محاضرة مكتملة
                      </p>
                    </div>
                  </div>
                  <p className="text-sm sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 mr-2 sm:mr-0 flex-shrink-0">
                    +{formatCurrency(achievements.earnings.volume_bonus || 0)}
                  </p>
                </div>
              )}

              {/* Total Earnings */}
              <div className="flex items-center justify-between p-3 sm:p-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg border-2 border-purple-600 dark:border-purple-500">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-lg font-bold text-white">الإجمالي</p>
                    <p className="text-[10px] sm:text-xs text-white/80">استحقاق الشهر الحالي</p>
                  </div>
                </div>
                <p className="text-base sm:text-3xl font-bold text-white mr-2 sm:mr-0 flex-shrink-0">
                  {formatCurrency(achievements.earnings.total || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-md sm:shadow-lg overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm sm:text-xl font-semibold text-gray-800 dark:text-white">
            إحصائيات الشهر الحالي
          </h2>
        </div>
        <div className="p-3 sm:p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-6">
            {/* Completed Lectures */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-2 sm:p-4 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex flex-col items-center text-center mb-1.5 sm:mb-2">
                <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-[10px] sm:text-sm text-green-600 dark:text-green-400 font-semibold">المكتملة</span>
              </div>
              <p className="text-base sm:text-2xl font-bold text-gray-800 dark:text-white text-center">
                {achievements.completed_lectures || 0}
              </p>
              <p className="text-[9px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5 text-center">محاضرة</p>
            </div>

            {/* Courses Count */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-2 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex flex-col items-center text-center mb-1.5 sm:mb-2">
                <BookOpen className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-[10px] sm:text-sm text-blue-600 dark:text-blue-400 font-semibold">الكورسات</span>
              </div>
              <p className="text-base sm:text-2xl font-bold text-gray-800 dark:text-white text-center">
                {achievements.courses_count || 0}
              </p>
              <p className="text-[9px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5 text-center">كورس</p>
            </div>

            {/* Remaining Lectures */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-2 sm:p-4 rounded-lg border border-orange-200 dark:border-orange-700">
              <div className="flex flex-col items-center text-center mb-1.5 sm:mb-2">
                <Target className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400 mb-1" />
                <span className="text-[10px] sm:text-sm text-orange-600 dark:text-orange-400 font-semibold">المتبقية</span>
              </div>
              <p className="text-base sm:text-2xl font-bold text-gray-800 dark:text-white text-center">
                {achievements.remaining_lectures || 0}
              </p>
              <p className="text-[9px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5 text-center">محاضرة</p>
            </div>
          </div>

          {/* Bonuses Section */}
          {achievements.bonuses && (
            <div className="space-y-3 sm:space-y-6">
              <h3 className="text-xs sm:text-lg font-semibold text-gray-800 dark:text-white mb-3 sm:mb-4">
                التقدم نحو المكافآت
              </h3>
              
              {/* Renewal Bonus */}
              {achievements.bonuses.renewal && achievements.bonuses.renewal.levels && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-blue-200 dark:border-blue-700 overflow-hidden">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm sm:text-lg">🔄</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white">
                          {achievements.bonuses.renewal.name}
                        </h4>
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                        التجديدات
                      </p>
                      <p className="text-xs sm:text-base font-bold text-blue-600 dark:text-blue-400">
                        {achievements.renewals_count || 0}
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar RTL with Milestones */}
                  <div className="relative mb-4">
                    {/* Progress Bar Background */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-2.5 relative mb-8" dir="rtl">
                      {/* Progress Fill - RTL */}
                      <div
                        className="h-full bg-gradient-to-l from-blue-500 to-indigo-600 transition-all duration-500 rounded-full"
                        style={{ 
                          width: `${Math.min(100, ((achievements.renewals_count || 0) / Math.max(...achievements.bonuses.renewal.levels.map(l => l.target))) * 100)}%` 
                        }}
                      ></div>
                      
                      {/* Milestone Points */}
                      {achievements.bonuses.renewal.levels.map((level, index) => {
                        const maxTarget = Math.max(...achievements.bonuses.renewal.levels.map(l => l.target));
                        const position = (level.target / maxTarget) * 100;
                        const isAchieved = (achievements.renewals_count || 0) >= level.target;
                        const remaining = Math.max(0, level.target - (achievements.renewals_count || 0));
                        // For the last milestone (7), position it at 100% (end of line)
                        const finalPosition = index === achievements.bonuses.renewal.levels.length - 1 ? 100 : position;
                        return (
                          <div
                            key={index}
                            className="absolute top-1/2"
                            style={{ 
                              right: `${finalPosition}%`,
                              transform: finalPosition === 100 ? 'translate(100%, -50%)' : finalPosition < 10 ? 'translate(0, -50%)' : 'translate(50%, -50%)'
                            }}
                          >
                            {/* Milestone Dot - centered on the line */}
                            <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 flex items-center justify-center z-10 ${
                              isAchieved 
                                ? 'bg-green-500 border-green-600 shadow-lg' 
                                : 'bg-white dark:bg-gray-800 border-gray-400 dark:border-gray-500'
                            }`}>
                              {isAchieved && <span className="text-white text-[8px] sm:text-[10px]">✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Labels below the bar - inside card */}
                    <div className="flex justify-between items-start mt-2">
                      {achievements.bonuses.renewal.levels.map((level, index) => {
                        const isAchieved = (achievements.renewals_count || 0) >= level.target;
                        const remaining = Math.max(0, level.target - (achievements.renewals_count || 0));
                        return (
                          <div
                            key={index}
                            className="text-center flex-1"
                            style={{ 
                              marginRight: index === 0 ? 'auto' : '0',
                              marginLeft: index === achievements.bonuses.renewal.levels.length - 1 ? 'auto' : '0'
                            }}
                          >
                            <p className={`text-[10px] sm:text-xs font-bold ${isAchieved ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {level.target} تجديد
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatCurrency(level.amount)}
                            </p>
                            {!isAchieved && remaining > 0 && (
                              <p className="text-[8px] sm:text-[9px] text-orange-600 dark:text-orange-400 mt-0.5 font-medium">
                                متبقي: {remaining}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    {achievements.bonuses.renewal.levels.map((level, index) => {
                      const isAchieved = (achievements.renewals_count || 0) >= level.target;
                      const remaining = Math.max(0, level.target - (achievements.renewals_count || 0));
                      return (
                        <div
                          key={index}
                          className={`p-2 rounded-lg border ${
                            isAchieved
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] sm:text-[10px] font-medium text-gray-600 dark:text-gray-400">
                              {level.label}
                            </span>
                            {isAchieved && (
                              <span className="text-green-600 dark:text-green-400 text-[10px]">✓</span>
                            )}
                          </div>
                          <p className={`text-[10px] sm:text-xs font-bold ${
                            isAchieved ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {formatCurrency(level.amount)}
                          </p>
                          {!isAchieved && (
                            <p className="text-[8px] sm:text-[9px] text-orange-600 dark:text-orange-400 mt-0.5">
                              متبقي {remaining}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Competition Bonus */}
              {achievements.bonuses.competition && (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-3 sm:p-5 rounded-lg sm:rounded-xl border border-yellow-200 dark:border-yellow-700">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm sm:text-xl">🏆</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-base font-bold text-gray-800 dark:text-white">
                        {achievements.bonuses.competition.name}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {achievements.bonuses.competition.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Simple Progress Bar for Competition */}
                  <div className="relative">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 sm:h-5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          achievements.bonuses.competition.achieved
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : 'bg-gradient-to-r from-yellow-400 to-amber-500'
                        }`}
                        style={{ width: achievements.bonuses.competition.achieved ? '100%' : '0%' }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          المكافأة: <span className="font-bold text-yellow-600 dark:text-yellow-400">
                            {formatCurrency(achievements.bonuses.competition.amount)}
                          </span>
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                          التجديدات: {achievements.bonuses.competition.current || 0}
                        </p>
                      </div>
                      <div className={`px-4 py-2 rounded-lg font-medium text-sm ${
                        achievements.bonuses.competition.achieved
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {achievements.bonuses.competition.achieved ? '✓ محقق' : 'غير محقق'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Volume Bonus */}
              {achievements.bonuses.volume && achievements.bonuses.volume.levels && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-purple-200 dark:border-purple-700 overflow-hidden">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm sm:text-lg">📊</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white">
                          {achievements.bonuses.volume.name}
                        </h4>
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                        المحاضرات
                      </p>
                      <p className="text-xs sm:text-base font-bold text-purple-600 dark:text-purple-400">
                        {achievements.completed_lectures || 0}
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar RTL with Milestones */}
                  <div className="relative mb-4">
                    {/* Progress Bar Background */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-2.5 relative mb-8" dir="rtl">
                      {/* Progress Fill - RTL */}
                      <div
                        className="h-full bg-gradient-to-l from-purple-500 to-pink-600 transition-all duration-500 rounded-full"
                        style={{ 
                          width: `${Math.min(100, ((achievements.completed_lectures || 0) / Math.max(...achievements.bonuses.volume.levels.map(l => l.target))) * 100)}%` 
                        }}
                      ></div>
                      
                      {/* Milestone Points */}
                      {achievements.bonuses.volume.levels.map((level, index) => {
                        const maxTarget = Math.max(...achievements.bonuses.volume.levels.map(l => l.target));
                        const position = (level.target / maxTarget) * 100;
                        const isAchieved = (achievements.completed_lectures || 0) >= level.target;
                        // For the last milestone (80), position it at 100% (end of line)
                        const finalPosition = index === achievements.bonuses.volume.levels.length - 1 ? 100 : position;
                        return (
                          <div
                            key={index}
                            className="absolute top-1/2"
                            style={{ 
                              right: `${finalPosition}%`,
                              transform: finalPosition === 100 ? 'translate(100%, -50%)' : finalPosition < 10 ? 'translate(0, -50%)' : 'translate(50%, -50%)'
                            }}
                          >
                            {/* Milestone Dot - centered on the line */}
                            <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 flex items-center justify-center z-10 ${
                              isAchieved 
                                ? 'bg-green-500 border-green-600 shadow-lg' 
                                : 'bg-white dark:bg-gray-800 border-gray-400 dark:border-gray-500'
                            }`}>
                              {isAchieved && <span className="text-white text-[8px] sm:text-[10px]">✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Labels below the bar - inside card */}
                    <div className="flex justify-between items-start mt-2">
                      {achievements.bonuses.volume.levels.map((level, index) => {
                        const isAchieved = (achievements.completed_lectures || 0) >= level.target;
                        const remaining = Math.max(0, level.target - (achievements.completed_lectures || 0));
                        return (
                          <div
                            key={index}
                            className="text-center flex-1"
                            style={{ 
                              marginRight: index === 0 ? 'auto' : '0',
                              marginLeft: index === achievements.bonuses.volume.levels.length - 1 ? 'auto' : '0'
                            }}
                          >
                            <p className={`text-[10px] sm:text-xs font-bold ${isAchieved ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {level.target} محاضرة
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {level.label}
                            </p>
                            {!isAchieved && remaining > 0 && (
                              <p className="text-[8px] sm:text-[9px] text-orange-600 dark:text-orange-400 mt-0.5 font-medium">
                                متبقي: {remaining}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Achievements;

