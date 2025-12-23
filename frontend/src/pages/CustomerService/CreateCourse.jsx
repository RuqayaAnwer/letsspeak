import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatTime12Hour } from '../../utils/timeFormat';
import { formatDate } from '../../utils/dateFormat';
import { ArrowRight, BookOpen, Calendar, Users, User, UserPlus, CreditCard } from 'lucide-react';

const CreateCourse = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [isDual, setIsDual] = useState(false);

  const [formData, setFormData] = useState({
    student_ids: ['', ''],
    trainer_id: '',
    course_package_id: '',
    lectures_count: '',
    start_date: '',
    lecture_time: '',
    lecture_days: [],
    renewed_with_trainer: false,
    paid_amount: '',
    remaining_amount: '',
  });

  const daysOfWeek = [
    { value: 'Sunday', label: 'الأحد' },
    { value: 'Monday', label: 'الإثنين' },
    { value: 'Tuesday', label: 'الثلاثاء' },
    { value: 'Wednesday', label: 'الأربعاء' },
    { value: 'Thursday', label: 'الخميس' },
    { value: 'Friday', label: 'الجمعة' },
    { value: 'Saturday', label: 'السبت' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [studentsRes, trainersRes, packagesRes] = await Promise.all([
        api.get('/students'),
        api.get('/trainers-list'),
        api.get('/course-packages'),
      ]);
      
      // Handle paginated response for students
      const studentsData = studentsRes.data?.data || studentsRes.data || [];
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      
      // Handle trainers response
      const trainersData = trainersRes.data?.data || trainersRes.data || [];
      setTrainers(Array.isArray(trainersData) ? trainersData : []);
      
      // Handle packages response
      const packagesData = packagesRes.data?.data || packagesRes.data || [];
      setPackages(Array.isArray(packagesData) ? packagesData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      console.error('Error response:', error.response);
      alert('حدث خطأ أثناء تحميل البيانات: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePackageChange = (packageId) => {
    const selectedPackage = packages.find((p) => p.id.toString() === packageId);
    // يتم ملء عدد المحاضرات تلقائياً من الباقة المختارة
    const lecturesCount = selectedPackage ? selectedPackage.lectures_count.toString() : '';
    const packagePrice = selectedPackage ? (selectedPackage.price || 0) : 0;
    const paidAmount = parseFloat(formData.paid_amount) || 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      course_package_id: packageId,
      lectures_count: lecturesCount,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
  };

  const handlePaidAmountChange = (value) => {
    const paidAmount = parseFloat(value) || 0;
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    const packagePrice = selectedPackage ? (selectedPackage.price || 0) : 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      paid_amount: value,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
  };

  const toggleDay = (day) => {
    const days = formData.lecture_days.includes(day)
      ? formData.lecture_days.filter((d) => d !== day)
      : [...formData.lecture_days, day];
    setFormData({ ...formData, lecture_days: days });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare student_ids based on course type
      const studentIds = isDual 
        ? formData.student_ids.filter(id => id).map(id => parseInt(id))
        : [parseInt(formData.student_ids[0])];
      
      // Convert days from 'Sunday' format to 'sun' format for backend
      const dayMap = {
        'Sunday': 'sun',
        'Monday': 'mon',
        'Tuesday': 'tue',
        'Wednesday': 'wed',
        'Thursday': 'thu',
        'Friday': 'fri',
        'Saturday': 'sat',
      };
      const lectureDays = formData.lecture_days.map(day => dayMap[day] || day);

      // Validate required fields
      if (!formData.trainer_id || !formData.course_package_id || !formData.start_date || !formData.lecture_time || lectureDays.length === 0) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        setSubmitting(false);
        return;
      }

      const data = {
        trainer_id: parseInt(formData.trainer_id),
        course_package_id: parseInt(formData.course_package_id),
        lectures_count: formData.lectures_count ? parseInt(formData.lectures_count) : undefined,
        start_date: formData.start_date,
        lecture_time: formData.lecture_time,
        lecture_days: lectureDays,
        is_dual: isDual,
        student_ids: studentIds,
        renewed_with_trainer: formData.renewed_with_trainer,
        paid_amount: formData.paid_amount ? parseFloat(formData.paid_amount) : 0,
        remaining_amount: formData.remaining_amount ? parseFloat(formData.remaining_amount) : 0,
      };

      console.log('Sending course data:', data);
      const response = await api.post('/courses', data);
      console.log('Course created successfully:', response.data);
      navigate(`/courses/${response.data.id || response.data.data?.id}`);
    } catch (error) {
      console.error('Error creating course:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      // Show detailed error message
      let errorMessage = 'حدث خطأ أثناء إنشاء الكورس';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = Object.values(error.response.data.errors).flat();
        errorMessage = errors.join('\n');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] relative z-10 mr-16 lg:mr-0"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h1 className="page-title">إنشاء كورس جديد</h1>
          <p className="page-subtitle">إعداد كورس جديد للطالب</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Course Type Selection */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            نوع الكورس
          </h2>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setIsDual(false)}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                !isDual
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-[var(--color-border)] hover:border-primary-300'
              }`}
            >
              <User className={`w-8 h-8 ${!isDual ? 'text-primary-600' : 'text-gray-400'}`} />
              <span className={`font-bold ${!isDual ? 'text-primary-700 dark:text-primary-300' : ''}`}>
                كورس فردي
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">طالب واحد</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDual(true)}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                isDual
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-[var(--color-border)] hover:border-primary-300'
              }`}
            >
              <UserPlus className={`w-8 h-8 ${isDual ? 'text-primary-600' : 'text-gray-400'}`} />
              <span className={`font-bold ${isDual ? 'text-primary-700 dark:text-primary-300' : ''}`}>
                كورس ثنائي
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">طالبان اثنان</span>
            </button>
          </div>
        </div>

        {/* Student & Trainer Selection */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            المشاركون
          </h2>
          <div className="space-y-4">
            {/* Students */}
            <div className={`grid gap-4 ${isDual ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="label">{isDual ? 'الطالب الأول *' : 'الطالب *'}</label>
                <select
                  value={formData.student_ids[0]}
                  onChange={(e) => {
                    const newIds = [...formData.student_ids];
                    newIds[0] = e.target.value;
                    setFormData({ ...formData, student_ids: newIds });
                  }}
                  className="select"
                  required
                >
                  <option value="">اختر الطالب</option>
                  {students
                    .filter(s => s.id.toString() !== formData.student_ids[1])
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} - {student.phone}
                      </option>
                    ))}
                </select>
              </div>

              {isDual && (
                <div>
                  <label className="label">الطالب الثاني *</label>
                  <select
                    value={formData.student_ids[1]}
                    onChange={(e) => {
                      const newIds = [...formData.student_ids];
                      newIds[1] = e.target.value;
                      setFormData({ ...formData, student_ids: newIds });
                    }}
                    className="select"
                    required={isDual}
                  >
                    <option value="">اختر الطالب الثاني</option>
                    {students
                      .filter(s => s.id.toString() !== formData.student_ids[0])
                      .map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} - {student.phone}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Trainer */}
            <div>
              <label className="label">المدرب *</label>
              <select
                value={formData.trainer_id}
                onChange={(e) => setFormData({ ...formData, trainer_id: e.target.value })}
                className="select"
                required
              >
                <option value="">اختر المدرب</option>
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.name || trainer.user?.name} {trainer.specialty ? `- ${trainer.specialty}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Renewal Checkbox */}
            <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <input
                type="checkbox"
                id="renewed_with_trainer"
                checked={formData.renewed_with_trainer}
                onChange={(e) => setFormData({ ...formData, renewed_with_trainer: e.target.checked })}
                className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="renewed_with_trainer" className="flex-1 cursor-pointer">
                <span className="font-semibold text-[var(--color-text-primary)] block">
                  تجديد مع نفس المدرب
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  حدد هذا الخيار إذا كان الطالب يجدد اشتراكه مع نفس المدرب (يؤهل للمكافأة)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Course Details */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-500" />
            تفاصيل الكورس
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">الباقة *</label>
                <select
                  value={formData.course_package_id}
                  onChange={(e) => handlePackageChange(e.target.value)}
                  className="select"
                  required
                >
                  <option value="">اختر الباقة</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} {pkg.lectures_count > 0 ? `- ${pkg.lectures_count} محاضرة` : '- (عدد مفتوح)'} {pkg.price > 0 ? `(${pkg.price} د.ع)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">عدد المحاضرات</label>
                <input
                  type="number"
                  min="1"
                  value={formData.lectures_count}
                  onChange={(e) => setFormData({ ...formData, lectures_count: e.target.value })}
                  className="input"
                  placeholder="يتم تحديده من الباقة"
                />
                {formData.course_package_id && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    عدد المحاضرات الافتراضي من الباقة المختارة (يمكن تعديله)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-500" />
            معلومات الدفع
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">المبلغ المدفوع (د.ع)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.paid_amount}
                  onChange={(e) => handlePaidAmountChange(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="label">المبلغ المتبقي (د.ع)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.remaining_amount}
                  className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                  placeholder="0.00"
                  readOnly
                  disabled
                />
                {formData.course_package_id && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    يتم حساب المتبقي تلقائياً من سعر الباقة
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            الجدول الزمني
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">تاريخ البدء *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">وقت المحاضرة *</label>
                <input
                  type="time"
                  value={formData.lecture_time}
                  onChange={(e) => setFormData({ ...formData, lecture_time: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">أيام الدراسة *</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {daysOfWeek.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                      formData.lecture_days.includes(day.value)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-[var(--color-border)] hover:border-primary-300'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {formData.lecture_days.length === 0 && (
                <p className="text-sm text-red-500 mt-2">يرجى اختيار يوم واحد على الأقل</p>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        {formData.lectures_count && formData.start_date && formData.lecture_days.length > 0 && (
          <div className="card p-6 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
            <h3 className="font-bold text-primary-800 dark:text-primary-300 mb-2">
              معاينة الكورس
            </h3>
            <p className="text-sm text-primary-700 dark:text-primary-400">
              سيحتوي هذا الكورس على {formData.lectures_count} محاضرة، تبدأ من{' '}
              {formatDate(formData.start_date, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {formData.lecture_time && ` في الساعة ${formatTime12Hour(formData.lecture_time)}`}، أيام:{' '}
              {formData.lecture_days.map((d) => daysOfWeek.find((day) => day.value === d)?.label).join('، ')}.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={submitting || formData.lecture_days.length === 0 || (isDual && !formData.student_ids[1])}
            className="btn-primary"
          >
            {submitting ? 'جاري الإنشاء...' : 'إنشاء الكورس'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCourse;
