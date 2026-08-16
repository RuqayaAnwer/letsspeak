import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/currencyFormat';
import { useAuth } from '../../context/AuthContext';
import { 
  User, Phone, Mail, Briefcase, DollarSign, 
  BookOpen, ChevronDown, ChevronUp, CheckCircle,
  X, RefreshCw, AlertCircle, Activity, Star,
  Calendar, Smile
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const StaffProfile = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  
  // Tabs: 'info', 'courses', 'payroll'
  const [activeTab, setActiveTab] = useState('info');
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [courseStatusFilter, setCourseStatusFilter] = useState('active');

  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://api.letspeak.online').replace('/api', '');

  // Edit form state
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (id && type) {
      fetchProfileData();
    }
  }, [id, type]);

  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/staff-profile/${type}/${id}`);
      setProfileData(response.data.data);
      if (response.data.data.profile) {
        setFormData({
            name: response.data.data.profile.name || '',
            email: response.data.data.profile.email || '',
            phone: response.data.data.profile.phone || '',
            job_title: response.data.data.profile.job_title || '',
            base_salary: response.data.data.profile.base_salary || 0,
            status: response.data.data.profile.status || 'active',
            min_level: response.data.data.profile.min_level || '',
            max_level: response.data.data.profile.max_level || '',
        });
      }
    } catch (err) {
      console.error('Error fetching staff profile:', err);
      setError('حدث خطأ أثناء تحميل بيانات الحساب');
    } finally {
      setLoading(false);
    }
  };

  const handeSubmitInfo = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
        const payload = { ...formData };
        if (type === 'trainer' && profileData.profile.id) {
            // Update via trainer endpoint
            await api.put(`/trainers/${profileData.profile.id}`, payload);
        } else if (type === 'user' && profileData.profile.id) {
            // Update via admin users endpoint
            await api.put(`/admin/users/${profileData.profile.id}`, payload);
        }
        await fetchProfileData();
        setEditMode(false);
    } catch (err) {
        console.error('Error saving profile changes:', err);
        const errMessage = err.response?.data?.message || 'فشل حفظ التعديلات';
        alert(errMessage);
    } finally {
        setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-500 font-medium">جاري تحميل الملف الشخصي...</p>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-500 font-medium">{error || 'الملف الشخصي غير موجود'}</p>
        <div className="mt-4 flex items-center justify-center gap-4">
            <button onClick={fetchProfileData} className="btn-secondary flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> إعادة المحاولة
            </button>
            <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2">
                رجوع
            </button>
        </div>
      </div>
    );
  }

  const { profile, courses, payrolls, summary } = profileData;
  const isTrainer = profile.role === 'trainer' || profile.trainer_id;

  // Determine if current admin has permission to edit
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'customer_service' || currentUser?.role === 'finance';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in py-6 px-4">
        
      {/* Header Profile Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-700 to-primary-600 relative">
            <button onClick={() => navigate(-1)} className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors">
                 <X className="w-5 h-5"/>
            </button>
        </div>
        <div className="px-6 pb-6 sm:flex sm:items-end sm:space-x-5 rtl:space-x-reverse relative -mt-12">
            <div className="h-24 w-24 rounded-2xl bg-white dark:bg-gray-800 p-1 flex items-center justify-center shadow-md border-4 border-white dark:border-gray-800 shrink-0 overflow-hidden">
                {profile.avatar ? (
                    <img 
                        src={`${apiBase}/storage/${profile.avatar}`} 
                        alt={profile.name} 
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '';
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <User className="w-10 h-10" />
                    </div>
                )}
            </div>
            <div className="mt-4 sm:flex-1 sm:min-w-0 sm:flex sm:items-center sm:justify-end sm:space-x-6 sm:pb-1 rtl:space-x-reverse">
                <div className="mt-2 min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate flex items-center gap-3">
                        {profile.name}
                        {profile.status === 'active' ? (
                            <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300 font-medium">نشط</span>
                        ) : (
                            <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full dark:bg-red-900 dark:text-red-300 font-medium">غير نشط</span>
                        )}
                    </h1>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                         <Briefcase className="w-4 h-4" /> {profile.job_title || profile.role}
                    </p>
                </div>
            </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Mail className="w-5 h-5"/></div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">البريد الإلكتروني</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate pr-2 max-w-[150px] sm:max-w-xs">{profile.email}</p>
                </div>
            </div>
            {profile.phone && (
              <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><Phone className="w-5 h-5"/></div>
                  <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">رقم الهاتف</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{profile.phone}</p>
                  </div>
              </div>
            )}
            <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg"><DollarSign className="w-5 h-5"/></div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">الراتب الثابت</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(profile.base_salary || 0)}</p>
                </div>
            </div>
            {isTrainer && (
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg"><Star className="w-5 h-5"/></div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">مستويات التدريب</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {profile.min_level && profile.max_level 
                                ? `${profile.min_level} ← ${profile.max_level}` 
                                : profile.min_level || profile.max_level || 'غير محدد'}
                        </p>
                    </div>
                </div>
            )}
        </div>
      </div>

      {isTrainer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">كورسات نشطة</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{summary.active_courses}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">كورسات منتهية</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{summary.finished_courses}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">كورسات هذا الشهر</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{summary.courses_this_month ?? 0}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">محاضرات مكتملة (إجمالي)</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{summary.completed_lectures_total ?? 0}</p>
              </div>
          </div>
          {summary.completed_kids_lectures_total > 0 && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center shrink-0">
                    <Smile className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">محاضرات الأطفال المكتملة</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{summary.completed_kids_lectures_total}</p>
                </div>
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">إجمالي المستلم (الرواتب)</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(summary.total_payroll_paid)}</p>
              </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scroller">
            <button 
                onClick={() => setActiveTab('info')}
                className={`px-6 py-4 text-sm font-bold flex-shrink-0 border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary-600 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
                المعلومات الأساسية
            </button>
            {isTrainer && (
                <button 
                    onClick={() => setActiveTab('courses')}
                    className={`px-6 py-4 text-sm font-bold flex-shrink-0 border-b-2 transition-colors ${activeTab === 'courses' ? 'border-primary-600 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    الكورسات والتدريب
                </button>
            )}
            <button 
                onClick={() => setActiveTab('payroll')}
                className={`px-6 py-4 text-sm font-bold flex-shrink-0 border-b-2 transition-colors ${activeTab === 'payroll' ? 'border-primary-600 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
                سجل الرواتب (الاستحقاقات)
            </button>
        </div>

        <div className="p-6">
            
            {/* INFO TAB */}
            {activeTab === 'info' && (
                <div className="animate-fade-in max-w-3xl">
                   <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                       <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">بيانات الحساب ومستويات التدريب</h3>
                       {canEdit && !editMode && (
                           <button onClick={() => setEditMode(true)} className="btn-secondary text-sm">تعديل البيانات</button>
                       )}
                   </div>

                   {editMode ? (
                        <form onSubmit={handeSubmitInfo} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label>
                                    <input type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required/>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">البريد الإلكتروني</label>
                                    <input type="email" className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required/>
                                </div>
                                {isTrainer && (
                                    <div>
                                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف</label>
                                        <input type="text" className="input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">المسمى الوظيفي</label>
                                    <input type="text" className="input" value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">الراتب الثابت (د.ع)</label>
                                    <input type="number" className="input" value={formData.base_salary} onChange={e => setFormData({...formData, base_salary: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">حالة الحساب</label>
                                    <select className="select w-full" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                        <option value="active">نشط</option>
                                        <option value="inactive">غير نشط / موقوف</option>
                                    </select>
                                </div>
                            </div>
                            
                            {isTrainer && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                    <h4 className="font-bold text-amber-800 dark:text-amber-500 mb-3 text-sm">مستويات التدريب المسموحة</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-amber-700 dark:text-amber-400 mb-1">من مستوى</label>
                                            <select className="select w-full" value={formData.min_level} onChange={e => setFormData({...formData, min_level: e.target.value})}>
                                                <option value="">اختر المستوى</option>
                                                <option value="L1">L1</option>
                                                <option value="L2">L2</option>
                                                <option value="L3">L3</option>
                                                <option value="L4">L4</option>
                                                <option value="L5">L5</option>
                                                <option value="L6">L6</option>
                                                <option value="L7">L7</option>
                                                <option value="L8">L8</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-amber-700 dark:text-amber-400 mb-1">إلى مستوى</label>
                                            <select className="select w-full" value={formData.max_level} onChange={e => setFormData({...formData, max_level: e.target.value})}>
                                                <option value="">اختر المستوى</option>
                                                <option value="L1">L1</option>
                                                <option value="L2">L2</option>
                                                <option value="L3">L3</option>
                                                <option value="L4">L4</option>
                                                <option value="L5">L5</option>
                                                <option value="L6">L6</option>
                                                <option value="L7">L7</option>
                                                <option value="L8">L8</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                                <button type="submit" disabled={savingSettings} className="btn-primary w-32 flex justify-center">
                                    {savingSettings ? <LoadingSpinner size="sm"/> : 'حفظ التغييرات'}
                                </button>
                                <button type="button" onClick={() => setEditMode(false)} className="btn-secondary transition-colors" disabled={savingSettings}>
                                    إلغاء
                                </button>
                            </div>
                        </form>
                   ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">الاسم الكامل</p>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{profile.name}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">البريد الإلكتروني للولوج</p>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{profile.email}</p>
                            </div>
                            {isTrainer && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">رقم الهاتف النشط</p>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200" dir="ltr">{profile.phone || 'غير محدد'}</p>
                                </div>
                            )}
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">المسمى الوظيفي والدور</p>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{profile.job_title} ({profile.role})</p>
                            </div>
                            {isTrainer && (
                                <>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg animate-fade-in">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">مستويات التدريب المسموحة</p>
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                                            {profile.min_level && profile.max_level
                                                ? `${profile.min_level} ← ${profile.max_level}`
                                                : profile.min_level || profile.max_level || 'غير محدد'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg animate-fade-in">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">الراتب الثابت</p>
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(profile.base_salary || 0)}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        {isTrainer && profile.notes && (
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg">
                                <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-500 mb-2">ملاحظات إضافية للمدرب</h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{profile.notes}</p>
                            </div>
                        )}
                    </div>
                   )}
                </div>
            )}

            {/* COURSES TAB */}
            {activeTab === 'courses' && isTrainer && (
                <div className="animate-fade-in space-y-4">
                     {/* Filter dropdown */}
                     <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                         <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">حالة الكورسات المعروضة</h3>
                         <select 
                             value={courseStatusFilter} 
                             onChange={(e) => setCourseStatusFilter(e.target.value)} 
                             className="select py-1 px-3 text-xs w-44"
                         >
                             <option value="active">الكورسات النشطة هذا الشهر</option>
                             <option value="finished">الكورسات المنتهية</option>
                             <option value="all">جميع الكورسات</option>
                         </select>
                     </div>

                     {(() => {
                         const filteredCourses = courses.filter(course => {
                             if (courseStatusFilter === 'active') return course.status === 'active';
                             if (courseStatusFilter === 'finished') return course.status === 'finished';
                             return true;
                         });

                         if (filteredCourses.length === 0) {
                             return (
                                 <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/30 rounded-xl">
                                    <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">لا توجد كورسات مطابقة للفحص.</p>
                                 </div>
                             );
                         }

                         return filteredCourses.map(course => (
                             <div key={course.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800">
                                 <div 
                                     className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                     onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                                 >
                                     <div className="flex items-center gap-3">
                                         <div className={`w-1.5 h-10 rounded-full ${course.status === 'active' ? 'bg-green-500' : course.status === 'finished' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                                         <div>
                                             <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base flex items-center gap-1.5 flex-wrap">
                                                 {course.title || 'كورس مخصص'}
                                                 {course.is_kids && <span className="bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">كورس أطفال 👶</span>}
                                             </h4>
                                             <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                 <span className="flex items-center gap-1"><User className="w-3 h-3"/> الطالب: {course.student?.name}</span>
                                                 <span>•</span>
                                                 <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3"/> بدء الكورس: {course.actual_start_date || course.start_date}</span>
                                             </div>
                                         </div>
                                     </div>
                                     <div className="flex items-center justify-between w-full sm:w-auto mt-3 sm:mt-0 gap-4">
                                         <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${course.status === 'active' ? 'bg-green-100 text-green-700' : course.status === 'finished' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                             {course.status === 'active' ? 'نشط' : course.status === 'finished' ? 'منتهي' : course.status}
                                         </span>
                                         <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                                             {expandedCourse === course.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                         </div>
                                     </div>
                                 </div>
                                 {expandedCourse === course.id && (
                                     <div className="px-4 pb-4 bg-gray-50/50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700">
                                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                                             <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                                 <p className="text-xs text-gray-500 mb-1">التقدم المنجز</p>
                                                 <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{course.completed_lectures} <span className="text-sm font-normal">من</span> {course.total_lectures}</p>
                                             </div>
                                             <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                                 <p className="text-xs text-gray-500 mb-1">نسبة الإنجاز</p>
                                                 <p className="font-bold text-lg text-primary-600">{course.progress}%</p>
                                             </div>
                                             <div className="col-span-2 lg:col-span-2 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-end">
                                                 <button onClick={() => navigate(`/shared/course/${course.id}`)} className="text-primary-600 hover:text-primary-800 text-sm font-bold flex items-center gap-1 group">
                                                     الدخول لصفحة الكورس <BookOpen className="w-4 h-4 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                             </div>
                         ));
                     })()}
                </div>
            )}

            {/* PAYROLL TAB */}
            {activeTab === 'payroll' && (
                <div className="animate-fade-in">
                    {payrolls.length === 0 ? (
                         <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/30 rounded-xl">
                            <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">لا يوجد سجل مالي أو استحقاقات مسجلة حتى الآن.</p>
                         </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {payrolls.map(pr => (
                                <div key={pr.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-3 py-1.5 rounded-lg font-bold text-sm">
                                            {pr.year} / {String(pr.month).padStart(2, '0')}
                                        </div>
                                        {pr.status === 'paid' ? (
                                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-md border border-green-200 dark:border-green-800">
                                                <CheckCircle className="w-3 h-3"/> تم الدفع
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                                                <Activity className="w-3 h-3"/> في الانتظار
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3 mt-4 text-sm max-w-full">
                                        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                                            <span>الراتب الأساسي (إداري/تخصيص)</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(pr.user?.base_salary || 0)}</span>
                                        </div>
                                        {isTrainer && (
                                            <>
                                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                                                    <span>محاضرات مسجلة ({pr.completed_lectures})</span>
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(pr.base_pay || 0)}</span>
                                                </div>
                                                {(pr.renewal_total > 0 || pr.competition_bonus > 0 || pr.selected_volume_bonus > 0 || pr.volume_bonus > 0) && (
                                                    <div className="flex justify-between items-center text-primary-600 dark:text-primary-400 mt-2">
                                                        <span>مجموع المكافآت والحوافز</span>
                                                        <span className="font-semibold">
                                                            {formatCurrency(
                                                                (pr.renewal_total || 0) + 
                                                                (pr.competition_bonus || 0) + 
                                                                (pr.selected_volume_bonus || pr.volume_bonus || 0)
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {pr.bonus_deduction !== 0 && (
                                            <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                                                <span>استقطاعات مالية</span>
                                                <span className="font-semibold">{formatCurrency(pr.bonus_deduction || 0)}</span>
                                            </div>
                                        )}
                                        <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center font-bold">
                                            <span className="text-gray-800 dark:text-white">المجموع النهائي الكلي</span>
                                            <span className="text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(pr.total_pay)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default StaffProfile;
