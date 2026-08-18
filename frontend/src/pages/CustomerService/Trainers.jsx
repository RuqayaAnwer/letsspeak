import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, Trash2, GraduationCap, Phone, Filter, MessageSquare, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Trainers = () => {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [weeklyFilter, setWeeklyFilter] = useState('');
  const [notesPopup, setNotesPopup] = useState({ open: false, notes: '', trainerName: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    min_level: '',
    max_level: '',
    notes: '',
    password: '',
    status: 'active',
  });
  const [newTrainerCredentials, setNewTrainerCredentials] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTrainers, setTotalTrainers] = useState(0);

  const formatDays = (days) => {
    if (!days || (Array.isArray(days) && days.length === 0)) return '-';
    
    let daysArray = days;
    if (typeof days === 'string') {
      try {
        daysArray = JSON.parse(days);
      } catch (e) {
        daysArray = days.split(',').map(d => d.trim());
      }
    }
    
    if (!Array.isArray(daysArray)) return String(days);

    const daysMap = {
      'sun': 'أحد',
      'mon': 'اثنين',
      'tue': 'ثلاثاء',
      'wed': 'أربعاء',
      'thu': 'خميس',
      'fri': 'جمعة',
      'sat': 'سبت',
      'sunday': 'أحد',
      'monday': 'اثنين',
      'tuesday': 'ثلاثاء',
      'wednesday': 'أربعاء',
      'thursday': 'خميس',
      'friday': 'جمعة',
      'saturday': 'سبت',
      'الأحد': 'أحد',
      'الاثنين': 'اثنين',
      'الثلاثاء': 'ثلاثاء',
      'الأربعاء': 'أربعاء',
      'الخميس': 'خميس',
      'الجمعة': 'جمعة',
      'السبت': 'سبت'
    };
    
    const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    
    const mappedDays = daysArray
      .map(d => {
        const key = String(d).trim().toLowerCase();
        return daysMap[key] || d;
      })
      .filter(Boolean);
      
    return mappedDays.join('، ');
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    try {
      const parts = timeString.split(':');
      if (parts.length >= 2) {
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'م' : 'ص';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 becomes 12
        return `${hours}:${minutes} ${ampm}`;
      }
      return timeString;
    } catch (e) {
      return timeString;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Fetch trainers function passing the page parameter to the API
  const fetchTrainers = async (showLoading = true, pageToFetch = page) => {
    if (showLoading) setLoading(true);
    try {
      const params = { page: pageToFetch };
      if (search) params.search = search;
      if (weeklyFilter) params.weekly_lectures = weeklyFilter;
      
      const response = await api.get('/trainers', { params });
      
      // Handle paginated response - API returns { data: [...], current_page, last_page, total }
      const trainersData = response.data?.data || response.data || [];
      
      if (!Array.isArray(trainersData)) {
        console.error('Invalid trainers data format:', trainersData);
        setTrainers([]);
        setTotalPages(1);
        setTotalTrainers(0);
      } else {
        setTrainers(trainersData);
        setTotalPages(response.data?.last_page || 1);
        setTotalTrainers(response.data?.total || trainersData.length);
      }
    } catch (error) {
      console.error('Error fetching trainers:', error);
      if (import.meta.env.DEV) {
        const { sampleTrainers } = await import('../../data/sampleDashboardData');
        setTrainers(sampleTrainers);
        setTotalPages(1);
        setTotalTrainers(sampleTrainers.length);
      } else {
        setTrainers([]);
        setTotalPages(1);
        setTotalTrainers(0);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch whenever page, search, or weeklyFilter changes with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTrainers(false, page);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, weeklyFilter, page]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, weeklyFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingTrainer) {
        const payload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          min_level: formData.min_level,
          max_level: formData.max_level,
          notes: formData.notes,
          status: formData.status,
        };
        if (formData.password) payload.password = formData.password;
        await api.put(`/trainers/${editingTrainer.id}`, payload);
        fetchTrainers(false, page);
        closeModal();
      } else {
        const res = await api.post('/trainers', formData);
        fetchTrainers(false, page);
        closeModal();
        // Show login credentials to the user creating the trainer
        const data = res.data;
        setNewTrainerCredentials({
          name:     data.trainer?.name  || formData.name,
          email:    data.login_email    || data.trainer?.email || formData.email,
          password: data.login_password || formData.password,
        });
      }
    } catch (error) {
      console.error('Error saving trainer:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المدرب؟')) return;

    try {
      await api.delete(`/trainers/${id}`);
      fetchTrainers(false, page);
    } catch (error) {
      console.error('Error deleting trainer:', error);
    }
  };

  const openModal = (trainer = null) => {
    if (trainer) {
      setEditingTrainer(trainer);
      setFormData({
        name: trainer.user?.name || trainer.name || '',
        email: trainer.user?.email || trainer.email || '',
        phone: trainer.phone || '',
        min_level: trainer.min_level || '',
        max_level: trainer.max_level || '',
        notes: trainer.notes || '',
        status: trainer.status || 'active',
      });
    } else {
      setEditingTrainer(null);
      setFormData({ name: '', email: '', phone: '', min_level: '', max_level: '', notes: '', password: '', status: 'active' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTrainer(null);
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  const maxActiveCourses = trainers.length > 0 ? Math.max(...trainers.map(t => (t.courses || []).length), 5) : 5;
  const courseColumns = Array.from({ length: maxActiveCourses }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">إدارة المدربين</h1>
          <p className="page-subtitle">عرض وإدارة حسابات المدربين</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          إضافة مدرب
        </button>
      </div>

      {/* Search & Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="البحث بالاسم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pr-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-[var(--color-text-muted)]" />
            <select
              value={weeklyFilter}
              onChange={(e) => setWeeklyFilter(e.target.value)}
              className="select w-48"
            >
              <option value="">كل المدربين</option>
              <option value="less_than_3">أقل من 3 محاضرات</option>
              <option value="more_than_3">أكثر من 3 محاضرات</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trainers Table */}
      {trainers.length === 0 ? (
        <EmptyState
          title="لا يوجد مدربين"
          description="قم بإضافة أول مدرب للبدء"
          icon={GraduationCap}
          action={
            <button onClick={() => openModal()} className="btn-primary">
              إضافة مدرب
            </button>
          }
        />
      ) : (
        <div className="card">
          {/* Mobile Cards View */}
          <div className="md:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
              {trainers.map((trainer, index) => {
                const displayIndex = (page - 1) * 15 + index + 1;
                const trainerCourses = trainer.courses || [];
                return (
                  <div
                    key={trainer.id}
                    onClick={() => openModal(trainer)}
                    className="p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all active:scale-[0.98]"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">اسم المدرب</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1">{displayIndex}</span>
                          <Link to={`/staff-profile/trainer/${trainer.id}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                            {trainer.user?.name || trainer.name}
                          </Link>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">رقم الهاتف</span>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span dir="ltr" className="text-sm text-gray-800 dark:text-white">{trainer.phone || '-'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">البريد الإلكتروني</span>
                        <span dir="ltr" className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[60%]">{trainer.user?.email || trainer.email || '-'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">المستوى</span>
                        <span className="text-xs text-gray-800 dark:text-white font-medium">
                          {trainer.min_level && trainer.max_level
                            ? `${trainer.min_level} - ${trainer.max_level}`
                            : trainer.min_level || trainer.max_level || '-'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الكورسات النشطة</span>
                        <span className="badge badge-info text-xs px-1.5 py-0.5">
                          {trainer.active_courses_count ?? trainerCourses.length}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">محاضرات الأسبوع</span>
                        <span className={`badge text-xs px-1.5 py-0.5 ${
                          trainer.weekly_lectures_count >= 3
                            ? 'badge-success'
                            : trainer.weekly_lectures_count > 0
                              ? 'badge-warning'
                              : 'badge-gray'
                        }`}>
                          {trainer.weekly_lectures_count || 0}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الحالة</span>
                        <span className={`badge text-xs px-1.5 py-0.5 ${
                          trainer.status === 'active'
                            ? 'badge-success'
                            : 'badge-gray'
                        }`}>
                          {trainer.status === 'active' ? 'نشط' : 'غير نشط'}
                        </span>
                      </div>

                      {trainer.notes && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">ملاحظات</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotesPopup({
                                open: true,
                                notes: trainer.notes,
                                trainerName: trainer.user?.name || trainer.name || 'المدرب'
                              });
                            }}
                            className="p-1 rounded-lg text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors"
                            title={trainer.notes}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Active Courses List on Mobile */}
                      {trainerCourses.length > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1.5">الكورسات النشطة ({trainerCourses.length}):</span>
                          <div className="space-y-1.5">
                            {trainerCourses.map((course) => (
                              <div key={course.id} className="p-1.5 bg-blue-50/40 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/40 rounded text-[11px] flex justify-between items-center">
                                <div className="font-semibold text-blue-600 dark:text-blue-400">
                                  {course.is_dual && course.students && course.students.length > 0 ? (
                                    course.students.map((s, idx) => (
                                      <span key={s.id}>
                                        {idx > 0 && ' و '}
                                        <Link to={`/students/${s.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{s.name}</Link>
                                      </span>
                                    ))
                                  ) : (
                                    <Link to={`/students/${course.students?.[0]?.id || course.student_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                      {course.students?.[0]?.name || course.student_name || '-'}
                                    </Link>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {formatDays(course.lecture_days)} | {formatTime(course.lecture_time)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="table text-xs w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700/50">
                  <th className="py-2 px-2 text-center text-xs font-bold w-12 border border-gray-200 dark:border-gray-700">#</th>
                  <th className="py-2 px-2 text-center text-xs font-bold border border-gray-200 dark:border-gray-700 min-w-[120px]">اسم المدرب</th>
                  <th className="py-2 px-2 text-center text-xs font-bold border border-gray-200 dark:border-gray-700 w-24">المستويات</th>
                  <th className="py-2 px-2 text-center text-xs font-bold border border-gray-200 dark:border-gray-700 w-16">المجموع</th>
                  {courseColumns.map((colNum) => (
                    <th key={colNum} className="py-2 px-2 text-center text-xs font-bold border border-gray-200 dark:border-gray-700 min-w-[150px]">
                      {colNum}
                    </th>
                  ))}
                  <th className="py-2 px-2 text-center text-xs font-bold border border-gray-200 dark:border-gray-700 w-24">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map((trainer, index) => {
                  const trainerCourses = trainer.courses || [];
                  return (
                    <tr key={trainer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      {/* Serial Number */}
                      <td className="py-3 px-2 text-center font-bold border border-gray-200 dark:border-gray-700">
                        {(page - 1) * 15 + index + 1}
                      </td>
                      
                      {/* Trainer's Name */}
                      <td className="py-3 px-2 text-center border border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-white">
                        <Link to={`/staff-profile/trainer/${trainer.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                          {trainer.user?.name || trainer.name}
                        </Link>
                      </td>
                      
                      {/* Levels */}
                      <td className="py-3 px-2 text-center border border-gray-200 dark:border-gray-700 font-medium text-gray-600 dark:text-gray-400">
                        {trainer.min_level && trainer.max_level
                          ? `${trainer.min_level} - ${trainer.max_level}`
                          : trainer.min_level || trainer.max_level || '-'}
                      </td>
                      
                      {/* Total Active Courses */}
                      <td className="py-3 px-2 text-center font-bold border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white">
                        {trainer.active_courses_count ?? trainerCourses.length}
                      </td>
                      
                      {/* Course Slots */}
                      {courseColumns.map((_, colIndex) => {
                        const course = trainerCourses[colIndex];
                        return (
                          <td key={colIndex} className="p-2 border border-gray-200 dark:border-gray-700 align-middle text-center">
                            {course ? (
                              <div className="flex flex-col gap-1 text-[10px] text-right p-1.5 rounded bg-blue-50/40 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/40 min-w-[120px] max-w-[160px] mx-auto shadow-sm">
                                {/* Student Name */}
                                <div className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                  {course.is_dual && course.students && course.students.length > 0 ? (
                                    course.students.map((s, idx) => (
                                      <span key={s.id}>
                                        {idx > 0 && ' و '}
                                        <Link to={`/students/${s.id}`} className="hover:underline">{s.name}</Link>
                                      </span>
                                    ))
                                  ) : (
                                    <Link to={`/students/${course.students?.[0]?.id || course.student_id}`} className="hover:underline">
                                      {course.students?.[0]?.name || course.student_name || '-'}
                                    </Link>
                                  )}
                                </div>
                                {/* Days */}
                                <div className="text-gray-500 dark:text-gray-400 text-[9px] truncate" title={formatDays(course.lecture_days)}>
                                  {formatDays(course.lecture_days)}
                                </div>
                                {/* Level */}
                                <div className="text-gray-700 dark:text-gray-300 font-semibold text-[9px]">
                                  {course.students?.[0]?.pivot?.student_level || course.students?.[0]?.level || (course.course_package || course.coursePackage)?.name || '-'}
                                </div>
                                {/* Date */}
                                <div className="text-gray-500 dark:text-gray-400 text-[9px]">
                                  {formatDate(course.start_date)}
                                </div>
                                {/* Time */}
                                <div className="text-gray-500 dark:text-gray-400 font-medium text-[9px]">
                                  {formatTime(course.lecture_time)}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                      
                      {/* Actions */}
                      <td className="py-3 px-2 text-center border border-gray-200 dark:border-gray-700 align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openModal(trainer)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(trainer.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* API Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                  page === 1
                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
                السابق
              </button>

              <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                صفحة {page} من {totalPages}
              </span>

              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                  page === totalPages
                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTrainer ? 'تعديل بيانات المدرب' : 'إضافة مدرب جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">اسم المدرب *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="أدخل اسم المدرب"
              required
            />
          </div>

          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              placeholder="trainer@example.com"
              dir="ltr"
            />
          </div>

          <div>
            <label className="label">رقم الهاتف</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              placeholder="07xxxxxxxxx"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">أقل مستوى</label>
              <select
                value={formData.min_level}
                onChange={(e) => setFormData({ ...formData, min_level: e.target.value })}
                className="select w-full"
              >
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
              <label className="label">أعلى مستوى</label>
              <select
                value={formData.max_level}
                onChange={(e) => setFormData({ ...formData, max_level: e.target.value })}
                className="select w-full"
              >
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

          <div>
            <label className="label">
              {editingTrainer ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)' : 'كلمة المرور'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              placeholder={editingTrainer ? '••••••••' : 'أدخل كلمة مرور للمدرب'}
              dir="ltr"
              required={!editingTrainer}
              minLength={6}
            />
          </div>

          <div>
            <label className="label">حالة المدرب *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="select w-full"
              required
            >
              <option value="active">نشط (حالي)</option>
              <option value="inactive">غير نشط (سابق)</option>
            </select>
          </div>

          <div>
            <label className="label">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input min-h-[100px]"
              placeholder="أضف أي ملاحظات عن المدرب..."
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
            {editingTrainer ? (
              <button
                type="button"
                onClick={() => { closeModal(); handleDelete(editingTrainer.id); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={closeModal} className="btn-secondary">
                إلغاء
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'جاري الحفظ...' : editingTrainer ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* New Trainer Credentials Modal */}
      {newTrainerCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNewTrainerCredentials(null)} />
          <div className="relative bg-[var(--color-bg-primary)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-fade-in text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)]">تم إضافة المدرب بنجاح</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">احتفظ ببيانات الدخول التالية وسلّمها للمدرب:</p>
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-right space-y-2 text-sm font-mono" dir="ltr">
              <div><span className="text-[var(--color-text-secondary)]">Name: </span><span className="font-bold text-[var(--color-text-primary)]">{newTrainerCredentials.name}</span></div>
              <div><span className="text-[var(--color-text-secondary)]">Email: </span><span className="font-bold text-[var(--color-text-primary)]">{newTrainerCredentials.email}</span></div>
              <div><span className="text-[var(--color-text-secondary)]">Password: </span><span className="font-bold text-green-600 dark:text-green-400">{newTrainerCredentials.password}</span></div>
            </div>
            <button
              onClick={() => setNewTrainerCredentials(null)}
              className="btn-primary w-full mt-2"
            >
              حسنًا، تم الحفظ
            </button>
          </div>
        </div>
      )}

      {/* Notes Popup */}
      {notesPopup.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setNotesPopup({ open: false, notes: '', trainerName: '' })}
          />
          <div className="relative bg-[var(--color-bg-primary)] rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl animate-fade-in">
            <button
              onClick={() => setNotesPopup({ open: false, notes: '', trainerName: '' })}
              className="absolute top-3 left-3 p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-[var(--color-text-primary)]">ملاحظات المدرب</h4>
                <p className="text-xs text-[var(--color-text-muted)]">{notesPopup.trainerName}</p>
              </div>
            </div>
            <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
              <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {notesPopup.notes}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trainers;
