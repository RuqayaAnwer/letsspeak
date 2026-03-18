import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, UserCheck, UserX, Shield, Users, DollarSign, GraduationCap, Lock, Eye, EyeOff, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

const roleLabels = {
  admin:            { label: 'مدير النظام',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: Shield },
  customer_service: { label: 'خدمة العملاء', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',   icon: Users },
  finance:          { label: 'المالية',        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: DollarSign },
  trainer:          { label: 'مدرب',           color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: GraduationCap },
};

const sampleUsers = [
  { id: 1, name: 'أحمد خدمة العملاء', email: 'cs@letspeak.com',      role: 'customer_service', status: 'active',   created_at: '2025-01-01' },
  { id: 2, name: 'سارة المالية',       email: 'finance@letspeak.com', role: 'finance',          status: 'active',   created_at: '2025-01-01' },
  { id: 3, name: 'مدير النظام',        email: 'admin@letspeak.com',   role: 'admin',            status: 'active',   created_at: '2025-01-01' },
  { id: 4, name: 'نور خدمة العملاء',  email: 'noor@letspeak.com',    role: 'customer_service', status: 'inactive', created_at: '2025-02-01' },
];

const AdminUsers = () => {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [formData, setFormData]       = useState({ name: '', email: '', password: '', role: 'customer_service' });
  const [actionLoading, setActionLoading] = useState(null);
  const [resetPasswordModal, setResetPasswordModal] = useState({
    open: false,
    user: null,
    password: '',
    password_confirmation: '',
    submitting: false,
    showPassword: false,
  });

  const [addTrainerModal, setAddTrainerModal] = useState({
    open: false,
    name: '',
    email: '',
    phone: '',
    password: '',
    min_level: '',
    max_level: '',
    notes: '',
    submitting: false,
  });

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)     params.search = search;
      if (roleFilter) params.role   = roleFilter;
      const res = await api.get('/admin/users', { params });
      setUsers(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      if (import.meta.env.DEV) {
        let filtered = sampleUsers;
        if (roleFilter) filtered = filtered.filter(u => u.role === roleFilter);
        if (search)     filtered = filtered.filter(u => u.name.includes(search) || u.email.includes(search));
        setUsers(filtered);
      } else {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user = null) => {
    setEditingUser(user);
    setFormData(user
      ? { name: user.name, email: user.email, password: '', role: user.role }
      : { name: '', email: '', password: '', role: 'customer_service' }
    );
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'customer_service' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { name: formData.name, email: formData.email, role: formData.role };
      if (editingUser && formData.password) payload.password = formData.password;
      if (!editingUser) payload.password = formData.password; // مطلوب عند الإضافة

      if (editingUser) {
        await api.put(`/admin/users/${editingUser.id}`, payload);
        alert('تم تحديث بيانات الموظف بنجاح');
      } else {
        await api.post('/admin/users', payload);
        alert('تم إضافة الموظف بنجاح.');
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    setActionLoading(user.id);
    try {
      const res = await api.patch(`/admin/users/${user.id}/toggle-status`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: res.data.status } : u));
      alert(res.data.status === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${user.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setActionLoading(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      alert('تم حذف الموظف بنجاح');
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ أثناء الحذف');
    } finally {
      setActionLoading(null);
    }
  };

  const openResetPasswordModal = (user) => {
    setResetPasswordModal({
      open: true,
      user,
      password: '',
      password_confirmation: '',
      submitting: false,
      showPassword: false,
    });
  };

  const closeResetPasswordModal = () => {
    setResetPasswordModal({ open: false, user: null, password: '', password_confirmation: '', submitting: false, showPassword: false });
  };


  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    const { user, password, password_confirmation } = resetPasswordModal;
    if (!user?.id) return;
    if (password.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (password !== password_confirmation) {
      alert('تأكيد كلمة المرور غير مطابق');
      return;
    }
    setResetPasswordModal(prev => ({ ...prev, submitting: true }));
    try {
      await api.post(`/admin/users/${user.id}/reset-password`, { password, password_confirmation });
      alert('تم تعيين كلمة المرور الجديدة بنجاح.');
      closeResetPasswordModal();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.password?.[0] || 'حدث خطأ';
      alert(msg);
    } finally {
      setResetPasswordModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const openAddTrainerModal = () => {
    setAddTrainerModal({
      open: true,
      name: '',
      email: '',
      phone: '',
      password: '',
      min_level: '',
      max_level: '',
      notes: '',
      submitting: false,
    });
  };

  const closeAddTrainerModal = () => {
    setAddTrainerModal({ open: false, name: '', email: '', phone: '', password: '', min_level: '', max_level: '', notes: '', submitting: false });
  };

  const handleAddTrainerSubmit = async (e) => {
    e.preventDefault();
    const { name, email, phone, password, min_level, max_level, notes } = addTrainerModal;
    if (!name.trim()) {
      alert('الاسم مطلوب');
      return;
    }
    setAddTrainerModal(prev => ({ ...prev, submitting: true }));
    try {
      await api.post('/trainers', {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password || undefined,
        min_level: min_level || undefined,
        max_level: max_level || undefined,
        notes: notes.trim() || undefined,
      });
      alert('تم إضافة المدرب بنجاح.');
      closeAddTrainerModal();
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ عند إضافة المدرب');
    } finally {
      setAddTrainerModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const getRoleInfo = (role) => roleLabels[role] ?? { label: role, color: 'bg-gray-100 text-gray-700', icon: Users };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            إدارة المستخدمين
          </h1>
          <p className="page-subtitle">إضافة وتعديل موظفي النظام</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            عند نسيان الموظف أو المدرب لكلمة المرور يمكنك إعادة تعيينها وتزويده بها.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
            <Plus className="w-4 h-4" />
            إضافة موظف
          </button>
          <button onClick={openAddTrainerModal} className="btn-secondary flex items-center gap-2 text-sm px-4 py-2 border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
            <GraduationCap className="w-4 h-4" />
            إضافة مدرب
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الإيميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pr-9 text-sm w-full"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="select text-sm min-w-[160px]"
        >
          <option value="">كل الأقسام</option>
          <option value="admin">مدير النظام</option>
          <option value="customer_service">خدمة العملاء</option>
          <option value="finance">المالية</option>
          <option value="trainer">المدربون</option>
        </select>
      </div>

      {/* Content */}
      {loading ? <LoadingSpinner /> : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {users.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-muted)]">لا يوجد مستخدمون</div>
            ) : users.map((u, index) => {
              const roleInfo = getRoleInfo(u.role);
              const RoleIcon = roleInfo.icon;
              return (
                <div
                  key={u.id}
                  className="card p-3 space-y-2 cursor-pointer hover:border-primary-400 transition-all"
                  onClick={() => openModal(u)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">{index + 1}</span>
                      {u.avatar ? (
                        <img 
                          src={`${import.meta.env.VITE_API_BASE_URL || 'https://api.letspeak.online'}/storage/${u.avatar}`} 
                          alt={u.name}
                          className="w-6 h-6 rounded-full object-cover shadow-sm"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-white text-[10px] font-bold">{u.name?.charAt(0)}</span>
                        </div>
                      )}
                      <span className="font-semibold text-sm text-[var(--color-text-primary)]">{u.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${roleInfo.color}`}>
                      <RoleIcon className="w-3 h-3" />
                      {roleInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">{u.email}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                      {u.status === 'active' ? 'نشط' : 'معطّل'}
                    </span>
                    <div className="flex items-center gap-1">

                      <button
                        onClick={(e) => { e.stopPropagation(); openResetPasswordModal(u); }}
                        className="text-xs px-2 py-1 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-1"
                        title="إعادة تعيين كلمة المرور"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        تعيين جديدة
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(u); }}
                        disabled={actionLoading === u.id}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${u.status === 'active' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                      >
                        {u.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {u.status === 'active' ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }}
                        disabled={actionLoading === u.id}
                        className="text-xs px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="card hidden md:block overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>القسم / الدور</th>
                  <th>الحالة</th>
                  <th>تاريخ الإضافة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-10 text-[var(--color-text-muted)]">لا يوجد مستخدمون</td></tr>
                ) : users.map((u, index) => {
                  const roleInfo = getRoleInfo(u.role);
                  const RoleIcon = roleInfo.icon;
                  return (
                    <tr key={u.id}>
                      <td className="text-sm font-bold text-gray-500">{index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {u.avatar ? (
                            <img 
                              src={`${import.meta.env.VITE_API_BASE_URL || 'https://api.letspeak.online'}/storage/${u.avatar}`} 
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover shadow-sm"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <span className="text-white text-xs font-bold">{u.name?.charAt(0)}</span>
                            </div>
                          )}
                          <span className="font-semibold text-sm text-[var(--color-text-primary)]">{u.name}</span>
                        </div>
                      </td>
                      <td className="text-sm" dir="ltr">{u.email}</td>
                      <td>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 w-fit ${roleInfo.color}`}>
                          <RoleIcon className="w-3 h-3" />
                          {roleInfo.label}
                        </span>
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                          {u.status === 'active' ? '● نشط' : '○ معطّل'}
                        </span>
                      </td>
                      <td className="text-sm text-[var(--color-text-muted)]">{u.created_at ?? '-'}</td>
                      <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openModal(u)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openResetPasswordModal(u)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 hover:text-amber-600 transition-colors"
                          title="إعادة تعيين كلمة المرور"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={actionLoading === u.id}
                          className={`p-1.5 rounded-lg transition-colors ${u.status === 'active' ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                          title={u.status === 'active' ? 'تعطيل' : 'تفعيل'}
                        >
                          {u.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={actionLoading === u.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
                          title="حذف نهائي"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingUser ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">الاسم الكامل *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="أدخل الاسم الكامل"
              required
            />
          </div>

          <div>
            <label className="label">البريد الإلكتروني *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              placeholder="example@letspeak.com"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="label">
              {editingUser ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)' : 'كلمة المرور *'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              placeholder={editingUser ? '••••••••' : 'أدخل كلمة المرور'}
              dir="ltr"
              required={!editingUser}
              minLength={6}
            />
          </div>

          <div>
            <label className="label">القسم / الدور *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="select w-full"
              required
            >
              <option value="customer_service">خدمة العملاء</option>
              <option value="finance">المالية</option>
              <option value="admin">مدير النظام</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeModal} className="btn-secondary">إلغاء</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جاري الحفظ...' : editingUser ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* إعادة تعيين كلمة المرور */}
      <Modal
        isOpen={resetPasswordModal.open}
        onClose={closeResetPasswordModal}
        title={`إعادة تعيين كلمة المرور — ${resetPasswordModal.user?.name || ''}`}
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            تعيين كلمة مرور جديدة للموظف. بعد الحفظ تأكد من تزويد الموظف بها بشكل آمن.
          </p>
          <div>
            <label className="label">كلمة المرور الجديدة *</label>
            <div className="relative">
              <input
                type={resetPasswordModal.showPassword ? 'text' : 'password'}
                value={resetPasswordModal.password}
                onChange={(e) => setResetPasswordModal(prev => ({ ...prev, password: e.target.value }))}
                className="input pr-10 w-full"
                placeholder="6 أحرف على الأقل"
                dir="ltr"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setResetPasswordModal(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {resetPasswordModal.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">تأكيد كلمة المرور *</label>
            <input
              type={resetPasswordModal.showPassword ? 'text' : 'password'}
              value={resetPasswordModal.password_confirmation}
              onChange={(e) => setResetPasswordModal(prev => ({ ...prev, password_confirmation: e.target.value }))}
              className="input w-full"
              placeholder="أعد إدخال كلمة المرور"
              dir="ltr"
              required
              minLength={6}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeResetPasswordModal} className="btn-secondary">إلغاء</button>
            <button type="submit" disabled={resetPasswordModal.submitting} className="btn-primary">
              {resetPasswordModal.submitting ? 'جاري الحفظ...' : 'تعيين كلمة المرور'}
            </button>
          </div>
        </form>
      </Modal>



      {/* إضافة مدرب */}
      <Modal
        isOpen={addTrainerModal.open}
        onClose={closeAddTrainerModal}
        title="إضافة مدرب جديد"
      >
        <form onSubmit={handleAddTrainerSubmit} className="space-y-4">
          <div>
            <label className="label">اسم المدرب *</label>
            <input
              type="text"
              value={addTrainerModal.name}
              onChange={(e) => setAddTrainerModal(prev => ({ ...prev, name: e.target.value }))}
              className="input w-full"
              placeholder="أدخل اسم المدرب"
              required
            />
          </div>
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              type="email"
              value={addTrainerModal.email}
              onChange={(e) => setAddTrainerModal(prev => ({ ...prev, email: e.target.value }))}
              className="input w-full"
              placeholder="trainer@example.com"
              dir="ltr"
              autoComplete="new-email"
            />
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input
              type="tel"
              value={addTrainerModal.phone}
              onChange={(e) => setAddTrainerModal(prev => ({ ...prev, phone: e.target.value }))}
              className="input w-full"
              placeholder="07xxxxxxxxx"
              dir="ltr"
              autoComplete="new-phone"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">أقل مستوى</label>
              <select
                value={addTrainerModal.min_level}
                onChange={(e) => setAddTrainerModal(prev => ({ ...prev, min_level: e.target.value }))}
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
                value={addTrainerModal.max_level}
                onChange={(e) => setAddTrainerModal(prev => ({ ...prev, max_level: e.target.value }))}
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
            <label className="label">كلمة المرور (اختياري — إن تركت فارغة تُستخدم 12345678)</label>
            <input
              type="password"
              value={addTrainerModal.password}
              onChange={(e) => setAddTrainerModal(prev => ({ ...prev, password: e.target.value }))}
              className="input w-full"
              placeholder="6 أحرف على الأقل"
              dir="ltr"
              minLength={6}
            />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea
              value={addTrainerModal.notes}
              onChange={(e) => setAddTrainerModal(prev => ({ ...prev, notes: e.target.value }))}
              className="input w-full min-h-[80px]"
              placeholder="أضف أي ملاحظات..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeAddTrainerModal} className="btn-secondary">إلغاء</button>
            <button type="submit" disabled={addTrainerModal.submitting} className="btn-primary">
              {addTrainerModal.submitting ? 'جاري الإضافة...' : 'إضافة المدرب'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminUsers;
