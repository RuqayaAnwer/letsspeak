import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Clock, Calendar, Save, X, Plus, Trash2, CheckCircle } from 'lucide-react';

const MyTimes = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [unavailableTimes, setUnavailableTimes] = useState([]);
  const [notes, setNotes] = useState('');
  const [stats, setStats] = useState({
    completedLectures: 0,
    completedCoursesThisMonth: 0,
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [restrictionInfo, setRestrictionInfo] = useState(null);

  const weekDays = [
    { key: 'Sunday', label: 'الأحد' },
    { key: 'Monday', label: 'الاثنين' },
    { key: 'Tuesday', label: 'الثلاثاء' },
    { key: 'Wednesday', label: 'الأربعاء' },
    { key: 'Thursday', label: 'الخميس' },
    { key: 'Friday', label: 'الجمعة' },
    { key: 'Saturday', label: 'السبت' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [unavailabilityRes, dashboardRes] = await Promise.all([
        api.get('/trainer/unavailability'),
        api.get('/trainer/dashboard'),
      ]);

      if (unavailabilityRes.data.success && unavailabilityRes.data.data) {
        const data = unavailabilityRes.data.data;
        setUnavailableDays(data.unavailable_days || []);
        setUnavailableTimes(data.unavailable_times || []);
        setNotes(data.notes || '');
        
        // Check restrictions
        if (data.last_day_off_update) {
          const lastUpdate = new Date(data.last_day_off_update);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          
          if (lastUpdate > weekAgo) {
            const daysRemaining = Math.ceil((lastUpdate.getTime() + 7 * 24 * 60 * 60 * 1000 - new Date().getTime()) / (24 * 60 * 60 * 1000));
            setRestrictionInfo({
              type: 'weekly',
              daysRemaining: daysRemaining,
              message: `لا يمكن تعديل يوم الإجازة إلا بعد أسبوع من آخر تعديل. متبقي ${daysRemaining} يوم.`
            });
          }
        }
      }

      if (dashboardRes.data.success) {
        const courses = dashboardRes.data.data.courses || [];
        let completedLectures = 0;
        let completedCoursesThisMonth = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        courses.forEach((course) => {
          // Count completed lectures
          const completedLecturesInCourse = (course.lectures || []).filter((lecture) => {
            return lecture.is_completed || lecture.attendance === 'present' || lecture.attendance === 'absent';
          }).length;
          completedLectures += completedLecturesInCourse;

          // Check if course is completed this month
          const hasLecturesThisMonth = (course.lectures || []).some((lecture) => {
            const lectureDate = new Date(lecture.date);
            return (
              lectureDate.getMonth() === currentMonth &&
              lectureDate.getFullYear() === currentYear
            );
          });

          if (hasLecturesThisMonth) {
            // Check if all lectures this month are completed
            const lecturesThisMonth = (course.lectures || []).filter((lecture) => {
              const lectureDate = new Date(lecture.date);
              return (
                lectureDate.getMonth() === currentMonth &&
                lectureDate.getFullYear() === currentYear
              );
            });

            const allCompletedThisMonth = lecturesThisMonth.every((lecture) => {
              return lecture.is_completed || lecture.attendance === 'present' || lecture.attendance === 'absent';
            });

            if (allCompletedThisMonth && lecturesThisMonth.length > 0) {
              completedCoursesThisMonth += 1;
            }
          }
        });

        setStats({
          completedLectures: completedLectures,
          completedCoursesThisMonth: completedCoursesThisMonth,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayKey) => {
    setUnavailableDays((prev) => {
      // If clicking the same day, remove it (toggle off)
      if (prev.includes(dayKey)) {
        return [];
      }
      // Otherwise, set only this day (only one day allowed)
      return [dayKey];
    });
  };

  const addTimeSlot = () => {
    setUnavailableTimes((prev) => [
      ...prev,
      { day: 'Sunday', from: '08:00', to: '12:00' },
    ]);
  };

  const updateTimeSlot = (index, field, value) => {
    setUnavailableTimes((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  };

  const removeTimeSlot = (index) => {
    setUnavailableTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');
      
      const response = await api.post('/trainer/unavailability', {
        unavailable_days: unavailableDays,
        unavailable_times: unavailableTimes,
        notes: notes,
      });

      if (response.data.success) {
        setSuccessMessage('تم حفظ أوقات عدم التوفر بنجاح');
        setTimeout(() => setSuccessMessage(''), 3000);
        setRestrictionInfo(null);
        // Refresh data to get updated restrictions
        fetchData();
      }
    } catch (error) {
      console.error('Error saving unavailability:', error);
      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
        if (error.response.data.error_code === 'WEEKLY_LIMIT_NOT_PASSED') {
          setRestrictionInfo({
            type: 'weekly',
            daysRemaining: error.response.data.days_remaining,
            message: error.response.data.message
          });
        }
      } else {
        setErrorMessage('حدث خطأ أثناء حفظ البيانات');
      }
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSaving(false);
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        أوقاتي
      </h1>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
          <X className="w-5 h-5" />
          {errorMessage}
        </div>
      )}

      {/* Restriction Info */}
      {restrictionInfo && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 p-4 rounded-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          <div>
            <p className="font-semibold">{restrictionInfo.message}</p>
            {restrictionInfo.daysRemaining !== undefined && (
              <p className="text-sm mt-1">
                يمكنك التعديل بعد {restrictionInfo.daysRemaining} يوم
              </p>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          الإحصائيات
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.completedLectures}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              عدد المحاضرات المكتملة
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats.completedCoursesThisMonth}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              عدد الكورسات المكتملة خلال الشهر
            </div>
          </div>
        </div>
      </div>

      {/* Unavailable Days */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-red-500" />
          يوم الإجازة الأسبوعية
        </h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold">
            ⚠️ تنبيه: يمكنك تحديد يوم الإجازة مرة واحدة فقط. بعد التحديد، لا يمكنك التعديل إلا بعد أسبوع من آخر تعديل.
          </p>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          اختر يوم إجازة واحد فقط لا يمكنك العمل به
        </p>
        <div className="flex flex-wrap gap-3">
          {weekDays.map((day) => {
            const isSelected = unavailableDays.includes(day.key);
            const isDisabled = unavailableDays.length > 0 && !isSelected;
            const isRestricted = restrictionInfo && (restrictionInfo.type === 'hourly' || restrictionInfo.type === 'weekly');
            
            return (
              <button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                disabled={isDisabled || isRestricted}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'bg-red-500 text-white shadow-lg'
                    : (isDisabled || isRestricted)
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={
                  isRestricted 
                    ? restrictionInfo.message
                    : isDisabled 
                    ? 'يمكن تحديد يوم إجازة واحد فقط' 
                    : isSelected 
                    ? 'إلغاء التحديد' 
                    : 'تحديد يوم الإجازة'
                }
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {unavailableDays.length > 0 && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-3">
            ✓ تم تحديد يوم الإجازة: {weekDays.find(d => d.key === unavailableDays[0])?.label}
          </p>
        )}
      </div>

      {/* Unavailable Time Slots */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            أوقات غير متاحة
          </h2>
          <button
            onClick={addTimeSlot}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            إضافة وقت
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          حدد أوقات معينة لا يمكنك العمل بها في أيام محددة
        </p>

        {unavailableTimes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            لا توجد أوقات غير متاحة محددة
          </div>
        ) : (
          <div className="space-y-3">
            {unavailableTimes.map((slot, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <select
                  value={slot.day}
                  onChange={(e) => updateTimeSlot(index, 'day', e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {weekDays.map((day) => (
                    <option key={day.key} value={day.key}>
                      {day.label}
                    </option>
                  ))}
                </select>
                <span className="text-gray-600 dark:text-gray-400">من</span>
                <input
                  type="time"
                  value={slot.from}
                  onChange={(e) =>
                    updateTimeSlot(index, 'from', e.target.value)
                  }
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-600 dark:text-gray-400">إلى</span>
                <input
                  type="time"
                  value={slot.to}
                  onChange={(e) => updateTimeSlot(index, 'to', e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => removeTimeSlot(index)}
                  className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          ملاحظات إضافية
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="أضف أي ملاحظات إضافية حول أوقات عدم توفرك..."
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="text-left text-sm text-gray-500 dark:text-gray-400 mt-1">
          {notes.length}/500
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              حفظ التغييرات
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default MyTimes;

