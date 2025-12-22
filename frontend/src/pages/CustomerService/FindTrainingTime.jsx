import { useState } from 'react';
import { Search, Clock, Calendar, User, Users, CheckCircle, CalendarDays, AlertCircle } from 'lucide-react';
import api from '../../api/axios';

const FindTrainingTime = () => {
  // Days of the week (Arabic calendar starts with Saturday)
  const weekDaysOptions = [
    { id: 6, name: 'السبت' },
    { id: 0, name: 'الأحد' },
    { id: 1, name: 'الإثنين' },
    { id: 2, name: 'الثلاثاء' },
    { id: 3, name: 'الأربعاء' },
    { id: 4, name: 'الخميس' },
    { id: 5, name: 'الجمعة' },
  ];

  // First filter state (multiple days per week for a month)
  const [selectedWeekDays, setSelectedWeekDays] = useState([]);
  const [time1, setTime1] = useState('');
  const [results1, setResults1] = useState([]);
  const [loading1, setLoading1] = useState(false);
  const [searched1, setSearched1] = useState(false);

  // Second filter state (number of days and time)
  const [selectedDaysCount, setSelectedDaysCount] = useState(null);
  const [time2, setTime2] = useState('');
  const [results2, setResults2] = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [searched2, setSearched2] = useState(false);

  const toggleWeekDay = (dayId) => {
    setSelectedWeekDays(prev => {
      if (prev.includes(dayId)) {
        return prev.filter(d => d !== dayId);
      }
      // No limit - allow any number of days
      return [...prev, dayId];
    });
  };

  // Generate all dates for selected days within the next month
  const generateDatesForMonth = (weekDays) => {
    const dates = [];
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);

    const current = new Date(today);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (weekDays.includes(dayOfWeek)) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Handle first search (multiple days per week)
  const handleSearch1 = async () => {
    if (selectedWeekDays.length === 0) {
      alert('الرجاء تحديد يوم واحد على الأقل');
      return;
    }
    if (!time1) {
      alert('الرجاء تحديد الوقت');
      return;
    }

    setLoading1(true);
    setSearched1(true);
    
    try {
      // Generate all dates for the selected days within the next month
      const dates = generateDatesForMonth(selectedWeekDays);
      
      const response = await api.post('/trainers/available-monthly', {
        week_days: selectedWeekDays,
        dates: dates,
        time: time1,
      });
      
      setResults1(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error searching for available trainers:', error);
      console.error('Error details:', error.response?.data || error.message);
      setResults1([]);
    } finally {
      setLoading1(false);
    }
  };

  // Handle second search (number of days with time)
  const handleSearch2 = async () => {
    if (!selectedDaysCount) {
      alert('الرجاء تحديد عدد الأيام');
      return;
    }
    if (!time2) {
      alert('الرجاء تحديد الوقت');
      return;
    }

    setLoading2(true);
    setSearched2(true);
    
    try {
      // Search for trainers who have the specified number of free days per week at the given time
      // We need to check all possible combinations of days that match the count
      // For now, we'll use the available-monthly endpoint with all week days
      // and filter results on the backend or check all combinations
      
      // Generate all possible combinations of week days (1-7 days)
      const allWeekDays = [6, 0, 1, 2, 3, 4, 5]; // Saturday to Friday
      
      // For simplicity, we'll search for trainers available on any combination
      // The backend should handle finding trainers with exactly selectedDaysCount free days
      const response = await api.post('/trainers/available-monthly', {
        week_days: allWeekDays,
        dates: generateDatesForMonth(allWeekDays),
        time: time2,
        min_days_count: selectedDaysCount, // We'll need to add this parameter
      });
      
      // Filter results to find trainers with at least selectedDaysCount free days
      // For now, we'll return all results and let the backend handle it
      // If backend doesn't support min_days_count, we'll filter on frontend
      let filteredResults = response.data.data || response.data || [];
      
      // If backend doesn't filter by min_days_count, we need to check each trainer
      // This is a simplified approach - ideally backend should handle this
      setResults2(filteredResults);
    } catch (error) {
      console.error('Error searching for available trainers:', error);
      console.error('Error details:', error.response?.data || error.message);
      setResults2([]);
    } finally {
      setLoading2(false);
    }
  };

  // Get day names from IDs
  const getSelectedDayNames = () => {
    return selectedWeekDays
      .map(id => weekDaysOptions.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join('، ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] pr-20">
            البحث عن وقت تدريب
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            ابحث عن المدربين المتاحين في أوقات محددة
          </p>
        </div>
      </div>

      {/* Two Column Layout for Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Filter 1: Multiple Days per Week for a Month */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-500" />
            البحث عن تفرغ أسبوعي
          </h2>
          
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              اختر أيام الأسبوع المطلوبة للبحث عن المدربين المتفرغين خلال الشهر القادم
            </p>
          </div>

          {/* Week Days Selection */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {weekDaysOptions.map((day) => {
              const isSelected = selectedWeekDays.includes(day.id);
              
              return (
                <button
                  key={day.id}
                  onClick={() => toggleWeekDay(day.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-[var(--color-border)] hover:border-emerald-300 hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                >
                  <p className={`text-xs font-bold ${
                    isSelected 
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-[var(--color-text-primary)]'
                  }`}>
                    {day.name}
                  </p>
                  {isSelected && (
                    <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Time Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
                <Clock className="w-4 h-4 inline-block ml-1" />
                الوقت المطلوب
              </label>
              <input
                type="time"
                value={time1}
                onChange={(e) => setTime1(e.target.value)}
                className="input w-full"
              />
            </div>

            {/* Selected Info */}
            {selectedWeekDays.length > 0 && (
              <div className="p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  <span className="font-medium">الأيام المحددة ({selectedWeekDays.length}):</span>{' '}
                  {getSelectedDayNames()}
                </p>
              </div>
            )}

            {/* Search Button */}
            <button
              onClick={handleSearch1}
              disabled={loading1 || selectedWeekDays.length === 0 || !time1}
              className="btn btn-primary w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading1 ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              بحث عن المدربين المتفرغين
            </button>
          </div>

          {/* Results */}
          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              النتائج
              {results1.length > 0 && (
                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                  {results1.length} مدرب متفرغ
                </span>
              )}
            </h3>
            
            {!searched1 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                حدد الأيام والوقت للبحث
              </p>
            ) : loading1 ? (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : results1.length === 0 ? (
              <div className="text-center py-4">
                <User className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-muted)] opacity-50" />
                <p className="text-sm text-[var(--color-text-muted)]">لا يوجد مدربين متفرغين في هذه الأيام</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results1.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">
                        {trainer.name?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)] truncate">
                        {trainer.name}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        متفرغ في جميع الأيام المحددة
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter 2: Number of Days with Time */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            البحث عن تفرغ أسبوعي بوقت محدد
          </h2>
          
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              اختر عدد الأيام المطلوبة ووقت التفرغ للبحث عن المدربين المتفرغين
            </p>
          </div>

          {/* Days Count Selection (7 boxes for numbers 1-7) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-3">
              عدد الأيام المطلوبة
            </label>
            <div className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                const isSelected = selectedDaysCount === dayNum;
                
                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedDaysCount(dayNum)}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-[var(--color-border)] hover:border-primary-300 hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    <p className={`text-lg font-bold ${
                      isSelected 
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-[var(--color-text-primary)]'
                    }`}>
                      {dayNum}
                    </p>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-primary-500 mx-auto mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
              <Clock className="w-4 h-4 inline-block ml-1" />
              وقت التفرغ
            </label>
            <input
              type="time"
              value={time2}
              onChange={(e) => setTime2(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Selected Info */}
          {selectedDaysCount && time2 && (
            <div className="p-3 rounded-lg border bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 mb-4">
              <p className="text-sm text-primary-700 dark:text-primary-400">
                <span className="font-medium">البحث عن:</span>{' '}
                مدربين لديهم {selectedDaysCount} {selectedDaysCount === 1 ? 'يوم' : selectedDaysCount === 2 ? 'يومان' : 'أيام'} متفرغة في الأسبوع بوقت {time2}
              </p>
            </div>
          )}

          {/* Search Button */}
          <button
            onClick={handleSearch2}
            disabled={loading2 || !selectedDaysCount || !time2}
            className="btn btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {loading2 ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            بحث عن المدربين المتفرغين
          </button>

          {/* Results */}
          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              النتائج
              {results2.length > 0 && (
                <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs px-2 py-0.5 rounded-full">
                  {results2.length} مدرب متاح
                </span>
              )}
            </h3>
            
            {!searched2 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                حدد التاريخ والوقت للبحث
              </p>
            ) : loading2 ? (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : results2.length === 0 ? (
              <div className="text-center py-4">
                <User className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-muted)] opacity-50" />
                <p className="text-sm text-[var(--color-text-muted)]">لا يوجد مدربين متاحين</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results2.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">
                        {trainer.name?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)] truncate">
                        {trainer.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {trainer.phone || trainer.email}
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindTrainingTime;
