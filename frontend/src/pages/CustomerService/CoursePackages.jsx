import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';

const CoursePackages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    lectures_count: '',
    description: '',
    price: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await api.get('/course-packages');
      setPackages(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = {
        ...formData,
        lectures_count: parseInt(formData.lectures_count),
        price: formData.price ? parseFloat(formData.price) : null,
      };

      if (editingPackage) {
        await api.put(`/course-packages/${editingPackage.id}`, data);
      } else {
        await api.post('/course-packages', data);
      }
      fetchPackages();
      closeModal();
    } catch (error) {
      console.error('Error saving package:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;

    try {
      await api.delete(`/course-packages/${id}`);
      fetchPackages();
    } catch (error) {
      console.error('Error deleting package:', error);
    }
  };

  const openModal = (pkg = null) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name,
        lectures_count: pkg.lectures_count.toString(),
        description: pkg.description || '',
        price: pkg.price?.toString() || '',
      });
    } else {
      setEditingPackage(null);
      setFormData({ name: '', lectures_count: '', description: '', price: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPackage(null);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return `${Number(amount).toLocaleString('en-US')} د.ع`;
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">باقات الكورسات</h1>
          <p className="page-subtitle">إدارة الباقات المتاحة</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          إضافة باقة
        </button>
      </div>

      {/* Packages Table */}
      {packages.length === 0 ? (
        <EmptyState
          title="لا توجد باقات"
          description="قم بإنشاء أول باقة للبدء"
          icon={Package}
          action={
            <button onClick={() => openModal()} className="btn-primary">
              إضافة باقة
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
                  <th>اسم الباقة</th>
                  <th>عدد المحاضرات</th>
                  <th>السعر</th>
                  <th>الكورسات النشطة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, index) => (
                  <tr key={pkg.id}>
                    <td className="font-semibold">{index + 1}</td>
                    <td className="font-semibold text-[var(--color-text-primary)]">
                      {pkg.name}
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {pkg.lectures_count} محاضرة
                      </span>
                    </td>
                    <td className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(pkg.price)}
                    </td>
                    <td>
                      <span className="badge badge-gray">
                        {pkg.courses_count || 0} كورس
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openModal(pkg)}
                          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-primary-600"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(pkg.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-red-600"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
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
        title={editingPackage ? 'تعديل الباقة' : 'إضافة باقة جديدة'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">اسم الباقة *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="مثال: الباقة الأساسية"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">عدد المحاضرات *</label>
              <input
                type="number"
                value={formData.lectures_count}
                onChange={(e) => setFormData({ ...formData, lectures_count: e.target.value })}
                className="input"
                placeholder="16"
                min="1"
                required
              />
            </div>

            <div>
              <label className="label">السعر (د.ع)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="input"
                placeholder="900"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeModal} className="btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جاري الحفظ...' : editingPackage ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CoursePackages;
