import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  X, User, Phone, GraduationCap, Calendar, 
  BookOpen, Clock, Activity, CheckCircle, 
  AlertCircle, CreditCard, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const StudentProfileModal = ({ isOpen, onClose, studentId }) => {
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchProfileData();
    }
  }, [isOpen, studentId]);

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-[101] animate-scale-up border border-gray-200 dark:border-gray-700 overflow-hidden">
        
        {/* Header */}
        <div className="flex bg-gradient-to-r from-primary-600 to-primary-800 p-4 sm:p-6 text-white justify-between items-start shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                {profileData?.student?.name || 'جاري التحميل...'}
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
                    <GraduationCap className="w-4 h-4" /> {profileData.student.level}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-black/10 hover:bg-black/20 rounded-xl transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">عدد الكورسات</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{profileData.stats.total_courses}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">إجمالي المدفوعات</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {(profileData.financials.total_paid).toLocaleString()} <span className="text-xs font-normal">د.ع</span>
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
                      {(profileData.financials.total_remaining).toLocaleString()} <span className="text-xs font-normal text-rose-500">د.ع</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Course History Timeline */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                  <Clock className="w-5 h-5 text-primary-500" />
                  سجل الكورسات والتاريخ
                </h3>
                
                {profileData.courses_history.length === 0 ? (
                  <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500">لا يوجد سجل كورسات لهذا الطالب حتى الآن.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profileData.courses_history.map((course) => (
                      <div 
                        key={course.id} 
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md"
                      >
                        <div 
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer focus:bg-gray-50 dark:focus:bg-gray-700/50"
                          onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-10 rounded-full ${course.status === 'active' ? 'bg-green-500' : course.status === 'finished' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                            <div>
                              <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base">
                                {course.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span className="flex items-center gap-1"><User className="w-3 h-3"/> المدرب: {course.trainer}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {course.start_date || 'غير محدد'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3 sm:mt-0 px-5 sm:px-0">
                            <span className={`text-xs px-2 py-1 rounded-md font-semibold ${course.status === 'active' ? 'bg-green-100 text-green-700' : course.status === 'finished' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                              {course.status === 'active' ? 'نشط' : course.status === 'finished' ? 'منتهي' : 'مكتمل'}
                            </span>
                            {expandedCourse === course.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </div>
                        </div>

                        {/* Expandable Details */}
                        {expandedCourse === course.id && (
                          <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 animate-fade-in text-sm">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                <span className="text-xs text-gray-500 block mb-1">التقدم في المحاضرات</span>
                                <span className="font-bold text-gray-700 dark:text-gray-300">{course.completed_lectures} / {course.total_lectures}</span>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                <span className="text-xs text-gray-500 block mb-1">نسبة الحضور</span>
                                <span className="font-bold text-primary-600">{course.attendance_rate}%</span>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                <span className="text-xs text-gray-500 block mb-1">المدفوع لهذا الكورس</span>
                                <span className="font-bold text-emerald-600">{(course.paid_amount).toLocaleString()}</span>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                <span className="text-xs text-gray-500 block mb-1">المتبقي (ديون)</span>
                                <span className="font-bold text-rose-600">{(course.remaining_amount).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0 flex justify-end">
          <button onClick={onClose} className="btn-primary px-8">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileModal;
