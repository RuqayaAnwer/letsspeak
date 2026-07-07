import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { formatCurrency, formatCurrencyAmount } from '../../utils/currencyFormat';
import { useAuth } from '../../context/AuthContext';
import { 
  X, User, Phone, GraduationCap, Calendar, 
  BookOpen, Clock, Activity, CheckCircle, 
  AlertCircle, CreditCard, ChevronDown, ChevronUp, RefreshCw, FileText, Plus, Trash2,
  Sparkles, Target, Brain, MessageSquare
} from 'lucide-react';
import Modal from '../../components/Modal';
import StudentAssessmentModal from '../../components/StudentAssessmentModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useParams, useNavigate, Link } from 'react-router-dom';

const StudentProfile = () => {
  const { id: studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    courseId: null,
    amount: '',
    maxAmount: 0,
    date: new Date().toISOString().split('T')[0],
    payment_method: 'zain_cash',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Assessment Modal State
  const [assessmentModal, setAssessmentModal] = useState({ open: false, studentId: null, studentName: '' });

  // Generate timeline events
  const getTimelineEvents = () => {
    if (!profileData) return [];
    
    let events = [];
    
    // Add courses
    if (profileData.courses_history) {
      profileData.courses_history.forEach(course => {
        events.push({
          id: 'course_' + course.id,
          type: 'course',
          date: course.start_date || '2000-01-01',
          data: course
        });
      });
    }
    
    // Add payments
    if (profileData.all_payments && user?.role !== 'trainer') {
      profileData.all_payments.forEach(payment => {
        const relatedCourse = profileData.courses_history?.find(c => c.id === payment.course_id);
        events.push({
          id: 'payment_' + payment.id,
          type: 'payment',
          date: payment.date || '2000-01-01',
          data: { ...payment, course_title: relatedCourse?.title || 'غير محدد' }
        });
      });
    }
    
    // Add notes
    if (profileData.notes) {
      profileData.notes.forEach(note => {
        events.push({
          id: 'note_' + note.id,
          type: 'note',
          date: note.created_at.split(' ')[0], // Date for sorting
          full_date: note.created_at,
          data: note
        });
      });
    }
    
    // Sort descending by date
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const timelineEvents = getTimelineEvents();

  useEffect(() => {
    if (studentId) {
      fetchProfileData();
    }
  }, [studentId]);

  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/students/${studentId}/profile`);
      setProfileData(response.data);
    } catch (err) {
      console.error('Error fetching student profile:', err);
      setError('حدث خطأ أثناء تحميل بيانات الطالب');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentModal.amount || paymentModal.amount <= 0) return;
    
    setSubmittingPayment(true);
    try {
      // Normalize amount to ensure it is handled correctly
      const amountValue = typeof paymentModal.amount === 'string' 
        ? parseFloat(paymentModal.amount.replace(/,/g, '')) 
        : parseFloat(paymentModal.amount);

      await api.post('/payments', {
        student_id: studentId,
        course_id: paymentModal.courseId,
        amount: amountValue,
        status: 'completed',
        payment_date: paymentModal.date,
        payment_method: paymentModal.payment_method
      });
      // Refresh profile data
      await fetchProfileData();
      setPaymentModal({ ...paymentModal, open: false });
      alert('تم تسجيل الدفعة بنجاح!');
    } catch (err) {
      console.error('Error submitting payment:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'حدث خطأ غير معروف';
      
      let validationErrors = '';
      if (err.response?.data?.errors) {
         validationErrors = '\\n' + Object.values(err.response.data.errors).flat().join('\\n');
      }
      
      alert('فشل تسجيل الدفعة:\\n' + errorMsg + validationErrors);
    } finally {
      setSubmittingPayment(false);
    }
  };



  // Render Activity Ring
  const renderProgressCircle = (percentage, colorClass, label, icon) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="relative w-24 h-24 mb-2">
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-gray-200 dark:text-gray-700"
            />
            {/* Progress Circle */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`transition-all duration-1000 ease-out ${colorClass}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {icon}
            <span className="text-sm font-bold mt-1 text-gray-800 dark:text-gray-200">{percentage}%</span>
          </div>
        </div>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">{label}</span>
      </div>
    );
  };

  const getPaymentMethodBadge = (method) => {
    if (!method) return null;
    switch (method.toLowerCase()) {
      case 'zain_cash': return <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] px-2 py-0.5 rounded font-semibold ml-2 inline-block">زين كاش</span>;
      case 'qi_card':
      case 'q_card': return <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded font-semibold ml-2 inline-block">بطاقة كي</span>;
      case 'delivery': return <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-[10px] px-2 py-0.5 rounded font-semibold ml-2 inline-block">توصيل</span>;
      case 'cash': return <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded font-semibold ml-2 inline-block">نقدي</span>;
      default: return <span className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded ml-2 inline-block font-semibold">{method}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in py-6 px-4">
      
      {/* Page Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col relative border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className={`flex p-4 sm:p-6 text-white justify-between items-start shrink-0 bg-gradient-to-r ${profileData?.student?.is_child ? 'from-pink-500 via-purple-500 to-indigo-500' : 'from-primary-600 to-primary-800'}`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                {profileData?.student?.name || 'جاري التحميل...'}
                {profileData?.student?.is_child && (
                  <span className="bg-pink-100 text-pink-800 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
                    👶 طفل
                  </span>
                )}
                {!loading && profileData?.stats?.commitment_score >= 80 && (
                  <span className="bg-amber-400 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm" title="طالب متميز (تقييم التزام مرتفع)">
                    🌟 متميز
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-primary-100">
                {profileData?.student?.phone && (
                  <span className="flex items-center gap-1.5 bg-black/10 px-2 py-1 rounded-md">
                    <Phone className="w-4 h-4" /> {profileData.student.phone}
                  </span>
                )}
                {profileData?.student?.level && (
                  <span className="flex items-center gap-1.5 bg-black/10 px-2 py-1 rounded-md">
                    <GraduationCap className="w-4 h-4" /> {
                      {
                        L1: 'المستوى 1',
                        L2: 'المستوى 2',
                        L3: 'المستوى 3',
                        L_PREP: 'المستوى التمهيدي',
                        L4: 'المستوى 4',
                        L5: 'المستوى 5',
                        L6: 'المستوى 6',
                        L7: 'المستوى 7',
                        L8: 'المستوى 8',
                      }[profileData.student.level] || profileData.student.level
                    }
                  </span>
                )}
                {profileData?.student?.lead?.telegram_id && (
                  <span className="flex items-center gap-1.5 bg-black/10 px-2 py-1 rounded-md">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2L2 11.5L8.5 14L11.5 22L15 16L21.5 2Z"/><path d="M21.5 2L8.5 14"/></svg> {profileData.student.lead.telegram_id}
                  </span>
                )}
                {profileData?.student?.lead?.governorate && (
                  <span className="flex items-center gap-1.5 bg-black/10 px-2 py-1 rounded-md">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> {profileData.student.lead.governorate}
                  </span>
                )}
                {(profileData?.student?.age || profileData?.student?.lead?.age) && (
                  <span className="flex items-center gap-1.5 bg-black/10 px-2 py-1 rounded-md">
                    <User className="w-4 h-4" /> {profileData.student.age || profileData.student.lead.age} سنة
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAssessmentModal({ open: true, studentId, studentName: profileData?.student?.name })}
              className="flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-lg text-xs sm:text-sm font-bold shadow-sm transition-colors ring-2 ring-yellow-400/30 whitespace-nowrap"
            >
              <Brain className="w-3 h-3 sm:w-4 sm:h-4" /> 
              <span className="hidden sm:inline">السجل التقييمي</span>
              <span className="sm:hidden">تقييم</span>
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="p-2 sm:p-2 bg-black/10 hover:bg-black/20 rounded-xl transition-colors backdrop-blur-sm shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-500 font-medium">جاري إعداد السجل الشامل للطالب...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-500 font-medium">{error}</p>
              <button onClick={fetchProfileData} className="mt-4 btn-secondary flex items-center gap-2 mx-auto">
                <RefreshCw className="w-4 h-4" /> إعادة المحاولة
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Analytics Section */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                  <Activity className="w-5 h-5 text-primary-500" />
                  مؤشرات الالتزام العام
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {renderProgressCircle(
                    profileData.stats.commitment_score, 
                    profileData.stats.commitment_score >= 70 ? 'text-green-500' : profileData.stats.commitment_score >= 40 ? 'text-amber-500' : 'text-red-500',
                    'تقييم الالتزام (إجمالي)',
                    <Activity className={`w-5 h-5 ${profileData.stats.commitment_score >= 70 ? 'text-green-500' : 'text-amber-500'}`} />
                  )}
                  {renderProgressCircle(
                    profileData.stats.attendance_rate, 
                    'text-blue-500', 
                    'نسبة الحضور',
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  )}
                  {renderProgressCircle(
                    profileData.stats.homework_rate, 
                    'text-purple-500', 
                    'إنجاز الواجبات',
                    <BookOpen className="w-5 h-5 text-purple-500" />
                  )}
                  {renderProgressCircle(
                    profileData.stats.engagement_rate, 
                    'text-orange-500', 
                    'مدى التفاعل',
                    <User className="w-5 h-5 text-orange-500" />
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <div className={`grid gap-4 ${user?.role !== 'trainer' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">عدد الكورسات</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{profileData.stats.total_courses}</p>
                  </div>
                </div>

                {user?.role !== 'trainer' && (
                  <>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">إجمالي المدفوعات</p>
                        <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                          {formatCurrency(profileData.financials.total_paid)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">إجمالي الديون (المتبقي)</p>
                        <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(profileData.financials.total_remaining)}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Unified Timeline Feed */}
              <div>
                <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary-500" />
                    السجل الزمني للأحداث
                  </h3>
                  <button 
                    onClick={() => setAssessmentModal({ open: true, studentId, studentName: profileData?.student?.name })}
                    className="text-xs flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 px-2.5 py-1.5 rounded-md font-semibold transition-colors"
                  >
                    <Plus className="w-3 h-3" /> تدوين تقييم جديد
                  </button>
                </div>
                
                {timelineEvents.length === 0 ? (
                  <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500">لا يوجد سجل أحداث لهذا الطالب حتى الآن.</p>
                  </div>
                ) : (
                  <div className="relative border-r-2 border-gray-100 dark:border-gray-700 space-y-6 pr-6 mr-3">
                    {timelineEvents.map((event) => {
                      
                      // NOTE ITEM
                      if (event.type === 'note') {
                        const noteType = event.data.type || 'general';
                        const typeConfig = {
                          general: { bg: 'yellow', icon: MessageSquare, label: 'ملاحظة عامة' },
                          strength: { bg: 'green', icon: Sparkles, label: 'نقطة قوة' },
                          weakness: { bg: 'orange', icon: Target, label: 'مجال تحسين' },
                          interest: { bg: 'blue', icon: Brain, label: 'اهتمام' }
                        }[noteType];
                        const NoteIcon = typeConfig.icon;

                        return (
                          <div key={event.id} className="relative group">
                            <div className={`absolute -right-9 mt-1.5 w-6 h-6 rounded-full bg-${typeConfig.bg}-100 dark:bg-${typeConfig.bg}-900 border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm`}>
                              <NoteIcon className={`w-3 h-3 text-${typeConfig.bg}-600 dark:text-${typeConfig.bg}-400`} />
                            </div>
                            <div className={`bg-gradient-to-l from-${typeConfig.bg}-50/50 to-white dark:from-${typeConfig.bg}-900/20 dark:to-gray-800 rounded-xl p-4 border border-${typeConfig.bg}-100 dark:border-${typeConfig.bg}-900/50 relative shadow-sm hover:shadow-md transition-all`}>
                              <div className="flex justify-between items-start mb-2">
                                <h5 className={`text-sm font-bold text-${typeConfig.bg}-800 dark:text-${typeConfig.bg}-400 flex items-center gap-1.5`}>
                                  <NoteIcon className="w-4 h-4"/> {typeConfig.label}
                                </h5>
                              </div>
                              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{event.data.text}</p>
                              <div className={`mt-3 pt-3 border-t border-${typeConfig.bg}-100/50 dark:border-${typeConfig.bg}-900/30 flex items-center gap-3 text-xs text-${typeConfig.bg}-700 dark:text-${typeConfig.bg}-500/80 font-medium opacity-80 group-hover:opacity-100 transition-opacity`}>
                                <span className="flex items-center gap-1"><User className="w-3 h-3" /> بواسطة: {event.data.user}</span>
                                <span className={`w-1 h-1 rounded-full bg-${typeConfig.bg}-300`}></span>
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {event.full_date || event.date}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // PAYMENT ITEM
                      if (event.type === 'payment') {
                        return (
                          <div key={event.id} className="relative group">
                            <div className="absolute -right-9 mt-1.5 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm">
                              <CreditCard className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all shadow-sm hover:shadow-md">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                                    تسديد دفعة مالية
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-xs border border-emerald-100 dark:border-emerald-800">
                                      {formatCurrency(event.data.amount)}
                                    </span>
                                  </h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1"><BookOpen className="w-3 h-3"/> كورس: {event.data.course_title}</p>
                                </div>
                                <div className="text-right flex items-center sm:block gap-2 mt-2 sm:mt-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                  {getPaymentMethodBadge(event.data.payment_method)}
                                  <div className="text-xs text-gray-500 dark:text-gray-400 sm:mt-2 flex items-center gap-1 justify-end font-medium">
                                    <Calendar className="w-3 h-3" /> {event.date}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // COURSE ITEM
                      const course = event.data;
                      return (
                        <div key={event.id} className="relative group">
                          <div className="absolute -right-9 mt-1.5 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm">
                            <BookOpen className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800">
                            <div 
                              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                              onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-1.5 h-10 rounded-full ${course.status === 'active' ? 'bg-green-500' : course.status === 'finished' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                                <div>
                                  <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base flex items-center">
                                    {course.title} {getPaymentMethodBadge(course.payment_method)}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 opacity-80 group-hover:opacity-100">
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3"/> المدرب:{' '}
                                      {course.trainer_id ? (
                                        <Link to={`/staff-profile/trainer/${course.trainer_id}`} className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors font-semibold" onClick={(e) => e.stopPropagation()}>
                                          {course.trainer}
                                        </Link>
                                      ) : (
                                        course.trainer
                                      )}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> تسجيل: {course.start_date || 'غير محدد'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 mt-3 sm:mt-0 px-5 sm:px-0">
                                <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${course.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : course.status === 'finished' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                  {course.status === 'active' ? 'نشط' : course.status === 'finished' ? 'منتهي' : 'مكتمل'}
                                </span>
                                <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                                  {expandedCourse === course.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                </div>
                              </div>
                            </div>

                            {expandedCourse === course.id && (
                              <div className="px-4 pb-4 pt-2 bg-gray-50/50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 animate-fade-in text-sm">
                                <div className={`grid gap-3 mt-2 ${user?.role !== 'trainer' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
                                  <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">التقدم في المحاضرات</span>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">{course.completed_lectures} / {course.lectures_count}</span>
                                  </div>
                                  <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">نسبة الحضور</span>
                                    <span className="font-bold text-primary-600 dark:text-primary-400">{course.attendance_rate}%</span>
                                  </div>
                                  {user?.role !== 'trainer' && (
                                    <>
                                      <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">المدفوع الكلي</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrencyAmount(course.paid_amount || 0)}</span>
                                      </div>
                                      <div className="bg-rose-50 dark:bg-rose-900/10 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/30 flex flex-col justify-between shadow-sm">
                                        <div>
                                          <span className="text-xs text-rose-500 block mb-1">المتبقي للكره (ديون)</span>
                                          <span className="font-bold text-rose-600">{formatCurrencyAmount(course.remaining_amount || 0)}</span>
                                        </div>
                                        {course.remaining_amount > 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPaymentModal({
                                                open: true,
                                                courseId: course.id,
                                                amount: course.remaining_amount,
                                                maxAmount: course.remaining_amount,
                                                date: new Date().toISOString().split('T')[0],
                                                payment_method: course.payment_method || 'zain_cash'
                                              });
                                            }}
                                            className="mt-2 text-[10px] sm:text-xs bg-rose-600 text-white px-2 py-1.5 rounded-md hover:bg-rose-700 transition-colors w-full flex items-center justify-center gap-1 font-bold shadow-sm"
                                          >
                                            <CreditCard className="w-3.5 h-3.5" /> تسديد القسط
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModal.open}
        onClose={() => !submittingPayment && setPaymentModal({ ...paymentModal, open: false })}
        title="تسديد دفعة متبقية"
        size="sm"
        zIndex="z-[200]"
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              المبلغ (د.ع)
            </label>
            <input
              type="number"
              value={paymentModal.amount}
              onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
              className="w-full relative z-[100] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-left dark:bg-gray-700 dark:text-white"
              dir="ltr"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              تاريخ الدفع
            </label>
            <input
              type="date"
              value={paymentModal.date}
              onChange={(e) => setPaymentModal({ ...paymentModal, date: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              طريقة الدفع
            </label>
            <select
              value={paymentModal.payment_method}
              onChange={(e) => setPaymentModal({ ...paymentModal, payment_method: e.target.value })}
              className="input-field"
              required
            >
              <option value="zain_cash">زين كاش</option>
              <option value="qi_card">بطاقة كي</option>
              <option value="delivery">توصيل</option>
            </select>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={submittingPayment}
              className="btn-primary flex-1 flex justify-center items-center"
            >
              {submittingPayment ? <LoadingSpinner size="sm" /> : 'تأكيد ودفع'}
            </button>
            <button
              type="button"
              onClick={() => setPaymentModal({ ...paymentModal, open: false })}
              disabled={submittingPayment}
              className="btn-secondary flex-1"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Assessment Modal Component */}
      <StudentAssessmentModal 
        isOpen={assessmentModal.open}
        onClose={() => {
          setAssessmentModal({ open: false, studentId: null, studentName: '' });
          fetchProfileData(); // Refresh to show new notes in timeline
        }}
        studentId={assessmentModal.studentId}
        studentName={assessmentModal.studentName}
      />

    </div>
  );
};

export default StudentProfile;
