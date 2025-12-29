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
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="page-title text-base sm:text-2xl">باقات الكورسات</h1>
          <p className="page-subtitle text-[10px] sm:text-sm">إدارة الباقات المتاحة</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-base px-3 sm:px-4 py-1.5 sm:py-2">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
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
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-2 p-2">
            {packages.map((pkg, index) => (
              <div key={pkg.id} className="p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">اسم الباقة</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 ml-1">{index + 1}</span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-white">
                        {pkg.name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">عدد المحاضرات</span>
                    <span className="badge badge-info text-[10px] px-1.5 py-0.5">
                      {pkg.lectures_count} محاضرة
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">السعر</span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(pkg.price)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">الكورسات النشطة</span>
                    <span className="badge badge-gray text-[10px] px-1.5 py-0.5">
                      {pkg.courses_count || 0} كورس
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">الإجراءات</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal(pkg)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-primary-600"
                        title="تعديل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pkg.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-600"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th className="text-[10px] sm:text-xs">#</th>
                  <th className="text-[10px] sm:text-xs">اسم الباقة</th>
                  <th className="text-[10px] sm:text-xs">عدد المحاضرات</th>
                  <th className="text-[10px] sm:text-xs">السعر</th>
                  <th className="text-[10px] sm:text-xs">الكورسات النشطة</th>
                  <th className="text-[10px] sm:text-xs">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, index) => (
                  <tr key={pkg.id}>
                    <td className="font-semibold text-[10px] sm:text-sm">{index + 1}</td>
                    <td className="font-semibold text-[var(--color-text-primary)] text-[10px] sm:text-sm">
                      {pkg.name}
                    </td>
                    <td>
                      <span className="badge badge-info text-[10px] sm:text-xs">
                        {pkg.lectures_count} محاضرة
                      </span>
                    </td>
                    <td className="font-semibold text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-sm">
                      {formatCurrency(pkg.price)}
                    </td>
                    <td>
                      <span className="badge badge-gray text-[10px] sm:text-xs">
                        {pkg.courses_count || 0} كورس
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openModal(pkg)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-primary-600"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(pkg.id)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-red-600"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
