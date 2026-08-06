import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, Trash2, Users, Phone, GraduationCap, ChevronLeft, ChevronRight, UserCircle } from 'lucide-react';
import AsyncSelect from 'react-select/async';

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'adult', 'child'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [directAdd, setDirectAdd] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [packages, setPackages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    level: '',
    notes: '',
    course_package_id: '',
    paid_amount: '',
    remaining_amount: '',
    payment_method: 'zain_cash',
    is_child: false,
    age: '',
  });
  const [selectedLeadOption, setSelectedLeadOption] = useState(null);

  useEffect(() => {
    if (selectedLeadOption && selectedLeadOption.lead) {
      const lead = selectedLeadOption.lead;
      const isLeadKids = (lead.source || '').toLowerCase().includes('kids') || 
                         (lead.package_selected || '').toLowerCase().includes('kids') ||
                         (lead.notes || '').toLowerCase().includes('kids') ||
                         (lead.current_level || '').toLowerCase().includes('kids') ||
                         (lead.source || '').toLowerCase().includes('اطفال') || 
                         (lead.package_selected || '').toLowerCase().includes('اطفال') ||
                         (lead.notes || '').toLowerCase().includes('اطفال') ||
                         (lead.current_level || '').toLowerCase().includes('اطفال');

      setFormData(prev => ({
        ...prev,
        name: lead.name || '',
        phone: lead.phone_whatsapp || '',
        level: lead.current_level || '',
        notes: lead.notes || '',
        is_child: isLeadKids,
        age: lead.age || '',
      }));
    }
  }, [selectedLeadOption]);

  const loadLeads = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const response = await api.get(`/leads?search=${inputValue}`);
      const leadsData = response.data?.leads?.data || [];
      return leadsData.map(lead => ({
        value: lead.id,
        label: `${lead.name} - ${lead.phone_whatsapp} (${lead.status === 'confirmed' ? 'مؤكد' : 'غير مؤكد'})`,
        lead: lead
      }));
    } catch (error) {
      console.error('Error fetching leads:', error);
      return [];
    }
  };

  const levels = [
    { value: 'L1', label: 'المستوى 1' },
    { value: 'L2', label: 'المستوى 2' },
    { value: 'L3', label: 'المستوى 3' },
    { value: 'L_PREP', label: 'المستوى التمهيدي' },
    { value: 'L4', label: 'المستوى 4' },
    { value: 'L5', label: 'المستوى 5' },
    { value: 'L6', label: 'المستوى 6' },
    { value: 'L7', label: 'المستوى 7' },
    { value: 'L8', label: 'المستوى 8' },
  ];
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(null); // Track which card's actions are open
  // Profile Modal State
  
  useEffect(() => {
    fetchPackages();
    fetchCourses();
  }, []);

  // Fetch whenever page, search, or filterType changes with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStudents(false, page);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, filterType, page]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterType]);

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

  const fetchStudents = async (showLoading = true, pageToFetch = page) => {
    if (showLoading) setLoading(true);
    try {
      const params = { page: pageToFetch };
      if (search) params.search = search;
      if (filterType === 'child') {
        params.is_child = true;
      } else if (filterType === 'adult') {
        params.is_child = false;
      }
      const response = await api.get('/students', { params });
      
      const studentsData = response.data?.data || response.data || [];
      if (!Array.isArray(studentsData)) {
        console.error('Invalid students data format:', studentsData);
        setStudents([]);
        setTotalPages(1);
        setTotalStudents(0);
      } else {
        setStudents(studentsData);
        setTotalPages(response.data?.last_page || 1);
        setTotalStudents(response.data?.total || studentsData.length);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      if (import.meta.env.DEV) {
        const { sampleStudents } = await import('../../data/sampleDashboardData');
        setStudents(sampleStudents);
        setTotalPages(1);
        setTotalStudents(sampleStudents.length);
      } else {
        setStudents([]);
        setTotalPages(1);
        setTotalStudents(0);
      }
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
      } else if (directAdd) {
        await api.post('/students', formData);
      } else {
        if (!selectedLeadOption) {
          alert('يرجى اختيار عميل أولاً');
          setSubmitting(false);
          return;
        }
        await api.post(`/leads/${selectedLeadOption.value}/convert`, {
          name: formData.name,
          phone: formData.phone,
          level: formData.is_child ? 'أطفال' : (formData.level || undefined),
          notes: formData.notes || undefined,
          is_child: formData.is_child,
          age: formData.is_child && formData.age ? parseInt(formData.age) : null,
        });
      }
      fetchStudents(false, page);
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
      fetchStudents(false, page);
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
    const paidAmount = parseFloat(value) || 0;
    
    setFormData({
      ...formData,
      paid_amount: value,
      remaining_amount: '',
    });
  };

  const openModal = (student = null) => {
    setSelectedLeadOption(null);
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name,
        phone: student.phone,
        level: student.level || '',
        notes: student.notes || '',
        course_package_id: '',
        paid_amount: '',
        remaining_amount: '',
        payment_method: 'zain_cash',
        is_child: student.is_child || false,
        age: student.age || '',
      });
    } else {
      setEditingStudent(null);
      setFormData({ 
        name: '', 
        phone: '', 
        level: '', 
        notes: '',
        course_package_id: '',
        paid_amount: '',
        remaining_amount: '',
        payment_method: 'zain_cash',
        is_child: false,
        age: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
    setSelectedLeadOption(null);
    setDirectAdd(false);
    setFormData({ 
      name: '', 
      phone: '', 
      level: '', 
      notes: '',
      course_package_id: '',
      paid_amount: '',
      remaining_amount: '',
      payment_method: 'zain_cash',
      is_child: false,
      age: '',
    });
  };

  const getLevelBadgeColor = (level) => {
    const colors = {
      L1: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      L2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      L3: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
      L_PREP: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      L4: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      L5: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      L6: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      L7: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      L8: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    };
    return colors[level] || colors.L1;
  };

  const getLevelLabel = (level) => {
    const labels = {
      L1: 'المستوى 1',
      L2: 'المستوى 2',
      L3: 'المستوى 3',
      L_PREP: 'المستوى التمهيدي',
      L4: 'المستوى 4',
      L5: 'المستوى 5',
      L6: 'المستوى 6',
      L7: 'المستوى 7',
      L8: 'المستوى 8',
    };
    return labels[level] || level;
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

      {/* Search & Filters */}
      <div className="card p-4 space-y-4">
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
        
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3 flex-wrap">
          <span className="text-xs text-[var(--color-text-muted)] ml-2">تصنيف الطلاب:</span>
          <div className="flex bg-[var(--color-bg-secondary)] p-1 rounded-lg border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterType === 'all'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setFilterType('adult')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterType === 'adult'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              كبار
            </button>
            <button
              type="button"
              onClick={() => setFilterType('child')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                filterType === 'child'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              أطفال 👶
            </button>
          </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
              {students.map((student, index) => {
                const displayIndex = (page - 1) * 15 + index + 1;
                return (
                  <div key={student.id} className="relative">
                    <div 
                      onClick={() => setMobileActionsOpen(student.id)}
                      className={`p-2.5 rounded-lg border-2 sm:cursor-default cursor-pointer transition-colors sm:hover:border-gray-200 sm:dark:hover:border-gray-700 ${
                        student.is_child 
                          ? 'border-pink-300 dark:border-pink-900 bg-pink-50/40 dark:bg-pink-950/10 hover:border-pink-400' 
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-primary-400 dark:hover:border-primary-600'
                      }`}
                    >
                      <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">اسم الطالب</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 ml-1">{displayIndex}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate('/students/' + student.id); }}
                            className="text-sm font-semibold text-gray-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors flex items-center gap-1"
                          >
                            {student.name} {student.is_child && <span className="text-[10px] bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-1.5 py-0.5 rounded-full font-bold">👶 طفل</span>}
                          </button>
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
                        {student.level ? (
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${getLevelBadgeColor(student.level)}`}>
                            <GraduationCap className="w-3 h-3" />
                            {getLevelLabel(student.level)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">غير مححدد</span>
                        )}
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
                      
                      {/* Actions - Hidden on mobile, shown on larger screens */}
                      <div className="hidden sm:flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-gray-600">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">الإجراءات</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(student);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 hover:text-primary-600"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(student.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-600"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Mobile Actions Menu */}
                    {mobileActionsOpen === student.id && (
                      <>
                        {/* Backdrop */}
                        <div 
                          className="sm:hidden fixed inset-0 bg-black/50 z-40"
                          onClick={() => setMobileActionsOpen(null)}
                        />
                        
                        {/* Actions Menu */}
                        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl z-50 p-4 space-y-2">
                          <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
                          
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{student.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400" dir="ltr">{student.phone}</p>
                          </div>
                          
                          <button
                            onClick={() => {
                              setMobileActionsOpen(null);
                              openModal(student);
                            }}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                            تعديل الطالب
                          </button>
                          
                          <button
                            onClick={() => {
                              setMobileActionsOpen(null);
                              handleDelete(student.id);
                            }}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                            حذف الطالب
                          </button>
                          
                          <button
                            onClick={() => setMobileActionsOpen(null)}
                            className="w-full p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            إلغاء
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>اسم الطالب</th>
                    <th>المحافظة</th>
                    <th>العمر</th>
                    <th>رقم الهاتف</th>
                    <th>المستوى</th>
                    <th>عدد الكورسات</th>
                    <th>ملاحظات</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.id} className={student.is_child ? 'bg-pink-50/30 dark:bg-pink-950/10 border-r-4 border-pink-500' : ''}>
                      <td className="font-semibold">{(page - 1) * 15 + index + 1}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center ${student.is_child ? 'from-pink-400 to-orange-400' : 'from-primary-400 to-accent-400'}`}>
                              <span className="text-white font-bold">
                                {student.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigate('/students/' + student.id); }}
                                className="font-semibold text-[var(--color-text-primary)] hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors flex items-center gap-1"
                                title="عرض ملف الطالب"
                              >
                                {student.name} <UserCircle className="w-4 h-4 opacity-70" />
                              </button>
                              {student.is_child && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                                  👶 طفل
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {student.lead?.governorate ? (
                            <span className="text-sm">{student.lead.governorate}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td>
                          {student.age || student.lead?.age ? (
                            <span className="text-sm">{student.age || student.lead.age} سنة</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[var(--color-text-muted)]" />
                            <span dir="ltr">{student.phone}</span>
                          </div>
                        </td>
                        <td>
                          {student.level ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getLevelBadgeColor(student.level)}`}>
                              <GraduationCap className="w-3 h-3" />
                              {getLevelLabel(student.level)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">غير محدد</span>
                          )}
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

      {/* Student Profile Modal */}
      
      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingStudent && (
            <div className="flex items-center gap-2 pb-3 mb-2 border-b border-[var(--color-border)]">
              <input
                type="checkbox"
                id="directAdd"
                checked={directAdd}
                onChange={(e) => setDirectAdd(e.target.checked)}
                className="checkbox w-4 h-4 text-teal-600 focus:ring-teal-500 rounded cursor-pointer"
              />
              <label htmlFor="directAdd" className="text-xs font-bold text-gray-700 dark:text-slate-300 cursor-pointer select-none">
                إضافة طالب مباشرة (دون اختيار عميل من مسار العملاء)
              </label>
            </div>
          )}

          {(editingStudent || directAdd) && (
            <div className="flex flex-col gap-3 pb-3 mb-2 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isChild"
                  checked={formData.is_child}
                  onChange={(e) => setFormData({ ...formData, is_child: e.target.checked })}
                  className="checkbox w-4 h-4 text-pink-600 focus:ring-pink-500 rounded cursor-pointer"
                />
                <label htmlFor="isChild" className="text-xs font-bold text-gray-700 dark:text-slate-300 cursor-pointer select-none">
                  تسجيل كطالب طفل 👶
                </label>
              </div>
              
              {formData.is_child && (
                <div className="w-full animate-fade-in">
                  <label className="label text-xs">عمر الطفل بالسنوات *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="input text-sm"
                    placeholder="مثال: 9"
                    min="1"
                    max="17"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {!editingStudent && !directAdd && (
            <div className="mb-4">
              <label className="label text-sm mb-1">ابحث عن العميل في مسار العملاء *</label>
              <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={loadLeads}
                onChange={(selected) => setSelectedLeadOption(selected)}
                placeholder="اكتب اسم العميل أو رقمه للبحث..."
                noOptionsMessage={({ inputValue }) => !inputValue ? "اكتب للبحث..." : "لا يوجد عملاء مطابقين للبحث"}
                loadingMessage={() => "جاري البحث..."}
                className="text-sm"
                isClearable
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                يجب أن يكون الطالب مسجلاً مسبقاً في مسار العملاء (Leads).
              </p>
            </div>
          )}

          {(editingStudent || directAdd || selectedLeadOption) && (
            <>
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
                  <option value="">اختر المستوى</option>
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
