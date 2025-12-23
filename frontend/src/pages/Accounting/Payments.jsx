import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, CreditCard } from 'lucide-react';
import { formatDateSimple } from '../../utils/dateFormat';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [packages, setPackages] = useState([]);
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    course_package_id: '',
    amount: '',
    remaining_amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchStudentsAndCourses();
  }, [search]);

  const fetchPayments = async () => {
    try {
      const params = {};
      if (search) params.search = search;

      const response = await api.get('/payments', { params });
      const paymentsData = response.data.data || response.data || [];
      // Sort payments by student name alphabetically
      const sortedPayments = Array.isArray(paymentsData) 
        ? [...paymentsData].sort((a, b) => {
            const nameA = (a.student?.name || '').toLowerCase();
            const nameB = (b.student?.name || '').toLowerCase();
            return nameA.localeCompare(nameB, 'ar');
          })
        : [];
      setPayments(sortedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndCourses = async () => {
    try {
      const [studentsRes, coursesRes, packagesRes] = await Promise.all([
        api.get('/students'),
        api.get('/courses'),
        api.get('/course-packages'),
      ]);
      setStudents(studentsRes.data.data || studentsRes.data || []);
      setCourses(coursesRes.data.data || coursesRes.data || []);
      setPackages(packagesRes.data.data || packagesRes.data || []);
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
        payment_date: formData.date,
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
      const course = payment.course;
      const packageId = course?.course_package_id || course?.coursePackage?.id || '';
      const packagePrice = course?.course_package?.price || course?.coursePackage?.price || 0;
      const paidAmount = parseFloat(payment.amount) || 0;
      const remainingAmount = packagePrice - paidAmount;
      
      setFormData({
        student_id: payment.student_id?.toString() || '',
        course_id: payment.course_id?.toString() || '',
        course_package_id: packageId.toString(),
        amount: payment.amount?.toString() || '',
        remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
        date: payment.payment_date || payment.date || new Date().toISOString().split('T')[0],
        notes: payment.notes || '',
      });
    } else {
      setEditingPayment(null);
      setFormData({
        student_id: '',
        course_id: '',
        course_package_id: '',
        amount: '',
        remaining_amount: '',
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

  // Calculate remaining amount for a course (total paid vs package price)
  const calculateRemainingAmount = (payment) => {
    const course = payment.course;
    if (!course) return 0;
    
    const packagePrice = course.course_package?.price || course.coursePackage?.price || 0;
    if (packagePrice === 0) return 0; // No price set, consider as completed
    
    // Calculate total paid for this course from all payments
    const totalPaid = payments
      .filter(p => p.course_id === payment.course_id && p.status === 'completed')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    
    const remaining = packagePrice - totalPaid;
    
    return remaining > 0 ? remaining : 0;
  };

  // Get payment status (completed or remaining)
  const getPaymentStatus = (payment) => {
    const remaining = calculateRemainingAmount(payment);
    if (remaining > 0) {
      return { label: '', badge: 'badge-warning', amount: remaining };
    }
    return { label: 'مكتمل', badge: 'badge-success', amount: 0 };
  };

  const handlePackageChange = (packageId) => {
    const selectedPackage = packages.find((p) => p.id.toString() === packageId);
    const packagePrice = selectedPackage ? (selectedPackage.price || 0) : 0;
    const paidAmount = parseFloat(formData.amount) || 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      course_package_id: packageId,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
  };

  const handleAmountChange = (value) => {
    const paidAmount = parseFloat(value) || 0;
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    const packagePrice = selectedPackage ? (selectedPackage.price || 0) : 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      amount: value,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
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
            <table className="table text-sm">
              <thead>
                <tr>
                  <th className="text-center text-xs py-2 px-2">#</th>
                  <th className="text-center text-xs py-2 px-2">اسم الطالب</th>
                  <th className="text-center text-xs py-2 px-2">رقم الهاتف</th>
                  <th className="text-center text-xs py-2 px-2">الباقة</th>
                  <th className="text-center text-xs py-2 px-2">تاريخ الدفع</th>
                  <th className="text-center text-xs py-2 px-2">المبلغ المدفوع</th>
                  <th className="text-center text-xs py-2 px-2">المتبقي</th>
                  <th className="text-center text-xs py-2 px-2">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const paymentStatus = getPaymentStatus(payment);
                  return (
                    <tr key={payment.id}>
                      <td className="font-semibold text-center text-xs py-2 px-2">{payment.id}</td>
                      <td className="text-center text-xs py-2 px-2">
                        <span className="font-semibold text-xs">{payment.student?.name || '-'}</span>
                      </td>
                      <td className="text-center text-xs py-2 px-2">
                        <span className="text-[var(--color-text-primary)]">
                          {payment.student?.phone || '-'}
                        </span>
                      </td>
                      <td className="text-center text-xs py-2 px-2">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {payment.course?.course_package?.name || payment.course?.coursePackage?.name || '-'}
                        </span>
                      </td>
                      <td className="text-center text-xs py-2 px-2">
                        {formatDateSimple(payment.payment_date || payment.date)}
                      </td>
                      <td className="font-bold text-emerald-600 dark:text-emerald-400 text-center text-xs py-2 px-2">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="text-center text-xs py-2 px-2">
                        {paymentStatus.amount > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">
                            {formatCurrency(paymentStatus.amount)}
                          </span>
                        ) : (
                          <span className={`badge ${paymentStatus.badge} text-xs`}>
                            {paymentStatus.label}
                          </span>
                        )}
                      </td>
                      <td className="text-center text-xs py-2 px-2">
                        <button
                          onClick={() => openModal(payment)}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-primary-600"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                    {pkg.name} {pkg.price > 0 ? `(${pkg.price} د.ع)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المبلغ المدفوع (د.ع) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="input"
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="label">المتبقي (د.ع)</label>
              <input
                type="number"
                value={formData.remaining_amount}
                className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                placeholder="0.00"
                readOnly
                disabled
              />
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
