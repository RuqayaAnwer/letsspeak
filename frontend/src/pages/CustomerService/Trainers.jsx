import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, Trash2, GraduationCap, Phone, Filter, MessageSquare, X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  });
  const [newTrainerCredentials, setNewTrainerCredentials] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [trainersPage, setTrainersPage] = useState(1); // Pagination for mobile cards

  useEffect(() => {
    fetchTrainers();
  }, [search, weeklyFilter]);

  // Reset pagination when trainers change
  useEffect(() => {
    setTrainersPage(1);
  }, [trainers]);

  const fetchTrainers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (weeklyFilter) params.weekly_lectures = weeklyFilter;
      
      const response = await api.get('/trainers', { params });
      
      // Handle paginated response - API returns { data: [...], current_page, ... }
      const trainersData = response.data?.data || response.data || [];
      
      if (!Array.isArray(trainersData)) {
        console.error('Invalid trainers data format:', trainersData);
        setTrainers([]);
      } else {
        setTrainers(trainersData);
      }
    } catch (error) {
      console.error('Error fetching trainers:', error);
      console.error('Error response:', error.response);
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  };

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
        };
        if (formData.password) payload.password = formData.password;
        await api.put(`/trainers/${editingTrainer.id}`, payload);
        fetchTrainers();
        closeModal();
      } else {
        const res = await api.post('/trainers', formData);
        fetchTrainers();
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
      fetchTrainers();
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
      });
    } else {
      setEditingTrainer(null);
      setFormData({ name: '', email: '', phone: '', min_level: '', max_level: '', notes: '', password: '' });
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
            {(() => {
              const itemsPerPage = 5;
              const totalPages = Math.ceil(trainers.length / itemsPerPage);
              const startIndex = (trainersPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const currentTrainers = trainers.slice(startIndex, endIndex);
              
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
                    {currentTrainers.map((trainer, index) => {
                      const displayIndex = startIndex + index + 1;
                      return (
                        <div key={trainer.id} className="p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">اسم المدرب</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1">{displayIndex}</span>
                                <span className="text-sm font-semibold text-gray-800 dark:text-white">
                                  {trainer.user?.name || trainer.name}
                                </span>
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
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الكورسات</span>
                              <span className="badge badge-info text-xs px-1.5 py-0.5">
                                {trainer.courses_count || 0}
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
                              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">ملاحظات</span>
                              {trainer.notes ? (
                                <button
                                  onClick={() => setNotesPopup({
                                    open: true,
                                    notes: trainer.notes,
                                    trainerName: trainer.user?.name || trainer.name || 'المدرب'
                                  })}
                                  className="p-1 rounded-lg text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors"
                                  title={trainer.notes}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-300 dark:text-gray-600">-</span>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-gray-600">
                              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">الإجراءات</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openModal(trainer)}
                                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-primary-600"
                                  title="تعديل"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(trainer.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-600"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <button
                        onClick={() => setTrainersPage(prev => Math.max(1, prev - 1))}
                        disabled={trainersPage === 1}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                          trainersPage === 1
                            ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        <ChevronRight className="w-3 h-3" />
                        السابق
                      </button>

                      <span className="text-[9px] text-gray-600 dark:text-gray-400">
                        صفحة {trainersPage} من {totalPages}
                      </span>

                      <button
                        onClick={() => setTrainersPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={trainersPage === totalPages}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                          trainersPage === totalPages
                            ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        التالي
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th className="py-2 px-2 text-center">#</th>
                    <th className="py-2 px-2 text-center">اسم المدرب</th>
                    <th className="py-2 px-2 text-center">رقم الهاتف</th>
                    <th className="py-2 px-2 text-center">البريد الإلكتروني</th>
                    <th className="py-2 px-2 text-center">المستوى</th>
                    <th className="py-2 px-2 text-center">الكورسات</th>
                    <th className="py-2 px-2 text-center">محاضرات الأسبوع</th>
                    <th className="py-2 px-2 text-center">ملاحظات</th>
                    <th className="py-2 px-2 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map((trainer, index) => (
                    <tr key={trainer.id}>
                      <td className="py-2 px-2 text-center font-semibold">{index + 1}</td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-[9px]">
                              {(trainer.user?.name || trainer.name)?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-[11px] text-[var(--color-text-primary)] whitespace-nowrap">
                            {trainer.user?.name || trainer.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Phone className="w-3 h-3 text-[var(--color-text-muted)]" />
                          <span dir="ltr" className="text-[11px]">{trainer.phone || '-'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span dir="ltr" className="text-[11px]">{trainer.user?.email || trainer.email || '-'}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-[10px] text-[var(--color-text-secondary)] whitespace-nowrap font-medium">
                          {trainer.min_level && trainer.max_level 
                            ? `${trainer.min_level} - ${trainer.max_level}` 
                            : trainer.min_level || trainer.max_level || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="badge badge-info text-[10px] px-1.5 py-0.5">
                          {trainer.courses_count || 0}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`badge text-[10px] px-1.5 py-0.5 ${
                          trainer.weekly_lectures_count >= 3 
                            ? 'badge-success' 
                            : trainer.weekly_lectures_count > 0 
                              ? 'badge-warning' 
                              : 'badge-gray'
                        }`}>
                          {trainer.weekly_lectures_count || 0}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {trainer.notes ? (
                          <button
                            onClick={() => setNotesPopup({
                              open: true,
                              notes: trainer.notes,
                              trainerName: trainer.user?.name || trainer.name || 'المدرب'
                            })}
                            className="p-1 rounded-lg text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors"
                            title={trainer.notes}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => openModal(trainer)}
                            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-primary-600"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(trainer.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-red-600"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
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
            <label className="label">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input min-h-[100px]"
              placeholder="أضف أي ملاحظات عن المدرب..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeModal} className="btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جاري الحفظ...' : editingTrainer ? 'تحديث' : 'إضافة'}
            </button>
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
