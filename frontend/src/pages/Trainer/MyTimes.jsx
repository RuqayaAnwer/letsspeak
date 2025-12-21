import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Clock, Calendar, Save, X, Plus, Trash2, CheckCircle } from 'lucide-react';

const MyTimes = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [unavailableTimes, setUnavailableTimes] = useState([]);
  const [notes, setNotes] = useState('');
  const [workingHours, setWorkingHours] = useState({
    completed: 0,
    thisMonth: 0,
    total: 0,
  });
  const [successMessage, setSuccessMessage] = useState('');

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
      }

      if (dashboardRes.data.success) {
        const courses = dashboardRes.data.data.courses || [];
        let completedHours = 0;
        let thisMonthHours = 0;
        let totalHours = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        courses.forEach((course) => {
          (course.lectures || []).forEach((lecture) => {
            totalHours += 2;
            if (lecture.is_completed) {
              completedHours += 2;
            }
            const lectureDate = new Date(lecture.date);
            if (
              lectureDate.getMonth() === currentMonth &&
              lectureDate.getFullYear() === currentYear &&
              lecture.is_completed
            ) {
              thisMonthHours += 2;
            }
          });
        });

        setWorkingHours({
          completed: completedHours,
          thisMonth: thisMonthHours,
          total: totalHours,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayKey) => {
    setUnavailableDays((prev) =>
      prev.includes(dayKey)
        ? prev.filter((d) => d !== dayKey)
        : [...prev, dayKey]
    );
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
      const response = await api.post('/trainer/unavailability', {
        unavailable_days: unavailableDays,
        unavailable_times: unavailableTimes,
        notes: notes,
      });

      if (response.data.success) {
        setSuccessMessage('تم حفظ أوقات عدم التوفر بنجاح');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving unavailability:', error);
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

      {/* Working Hours Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          ساعات العمل
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {workingHours.completed}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              ساعات مكتملة
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {workingHours.thisMonth}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              ساعات هذا الشهر
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {workingHours.total}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              إجمالي الساعات
            </div>
          </div>
        </div>
      </div>

      {/* Unavailable Days */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-red-500" />
          أيام الإجازة الأسبوعية
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          اختر الأيام التي لا يمكنك العمل بها
        </p>
        <div className="flex flex-wrap gap-3">
          {weekDays.map((day) => (
            <button
              key={day.key}
              onClick={() => toggleDay(day.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                unavailableDays.includes(day.key)
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
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

