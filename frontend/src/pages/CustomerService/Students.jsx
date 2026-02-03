import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, Trash2, Users, Phone, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [packages, setPackages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    level: 'L1',
    notes: '',
    course_package_id: '',
    paid_amount: '',
    remaining_amount: '',
  });

  const levels = [
    { value: 'L1', label: 'المستوى 1' },
    { value: 'L2', label: 'المستوى 2' },
    { value: 'L3', label: 'المستوى 3' },
    { value: 'L4', label: 'المستوى 4' },
    { value: 'L5', label: 'المستوى 5' },
    { value: 'L6', label: 'المستوى 6' },
    { value: 'L7', label: 'المستوى 7' },
    { value: 'L8', label: 'المستوى 8' },
  ];
  const [submitting, setSubmitting] = useState(false);
  const [studentsPage, setStudentsPage] = useState(1); // Pagination for mobile cards

  useEffect(() => {
    fetchStudents();
    fetchPackages();
    fetchCourses();
  }, [search]);

  const fetchPackages = async () => {
    try {
      const response = await api.get('/course-packages');
      setPackages(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      let allCourses = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await api.get('/courses', { params: { page: currentPage } });
        const responseData = response.data;
        const coursesData = responseData?.data || responseData || [];
        
        if (Array.isArray(coursesData) && coursesData.length > 0) {
          allCourses = [...allCourses, ...coursesData];
          hasMorePages = responseData?.current_page < responseData?.last_page;
          currentPage++;
        } else {
          hasMorePages = false;
        }
      }

      setCourses(allCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  // Check if student has dual courses
  const hasDualCourses = (studentId) => {
    return courses.some(course => {
      const isDual = course.is_dual || (course.students && Array.isArray(course.students) && course.students.length > 1);
      if (!isDual) return false;
      
      // Check if student is in this dual course
      if (course.students && Array.isArray(course.students)) {
        return course.students.some(s => {
          const studentIdFromArray = typeof s === 'object' ? s.id?.toString() : s?.toString();
          return studentIdFromArray === studentId.toString();
        });
      }
      return false;
    });
  };

  // Reset pagination when students change
  useEffect(() => {
    setStudentsPage(1);
  }, [students]);

  const fetchStudents = async () => {
    try {
      const response = await api.get('/students', { params: { search } });
      setStudents(response.data.data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, formData);
      } else {
        await api.post('/students', formData);
      }
      fetchStudents();
      closeModal();
    } catch (error) {
      console.error('Error saving student:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) return;

    try {
      await api.delete(`/students/${id}`);
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };

  const handlePackageChange = (packageId) => {
    const selectedPackage = packages.find((p) => p.id.toString() === packageId);
    const packagePrice = selectedPackage ? (selectedPackage.price || 0) : 0;
    const paidAmount = parseFloat(formData.paid_amount) || 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      course_package_id: packageId,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
  };

  const handlePaidAmountChange = (value) => {
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    const packagePrice = selectedPackage ? (selectedPackage.price || 0) : 0;
    const paidAmount = parseFloat(value) || 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setFormData({
      ...formData,
      paid_amount: value,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    });
  };

  const openModal = (student = null) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name,
        phone: student.phone,
        level: student.level || 'L1',
        notes: student.notes || '',
        course_package_id: '',
        paid_amount: '',
        remaining_amount: '',
      });
    } else {
      setEditingStudent(null);
      setFormData({ 
        name: '', 
        phone: '', 
        level: 'L1', 
        notes: '',
        course_package_id: '',
        paid_amount: '',
        remaining_amount: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
    setFormData({ 
      name: '', 
      phone: '', 
      level: 'L1', 
      notes: '',
      course_package_id: '',
      paid_amount: '',
      remaining_amount: '',
    });
  };

  const getLevelBadgeColor = (level) => {
    const colors = {
      L1: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      L2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      L3: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
      L4: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      L5: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      L6: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      L7: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      L8: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    };
    return colors[level] || colors.L1;
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">إدارة الطلاب</h1>
          <p className="page-subtitle">عرض وإدارة بيانات الطلاب</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          إضافة طالب
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="البحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pr-10"
          />
        </div>
      </div>

      {/* Students Table */}
      {students.length === 0 ? (
        <EmptyState
          title="لا يوجد طلاب"
          description="قم بإضافة أول طالب للبدء"
          icon={Users}
          action={
            <button onClick={() => openModal()} className="btn-primary">
              إضافة طالب
            </button>
          }
        />
      ) : (
        <div className="card">
          {/* Mobile Cards View */}
          <div className="md:hidden">
            {(() => {
              const itemsPerPage = 5;
              const totalPages = Math.ceil(students.length / itemsPerPage);
              const startIndex = (studentsPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const currentStudents = students.slice(startIndex, endIndex);
              
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
                    {currentStudents.map((student, index) => {
                      const displayIndex = startIndex + index + 1;
                      return (
                        <div key={student.id} className="p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">اسم الطالب</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1">{displayIndex}</span>
                                <span className="text-sm font-semibold text-gray-800 dark:text-white">
                                  {student.name}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">رقم الهاتف</span>
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                <span dir="ltr" className="text-sm text-gray-800 dark:text-white">{student.phone}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">المستوى</span>
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${getLevelBadgeColor(student.level)}`}>
                                <GraduationCap className="w-3 h-3" />
                                {student.level || 'L1'}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">عدد الكورسات</span>
                              <div className="flex items-center gap-1">
                                <span className="badge badge-info text-xs px-1.5 py-0.5">
                                  {student.courses_count || 0} كورس
                                </span>
                                {hasDualCourses(student.id) && (
                                  <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-semibold">
                                    ثنائي
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">ملاحظات</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400 text-right max-w-[65%] leading-relaxed">
                                {student.notes || '-'}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-gray-600">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الإجراءات</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openModal(student)}
                                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-primary-600"
                                  title="تعديل"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(student.id)}
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
                        onClick={() => setStudentsPage(prev => Math.max(1, prev - 1))}
                        disabled={studentsPage === 1}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                          studentsPage === 1
                            ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        <ChevronRight className="w-3 h-3" />
                        السابق
                      </button>

                      <span className="text-[9px] text-gray-600 dark:text-gray-400">
                        صفحة {studentsPage} من {totalPages}
                      </span>

                      <button
                        onClick={() => setStudentsPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={studentsPage === totalPages}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors text-[9px] ${
                          studentsPage === totalPages
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
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>اسم الطالب</th>
                      <th>رقم الهاتف</th>
                      <th>المستوى</th>
                      <th>عدد الكورسات</th>
                      <th>ملاحظات</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.id}>
                        <td className="font-semibold">{index + 1}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center">
                              <span className="text-white font-bold">
                                {student.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-semibold text-[var(--color-text-primary)]">
                              {student.name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[var(--color-text-muted)]" />
                            <span dir="ltr">{student.phone}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getLevelBadgeColor(student.level)}`}>
                            <GraduationCap className="w-3 h-3" />
                            {student.level || 'L1'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <span className="badge badge-info">
                              {student.courses_count || 0} كورس
                            </span>
                            {hasDualCourses(student.id) && (
                              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-semibold">
                                ثنائي
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-[var(--color-text-muted)] max-w-xs truncate">
                          {student.notes || '-'}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openModal(student)}
                              className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-primary-600"
                              title="تعديل"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(student.id)}
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
        title={editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">اسم الطالب *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="أدخل اسم الطالب"
              required
            />
          </div>

          <div>
            <label className="label">رقم الهاتف *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              placeholder="+964 7XX XXX XXXX"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="label">المستوى</label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              className="select"
            >
              {levels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input min-h-[100px]"
              placeholder="أضف أي ملاحظات عن الطالب..."
            />
          </div>

          {!editingStudent && (
            <>
              <div>
                <label className="label">الباقة</label>
                <select
                  value={formData.course_package_id}
                  onChange={(e) => handlePackageChange(e.target.value)}
                  className="select"
                >
                  <option value="">اختر الباقة</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.price} د.ع - {pkg.lectures_count} محاضرة)
                    </option>
                  ))}
                </select>
              </div>

              {formData.course_package_id && (
                <>
                  <div>
                    <label className="label">المبلغ المدفوع</label>
                    <input
                      type="number"
                      value={formData.paid_amount}
                      onChange={(e) => handlePaidAmountChange(e.target.value)}
                      className="input"
                      placeholder="أدخل المبلغ المدفوع"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="label">المبلغ المتبقي</label>
                    <input
                      type="text"
                      value={formData.remaining_amount ? `${formData.remaining_amount} د.ع` : '0.00 د.ع'}
                      className="input"
                      readOnly
                      style={{ backgroundColor: 'var(--color-bg-secondary)', cursor: 'not-allowed' }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={closeModal} className="btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جاري الحفظ...' : editingStudent ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Students;
