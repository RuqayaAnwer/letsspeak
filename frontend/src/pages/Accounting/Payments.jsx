import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Filter, Edit2, CreditCard } from 'lucide-react';
import { formatDateSimple } from '../../utils/dateFormat';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    amount: '',
    status: 'paid',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchStudentsAndCourses();
  }, [search, statusFilter]);

  const fetchPayments = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/payments', { params });
      setPayments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndCourses = async () => {
    try {
      const [studentsRes, coursesRes] = await Promise.all([
        api.get('/students'),
        api.get('/courses'),
      ]);
      setStudents(studentsRes.data.data || []);
      setCourses(coursesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = {
        ...formData,
        student_id: parseInt(formData.student_id),
        course_id: parseInt(formData.course_id),
        amount: parseFloat(formData.amount),
      };

      if (editingPayment) {
        await api.put(`/payments/${editingPayment.id}`, data);
      } else {
        await api.post('/payments', data);
      }
      fetchPayments();
      closeModal();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (payment = null) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        student_id: payment.student_id?.toString() || '',
        course_id: payment.course_id?.toString() || '',
        amount: payment.amount?.toString() || '',
        status: payment.status || 'paid',
        date: payment.date || new Date().toISOString().split('T')[0],
        notes: payment.notes || '',
      });
    } else {
      setEditingPayment(null);
      setFormData({
        student_id: '',
        course_id: '',
        amount: '',
        status: 'paid',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPayment(null);
  };

  const formatCurrency = (amount) => `${Number(amount || 0).toLocaleString('en-US')} د.ع`;

  const getStatusLabel = (status) => {
    const labels = { completed: 'مكتمل', pending: 'معلق' };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const badges = { completed: 'badge-success', pending: 'badge-warning' };
    return badges[status] || 'badge-gray';
  };

  const getStudentCourses = () => {
    if (!formData.student_id) return courses;
    return courses.filter((c) => c.student_id?.toString() === formData.student_id);
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">إدارة المدفوعات</h1>
          <p className="page-subtitle">تسجيل ومتابعة المدفوعات</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          إضافة دفعة
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="البحث باسم الطالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pr-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-[var(--color-text-muted)]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select w-40"
            >
              <option value="">كل الحالات</option>
              <option value="completed">مكتمل</option>
              <option value="pending">معلق</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      {payments.length === 0 ? (
        <EmptyState
          title="لا توجد مدفوعات"
          description="قم بتسجيل أول دفعة للبدء"
          icon={CreditCard}
          action={
            <button onClick={() => openModal()} className="btn-primary">
              إضافة دفعة
            </button>
          }
        />
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>التاريخ</th>
                  <th>الطالب</th>
                  <th>الكورس</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>ملاحظات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-semibold">{payment.id}</td>
                    <td>
                      {formatDateSimple(payment.date)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {payment.student?.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold">{payment.student?.name}</span>
                      </div>
                    </td>
                    <td>{payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}</td>
                    <td className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(payment.status)}`}>
                        {getStatusLabel(payment.status)}
                      </span>
                    </td>
                    <td className="text-[var(--color-text-muted)] max-w-xs truncate">
                      {payment.notes || '-'}
                    </td>
                    <td>
                      <button
                        onClick={() => openModal(payment)}
                        className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-primary-600"
                        title="تعديل"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
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
        title={editingPayment ? 'تعديل الدفعة' : 'إضافة دفعة جديدة'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الطالب *</label>
              <select
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value, course_id: '' })}
                className="select"
                required
              >
                <option value="">اختر الطالب</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">الكورس *</label>
              <select
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="select"
                required
              >
                <option value="">اختر الكورس</option>
                {getStudentCourses().map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_package?.name || course.coursePackage?.name || `كورس #${course.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المبلغ (د.ع) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="input"
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="label">الحالة *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="select"
                required
              >
                <option value="completed">مكتمل</option>
                <option value="pending">معلق</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">التاريخ *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input min-h-[80px]"
              placeholder="أضف أي ملاحظات..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeModal} className="btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جاري الحفظ...' : editingPayment ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Payments;
