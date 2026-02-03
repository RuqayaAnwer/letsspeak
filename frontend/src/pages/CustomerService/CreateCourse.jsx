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
    paid_amount: '', // For single courses
    remaining_amount: '', // For single courses
    student_payments: [
      { paid_amount: '', remaining_amount: '' }, // Student 1
      { paid_amount: '', remaining_amount: '' }, // Student 2
    ],
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

  // Re-fetch packages when window gains focus (in case packages were updated in another tab/page)
  useEffect(() => {
    const handleFocus = () => {
      fetchData(true); // Skip loading state when refetching on focus
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchData = async (skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      const [studentsRes, trainersRes, packagesRes] = await Promise.all([
        api.get('/students'),
        api.get('/trainers-list'),
        api.get('/course-packages', { params: { _t: Date.now() } }), // Add timestamp to prevent caching
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
      console.log('Packages fetched in CreateCourse:', packagesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      console.error('Error response:', error.response);
      if (!skipLoading) {
        alert('حدث خطأ أثناء تحميل البيانات: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  };

  // Get package price (multiply by 1000 if less than 1000 to match display format)
  const getPackagePrice = (packagePrice) => {
    if (!packagePrice && packagePrice !== 0) return 0;
    const price = parseFloat(packagePrice);
    // If price is less than 1000, multiply by 1000 (e.g., 225 -> 225000)
    // But if price is already >= 1000, use it as is
    return price < 1000 ? price * 1000 : price;
  };

  // Calculate price per student for dual courses
  const getStudentPrice = (packageName, isDual) => {
    if (!isDual) {
      // For single courses, return 0 (will use package price)
      return 0;
    }
    
    // For dual courses, each student pays a fixed amount based on package
    if (packageName?.includes('بمزاجي') || packageName === 'بمزاجي') {
      return 90000;
    } else if (packageName?.includes('توازن') || packageName?.includes('التوازن')) {
      return 135000;
    } else if (packageName?.includes('سرعة') || packageName?.includes('السرعة')) {
      return 225000;
    }
    
    return 0;
  };

  const handlePackageChange = (packageId) => {
    const selectedPackage = packages.find((p) => p.id.toString() === packageId);
    // يتم ملء عدد المحاضرات تلقائياً من الباقة المختارة
    const lecturesCount = selectedPackage ? selectedPackage.lectures_count.toString() : '';
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPrice(selectedPackage?.name, isDual);
    let packagePrice = 0;
    if (isDual && studentPrice > 0) {
      packagePrice = studentPrice;
    } else if (selectedPackage) {
      packagePrice = getPackagePrice(selectedPackage.price);
    }
    
    if (isDual) {
      // For dual courses, update remaining amounts for both students
      const updatedStudentPayments = formData.student_payments.map((studentPayment, index) => {
        const paidAmount = parseFloat(studentPayment.paid_amount) || 0;
        const remainingAmount = packagePrice - paidAmount;
        return {
          paid_amount: studentPayment.paid_amount,
          remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
        };
      });
      
      setFormData({
        ...formData,
        course_package_id: packageId,
        lectures_count: lecturesCount,
        student_payments: updatedStudentPayments,
      });
    } else {
      // For single courses, use the old logic
      const paidAmount = parseFloat(formData.paid_amount) || 0;
      const remainingAmount = packagePrice - paidAmount;
      
      setFormData({
        ...formData,
        course_package_id: packageId,
        lectures_count: lecturesCount,
        remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
      });
    }
  };

  const handlePaidAmountChange = (value) => {
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPrice(selectedPackage?.name, isDual);
    let packagePrice = 0;
    if (isDual && studentPrice > 0) {
      packagePrice = studentPrice;
    } else if (selectedPackage) {
      packagePrice = getPackagePrice(selectedPackage.price);
    }
    
    if (isDual) {
      // This should not be called for dual courses, but handle it just in case
      setFormData({
        ...formData,
        paid_amount: value,
      });
    } else {
      // For single courses
      const paidAmount = parseFloat(value) || 0;
      const remainingAmount = packagePrice - paidAmount;
      
      setFormData({
        ...formData,
        paid_amount: value,
        remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
      });
    }
  };

  // Handle paid amount change for a specific student in dual courses
  const handleStudentPaidAmountChange = (studentIndex, value) => {
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    const studentPrice = getStudentPrice(selectedPackage?.name, true); // Always true for dual courses
    
    const paidAmount = parseFloat(value) || 0;
    const remainingAmount = studentPrice - paidAmount;
    
    const updatedStudentPayments = [...formData.student_payments];
    updatedStudentPayments[studentIndex] = {
      paid_amount: value,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    };
    
    setFormData({
      ...formData,
      student_payments: updatedStudentPayments,
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
        // For single courses, use paid_amount
        // For dual courses, we'll create payments separately for each student
        paid_amount: isDual ? 0 : (formData.paid_amount ? parseFloat(formData.paid_amount) : 0),
        remaining_amount: isDual ? 0 : (formData.remaining_amount ? parseFloat(formData.remaining_amount) : 0),
        // For dual courses, include student payments
        student_payments: isDual ? formData.student_payments : null,
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
      <div className="page-header flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] relative z-10 mr-2 sm:mr-16 lg:mr-0"
        >
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div>
          <h1 className="page-title text-lg sm:text-2xl">إنشاء كورس جديد</h1>
          <p className="page-subtitle text-xs sm:text-sm">إعداد كورس جديد للطالب</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Course Type Selection */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mb-3 sm:mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500" />
            نوع الكورس
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
            <div className={`grid gap-3 sm:gap-4 ${isDual ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
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

          </div>
        </div>

        {/* Course Details */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-500" />
            تفاصيل الكورس
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            {isDual ? (
              // Dual course: Show payment info for each student
              <div className="space-y-6">
                {formData.student_ids.map((studentId, index) => {
                  const student = students.find(s => s.id.toString() === studentId);
                  const studentPayment = formData.student_payments[index] || { paid_amount: '', remaining_amount: '' };
                  
                  return (
                    <div key={index} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
                        {student ? `${student.name} - ${student.phone}` : `الطالب ${index + 1}`}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="label" htmlFor={`student-${index}-paid-amount`}>المبلغ المدفوع (د.ع)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={studentPayment.paid_amount}
                            onChange={(e) => handleStudentPaidAmountChange(index, e.target.value)}
                            className="input"
                            placeholder="0.00"
                            id={`student-${index}-paid-amount`}
                            name={`student-${index}-paid-amount`}
                          />
                        </div>

                        <div>
                          <label className="label" htmlFor={`student-${index}-remaining-amount`}>المبلغ المتبقي (د.ع)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={studentPayment.remaining_amount}
                            className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                            placeholder="0.00"
                            readOnly
                            disabled
                            id={`student-${index}-remaining-amount`}
                            name={`student-${index}-remaining-amount`}
                          />
                          {formData.course_package_id && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              يتم حساب المتبقي تلقائياً حسب الباقة
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Single course: Show single payment info
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="label" htmlFor="paid-amount">المبلغ المدفوع (د.ع)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.paid_amount}
                    onChange={(e) => handlePaidAmountChange(e.target.value)}
                    className="input"
                    placeholder="0.00"
                    id="paid-amount"
                    name="paid-amount"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="remaining-amount">المبلغ المتبقي (د.ع)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.remaining_amount}
                    className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                    placeholder="0.00"
                    readOnly
                    disabled
                    id="remaining-amount"
                    name="remaining-amount"
                  />
                  {formData.course_package_id && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      يتم حساب المتبقي تلقائياً من سعر الباقة
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            الجدول الزمني
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
