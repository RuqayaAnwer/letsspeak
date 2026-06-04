import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatTime12Hour } from '../../utils/timeFormat';
import { formatDate } from '../../utils/dateFormat';
import { formatCurrencyAmount } from '../../utils/currencyFormat';
import { ArrowRight, BookOpen, Calendar, Users, User, UserPlus, CreditCard } from 'lucide-react';
import Select from 'react-select';
import AsyncSelect from 'react-select/async';

const CreateCourse = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [isDual, setIsDual] = useState(false);

  // Add Student Modal State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentTarget, setAddStudentTarget] = useState(0); // 0 for Student 1, 1 for Student 2
  const [selectedLeadOption, setSelectedLeadOption] = useState(null);

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
    { value: 'L4', label: 'المستوى 4' },
    { value: 'L5', label: 'المستوى 5' },
    { value: 'L6', label: 'المستوى 6' },
    { value: 'L7', label: 'المستوى 7' },
    { value: 'L8', label: 'المستوى 8' },
  ];

  const [formData, setFormData] = useState({
    student_ids: ['', ''],
    trainer_id: '',
    course_package_id: '',
    lectures_count: '',
    start_date: '',
    lecture_time: '',
    lecture_days: [],
    paid_amount: '', // For single courses
    discount: '', // For single courses
    remaining_amount: '', // For single courses
    payment_method: '', // Payment method
    is_custom: false, // Custom package flag
    custom_total_amount: '', // Custom total amount
    student_payments: [
      { paid_amount: '', discount: '', remaining_amount: '' }, // Student 1
      { paid_amount: '', discount: '', remaining_amount: '' }, // Student 2
    ],
  });

  const daysOfWeek = [
    { value: 'Sunday', label: 'الأحد' },
    { value: 'Monday', label: 'الإثنين' },
    { value: 'Tuesday', label: 'الثلاثاء' },
    { value: 'Wednesday', label: 'الأربعاء' },
    { value: 'Thursday', label: 'الخميس' },
    { value: 'Friday', label: 'الجمعة' },
    { value: 'Saturday', label: 'السبت' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  // Handle pre-fill from location.state (redirected from Pipeline)
  useEffect(() => {
    if (location.state && students.length > 0 && packages.length > 0) {
      const { studentId, packageSelected } = location.state;
      const newIds = [...formData.student_ids];
      
      let updated = false;
      if (studentId && newIds[0] !== studentId) {
        newIds[0] = studentId;
        updated = true;
      }
      
      let selectedPkgId = formData.course_package_id;
      if (packageSelected) {
        const matchedPkg = packages.find(p => 
          p.name.toLowerCase().includes(packageSelected.toLowerCase()) || 
          packageSelected.toLowerCase().includes(p.name.toLowerCase())
        );
        if (matchedPkg && selectedPkgId !== matchedPkg.id.toString()) {
          selectedPkgId = matchedPkg.id.toString();
          updated = true;
        }
      }
      
      if (updated) {
        setFormData(prev => ({
          ...prev,
          student_ids: newIds,
          course_package_id: selectedPkgId
        }));
        if (selectedPkgId) {
          setTimeout(() => {
            handlePackageChange(selectedPkgId);
          }, 100);
        }
      }
    }
  }, [location.state, students, packages]);

  // Re-fetch packages when window gains focus (in case packages were updated in another tab/page)
  useEffect(() => {
    const handleFocus = () => {
      fetchData(true); // Skip loading state when refetching on focus
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchData = async (skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      const [studentsRes, trainersRes, packagesRes] = await Promise.all([
        api.get('/students?all=true'),
        api.get('/trainers-list'),
        api.get('/course-packages', { params: { _t: Date.now() } }), // Add timestamp to prevent caching
      ]);
      
      // Handle paginated response for students
      const studentsData = studentsRes.data?.data || studentsRes.data || [];
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      
      // Handle trainers response
      const trainersData = trainersRes.data?.data || trainersRes.data || [];
      setTrainers(Array.isArray(trainersData) ? trainersData : []);
      
      // Handle packages response
      const packagesData = packagesRes.data?.data || packagesRes.data || [];
      setPackages(Array.isArray(packagesData) ? packagesData : []);
      console.log('Packages fetched in CreateCourse:', packagesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      console.error('Error response:', error.response);
      if (!skipLoading) {
        alert('حدث خطأ أثناء تحميل البيانات: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  };

  // Helper function to parse amount input (handles 100.000 format)
  const parseAmountInput = (value) => {
    if (!value) return '';
    // Strip everything except numbers (because in IQD, dots like 100.000 mean 100,000)
    return value.replace(/[^\d]/g, '');
  };

  // Helper function to format amount for display in input (100000 -> 100.000)
  const formatAmountForInput = (value) => {
    if (!value && value !== 0) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    // Format with dots as thousands separator
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Get package price (multiply by 1000 if less than 1000 to match display format)
  const getPackagePrice = (packagePrice) => {
    if (!packagePrice && packagePrice !== 0) return 0;
    const price = parseFloat(packagePrice);
    // If price is less than 1000, multiply by 1000 (e.g., 225 -> 225000)
    // But if price is already >= 1000, use it as is
    return price < 1000 ? price * 1000 : price;
  };

  // Calculate price per student for dual courses
  const getStudentPrice = (packageName, isDual) => {
    if (!isDual) {
      // For single courses, return 0 (will use package price)
      return 0;
    }
    
    // For dual courses, each student pays a fixed amount based on package
    if (packageName?.includes('بمزاجي') || packageName === 'بمزاجي') {
      return 90000;
    } else if (packageName?.includes('توازن') || packageName?.includes('التوازن')) {
      return 135000;
    } else if (packageName?.includes('سرعة') || packageName?.includes('السرعة')) {
      return 225000;
    }
    
    // Fallback: Default to half the package price for any other package
    const packageObj = packages.find(p => p.name === packageName);
    if (packageObj) {
      return getPackagePrice(packageObj.price) / 2;
    }
    
    return 0;
  };

  const handlePackageChange = (packageId) => {
    const isCustom = packageId === 'custom';
    
    if (isCustom) {
      // Reset to custom mode
      setFormData({
        ...formData,
        course_package_id: '',
        is_custom: true,
        custom_total_amount: '',
        lectures_count: '',
        paid_amount: '',
        remaining_amount: '',
        student_payments: [
          { paid_amount: '', remaining_amount: '' },
          { paid_amount: '', remaining_amount: '' },
        ],
      });
      return;
    }
    
    // Regular package selection
    const selectedPackage = packages.find((p) => p.id.toString() === packageId);
    // يتم ملء عدد المحاضرات تلقائياً من الباقة المختارة
    const lecturesCount = selectedPackage ? selectedPackage.lectures_count.toString() : '';
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPrice(selectedPackage?.name, isDual);
    let packagePrice = 0;
    if (isDual && studentPrice > 0) {
      packagePrice = studentPrice;
    } else if (selectedPackage) {
      packagePrice = getPackagePrice(selectedPackage.price);
    }
    
    if (isDual) {
      // For dual courses, update remaining amounts for both students
      const updatedStudentPayments = formData.student_payments.map((studentPayment, index) => {
        const paidAmount = parseFloat(parseAmountInput(studentPayment.paid_amount)) || 0;
        const discountAmount = parseFloat(parseAmountInput(studentPayment.discount)) || 0;
        const remainingAmount = packagePrice - paidAmount - discountAmount;
        return {
          ...studentPayment,
          remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
        };
      });
      
      setFormData({
        ...formData,
        course_package_id: packageId,
        is_custom: false,
        custom_total_amount: '',
        lectures_count: lecturesCount,
        student_payments: updatedStudentPayments,
      });
    } else {
      // For single courses, use the old logic
      const paidAmount = parseFloat(parseAmountInput(formData.paid_amount)) || 0;
      const discountAmount = parseFloat(parseAmountInput(formData.discount)) || 0;
      const remainingAmount = packagePrice - paidAmount - discountAmount;
      
      setFormData({
        ...formData,
        course_package_id: packageId,
        is_custom: false,
        custom_total_amount: '',
        lectures_count: lecturesCount,
        remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
      });
    }
  };

  const handlePaidAmountChange = (value) => {
    // Parse the input (remove dots, convert to number)
    const parsedValue = parseAmountInput(value);
    const paidAmount = parseFloat(parsedValue) || 0;
    
    if (formData.is_custom) {
      // For custom package, calculate remaining from custom_total_amount
      const totalAmount = parseFloat(parseAmountInput(formData.custom_total_amount)) || 0;
      const discountAmount = parseFloat(parseAmountInput(formData.discount)) || 0;
      const remainingAmount = totalAmount - paidAmount - discountAmount;
      
      setFormData({
        ...formData,
        paid_amount: parsedValue,
        remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
      });
      return;
    }
    
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPrice(selectedPackage?.name, isDual);
    let packagePrice = 0;
    if (isDual && studentPrice > 0) {
      packagePrice = studentPrice;
    } else if (selectedPackage) {
      packagePrice = getPackagePrice(selectedPackage.price);
    }
    
    if (isDual) {
      // This should not be called for dual courses, but handle it just in case
      setFormData({
        ...formData,
        paid_amount: parsedValue,
      });
    } else {
      // For single courses
      const discountAmount = parseFloat(parseAmountInput(formData.discount)) || 0;
      const remainingAmount = packagePrice - paidAmount - discountAmount;
      
      setFormData({
        ...formData,
        paid_amount: parsedValue,
        remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
      });
    }
  };
  
  const handleCustomTotalAmountChange = (value) => {
    // Parse the input (remove dots, convert to number)
    const parsedValue = parseAmountInput(value);
    const totalAmount = parseFloat(parsedValue) || 0;
    
    if (isDual) {
      // For dual courses, update remaining amounts for both students
      const updatedStudentPayments = formData.student_payments.map((studentPayment, index) => {
        const paidAmount = parseFloat(parseAmountInput(studentPayment.paid_amount)) || 0;
        const discountAmount = parseFloat(parseAmountInput(studentPayment.discount)) || 0;
        const remainingAmount = totalAmount - paidAmount - discountAmount;
        return {
          ...studentPayment,
          remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
        };
      });
      
      setFormData({
        ...formData,
        custom_total_amount: parsedValue,
        student_payments: updatedStudentPayments,
      });
    } else {
      // For single courses
      const paidAmount = parseFloat(parseAmountInput(formData.paid_amount)) || 0;
      const discountAmount = parseFloat(parseAmountInput(formData.discount)) || 0;
      const remainingAmount = totalAmount - paidAmount - discountAmount;
      
      setFormData({
        ...formData,
        custom_total_amount: parsedValue,
        remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
      });
    }
  };

  // Handle paid amount change for a specific student in dual courses
  const handleStudentPaidAmountChange = (studentIndex, value) => {
    // Parse the input (remove dots, convert to number)
    const parsedValue = parseAmountInput(value);
    const paidAmount = parseFloat(parsedValue) || 0;
    
    if (formData.is_custom) {
      // For custom package, calculate remaining from custom_total_amount
      const totalAmount = parseFloat(parseAmountInput(formData.custom_total_amount)) || 0;
      const discountAmount = parseFloat(parseAmountInput(formData.student_payments[studentIndex].discount)) || 0;
      const remainingAmount = totalAmount - paidAmount - discountAmount;
      
      const updatedStudentPayments = [...formData.student_payments];
      updatedStudentPayments[studentIndex] = {
        ...updatedStudentPayments[studentIndex],
        paid_amount: parsedValue,
        remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
      };
      
      setFormData({
        ...formData,
        student_payments: updatedStudentPayments,
      });
      return;
    }
    
    const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
    const studentPrice = getStudentPrice(selectedPackage?.name, true); // Always true for dual courses
    
    const discountAmount = parseFloat(parseAmountInput(formData.student_payments[studentIndex].discount)) || 0;
    const remainingAmount = studentPrice - paidAmount - discountAmount;
    
    const updatedStudentPayments = [...formData.student_payments];
    updatedStudentPayments[studentIndex] = {
      ...updatedStudentPayments[studentIndex],
      paid_amount: parsedValue,
      remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
    };
    
    setFormData({
      ...formData,
      student_payments: updatedStudentPayments,
    });
  };

  const handleDiscountChange = (value) => {
    const parsedValue = parseAmountInput(value);
    const discountAmount = parseFloat(parsedValue) || 0;
    const paidAmount = parseFloat(parseAmountInput(formData.paid_amount)) || 0;
    
    let totalAmount = 0;
    if (formData.is_custom) {
      totalAmount = parseFloat(parseAmountInput(formData.custom_total_amount)) || 0;
    } else {
      const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
      totalAmount = selectedPackage ? getPackagePrice(selectedPackage.price) : 0;
    }

    const remainingAmount = totalAmount - paidAmount - discountAmount;

    setFormData({
      ...formData,
      discount: parsedValue,
      remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
    });
  };

  const handleStudentDiscountChange = (studentIndex, value) => {
    const parsedValue = parseAmountInput(value);
    const discountAmount = parseFloat(parsedValue) || 0;
    const paidAmount = parseFloat(parseAmountInput(formData.student_payments[studentIndex].paid_amount)) || 0;
    
    let totalAmount = 0;
    if (formData.is_custom) {
      totalAmount = parseFloat(parseAmountInput(formData.custom_total_amount)) || 0;
    } else {
      const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
      totalAmount = getStudentPrice(selectedPackage?.name, true);
    }

    const remainingAmount = totalAmount - paidAmount - discountAmount;

    const updatedStudentPayments = [...formData.student_payments];
    updatedStudentPayments[studentIndex] = {
      ...updatedStudentPayments[studentIndex],
      discount: parsedValue,
      remaining_amount: remainingAmount > 0 ? Math.floor(remainingAmount).toString() : '0',
    };

    setFormData({
      ...formData,
      student_payments: updatedStudentPayments,
    });
  };

  const toggleDay = (day) => {
    const days = formData.lecture_days.includes(day)
      ? formData.lecture_days.filter((d) => d !== day)
      : [...formData.lecture_days, day];
    setFormData({ ...formData, lecture_days: days });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare student_ids based on course type
      const studentIds = isDual 
        ? formData.student_ids.filter(id => id).map(id => parseInt(id))
        : [parseInt(formData.student_ids[0])];
      
      // Convert days from 'Sunday' format to 'sun' format for backend
      const dayMap = {
        'Sunday': 'sun',
        'Monday': 'mon',
        'Tuesday': 'tue',
        'Wednesday': 'wed',
        'Thursday': 'thu',
        'Friday': 'fri',
        'Saturday': 'sat',
      };
      const lectureDays = formData.lecture_days.map(day => dayMap[day] || day);

      // Validate required fields - for custom packages, course_package_id can be empty
      if (!formData.trainer_id || 
          (!formData.is_custom && !formData.course_package_id) || 
          (formData.is_custom && (!formData.custom_total_amount || !formData.lectures_count)) ||
          !formData.start_date || 
          !formData.lecture_time || 
          lectureDays.length === 0) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        setSubmitting(false);
        return;
      }

      const data = {
        trainer_id: parseInt(formData.trainer_id),
        // Only include course_package_id if not custom
        ...(formData.is_custom 
          ? {} 
          : { course_package_id: parseInt(formData.course_package_id) }
        ),
        lectures_count: formData.lectures_count ? parseInt(formData.lectures_count) : undefined,
        start_date: formData.start_date,
        lecture_time: formData.lecture_time,
        lecture_days: lectureDays,
        is_dual: isDual,
        student_ids: studentIds,
        payment_method: formData.payment_method,
        // Add custom package fields
        is_custom: formData.is_custom,
        ...(formData.is_custom && formData.custom_total_amount
          ? { custom_total_amount: parseFloat(parseAmountInput(formData.custom_total_amount)) }
          : {}
        ),
        // For single courses, use paid_amount
        // For dual courses, we'll create payments separately for each student
        paid_amount: isDual ? 0 : (formData.paid_amount ? parseFloat(formData.paid_amount) : 0),
        discount: isDual ? 0 : (formData.discount ? parseFloat(formData.discount) : 0),
        remaining_amount: isDual ? 0 : (formData.remaining_amount ? parseFloat(formData.remaining_amount) : 0),
        // For dual courses, include student payments
        student_payments: isDual ? formData.student_payments : null,
      };

      console.log('Sending course data:', data);
      const response = await api.post('/courses', data);
      console.log('Course created successfully:', response.data);
      navigate(`/courses/${response.data.id || response.data.data?.id}`);
    } catch (error) {
      console.error('Error creating course:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      // Show detailed error message
      let errorMessage = 'حدث خطأ أثناء إنشاء الكورس';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = Object.values(error.response.data.errors).flat();
        errorMessage = errors.join('\n');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    if (addingStudent) return; // Prevent double submission
    if (!selectedLeadOption) {
      alert('يرجى اختيار عميل أولاً');
      return;
    }
    
    setAddingStudent(true);
    
    try {
      const response = await api.post(`/leads/${selectedLeadOption.value}/convert`);
      
      // StudentController returns the student object directly
      const createdStudent = response.data.data || response.data.student;
      
      if (createdStudent && createdStudent.id) {
        alert('تم تحويل العميل إلى طالب بنجاح');
        
        // Force add the new student to our local state IMMEDIATELY so the dropdown can find them
        setStudents(prev => {
          const exists = prev.find(s => s.id === createdStudent.id);
          return exists ? prev : [createdStudent, ...prev];
        });
        
        // Auto select the new student
        const newIds = [...formData.student_ids];
        newIds[addStudentTarget] = createdStudent.id.toString();
        
        // Check if lead has a package_selected and try to pre-select it
        const leadPkg = selectedLeadOption.lead?.package_selected;
        let selectedPkgId = formData.course_package_id;
        if (leadPkg && packages.length > 0) {
          const matchedPkg = packages.find(p => 
            p.name.toLowerCase().includes(leadPkg.toLowerCase()) || 
            leadPkg.toLowerCase().includes(p.name.toLowerCase())
          );
          if (matchedPkg) {
            selectedPkgId = matchedPkg.id.toString();
          }
        }

        setFormData({ ...formData, student_ids: newIds, course_package_id: selectedPkgId });
        if (selectedPkgId) {
          setTimeout(() => {
            handlePackageChange(selectedPkgId);
          }, 100);
        }
        
        // Close modal and reset
        setIsAddStudentModalOpen(false);
        setSelectedLeadOption(null);
        
        // Quietly refresh the full list from server in the background
        api.get('/students?all=true').then(res => {
          const studentsList = res.data?.data || res.data || [];
          if (Array.isArray(studentsList)) {
            setStudents(prev => {
              const existsInNew = studentsList.find(s => s.id === createdStudent.id);
              return existsInNew ? studentsList : [createdStudent, ...studentsList];
            });
          }
        }).catch(err => console.error(err));
      }
    } catch (error) {
      console.error('Error adding student:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء إضافة الطالب');
    } finally {
      setAddingStudent(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  // Prepare options for react-select
  const studentOptions = students.map(student => ({
    value: student.id,
    label: `${student.name} - ${student.phone}`
  }));

  const trainerOptions = trainers.map(trainer => ({
    value: trainer.id,
    label: `${trainer.name || trainer.user?.name || 'مدرب غير محدد'} ${trainer.specialty ? `- ${trainer.specialty}` : ''}`
  }));

  // Custom styles for react-select to match our UI
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? '#14b8a6' : '#1e293b',
      boxShadow: state.isFocused ? '0 0 0 1px #14b8a6' : 'none',
      '&:hover': {
        borderColor: '#0d9488'
      },
      padding: '0.125rem',
      borderRadius: '0.5rem',
      backgroundColor: '#0f172a',
      color: '#f1f5f9'
    }),
    singleValue: (base) => ({
      ...base,
      color: '#f1f5f9'
    }),
    input: (base) => ({
      ...base,
      color: '#f1f5f9'
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? '#0d9488' 
        : state.isFocused 
          ? '#1e293b' 
          : '#0f172a',
      color: '#f1f5f9',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#0f766e'
      }
    }),
    menu: (base) => ({
      ...base,
      zIndex: 50,
      backgroundColor: '#0f172a',
      border: '1px solid #1e293b',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
    }),
    menuList: (base) => ({
      ...base,
      padding: 0
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: '#94a3b8'
    }),
    loadingMessage: (base) => ({
      ...base,
      color: '#94a3b8'
    })
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] relative z-10 mr-2 sm:mr-16 lg:mr-0"
        >
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div>
          <h1 className="page-title text-lg sm:text-2xl">إنشاء كورس جديد</h1>
          <p className="page-subtitle text-xs sm:text-sm">إعداد كورس جديد للطالب</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Course Type Selection */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mb-3 sm:mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500" />
            نوع الكورس
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsDual(false)}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                !isDual
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-[var(--color-border)] hover:border-primary-300'
              }`}
            >
              <User className={`w-8 h-8 ${!isDual ? 'text-primary-600' : 'text-gray-400'}`} />
              <span className={`font-bold ${!isDual ? 'text-primary-700 dark:text-primary-300' : ''}`}>
                كورس فردي
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">طالب واحد</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDual(true)}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                isDual
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-[var(--color-border)] hover:border-primary-300'
              }`}
            >
              <UserPlus className={`w-8 h-8 ${isDual ? 'text-primary-600' : 'text-gray-400'}`} />
              <span className={`font-bold ${isDual ? 'text-primary-700 dark:text-primary-300' : ''}`}>
                كورس ثنائي
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">طالبان اثنان</span>
            </button>
          </div>
        </div>

        {/* Student & Trainer Selection */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            المشاركون
          </h2>
          <div className="space-y-4">
            {/* Students */}
            <div className={`grid gap-3 sm:gap-4 ${isDual ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="label mb-0">{isDual ? 'الطالب الأول *' : 'الطالب *'}</label>
                  <button 
                    type="button" 
                    onClick={() => { setAddStudentTarget(0); setIsAddStudentModalOpen(true); }}
                    className="text-xs text-primary-600 hover:text-primary-800 font-bold flex items-center gap-1"
                  >
                    + إضافة طالب جديد
                  </button>
                </div>
                <Select
                  options={studentOptions.filter(o => o.value.toString() !== formData.student_ids[1])}
                  value={studentOptions.find(o => o.value.toString() === formData.student_ids[0]) || null}
                  onChange={(selected) => {
                    const newIds = [...formData.student_ids];
                    newIds[0] = selected ? selected.value.toString() : '';
                    setFormData({ ...formData, student_ids: newIds });
                  }}
                  isClearable
                  isSearchable
                  placeholder="ابحث واختر الطالب الأول..."
                  noOptionsMessage={() => "لا يوجد طلاب مطابقين للبحث"}
                  styles={selectStyles}
                  className="text-sm"
                />
              </div>

              {isDual && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="label mb-0">الطالب الثاني *</label>
                    <button 
                      type="button" 
                      onClick={() => { setAddStudentTarget(1); setIsAddStudentModalOpen(true); }}
                      className="text-xs text-primary-600 hover:text-primary-800 font-bold flex items-center gap-1"
                    >
                      + إضافة طالب جديد
                    </button>
                  </div>
                  <Select
                    options={studentOptions.filter(o => o.value.toString() !== formData.student_ids[0])}
                    value={studentOptions.find(o => o.value.toString() === formData.student_ids[1]) || null}
                    onChange={(selected) => {
                      const newIds = [...formData.student_ids];
                      newIds[1] = selected ? selected.value.toString() : '';
                      setFormData({ ...formData, student_ids: newIds });
                    }}
                    isClearable
                    isSearchable
                    placeholder="ابحث واختر الطالب الثاني..."
                    noOptionsMessage={() => "لا يوجد طلاب مطابقين للبحث"}
                    styles={selectStyles}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            {/* Trainer */}
            <div>
              <label className="label">المدرب *</label>
              <Select
                options={trainerOptions}
                value={trainerOptions.find(o => o.value.toString() === formData.trainer_id) || null}
                onChange={(selected) => setFormData({ ...formData, trainer_id: selected ? selected.value.toString() : '' })}
                isClearable
                isSearchable
                placeholder="ابحث واختر المدرب..."
                noOptionsMessage={() => "لا يوجد مدربين مطابقين للبحث"}
                styles={selectStyles}
                className="text-sm"
              />
            </div>

          </div>
        </div>

        {/* Course Details */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-500" />
            تفاصيل الكورس
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="label">الباقة *</label>
                <select
                  value={formData.is_custom ? 'custom' : formData.course_package_id}
                  onChange={(e) => handlePackageChange(e.target.value)}
                  className="select"
                  required
                >
                  <option value="">اختر الباقة</option>
                  <option value="custom">مخصص</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} {pkg.lectures_count > 0 ? `- ${pkg.lectures_count} محاضرة` : '- (عدد مفتوح)'} {pkg.price > 0 ? `(${pkg.price} د.ع)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">عدد المحاضرات *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.lectures_count}
                  onChange={(e) => setFormData({ ...formData, lectures_count: e.target.value })}
                  className="input"
                  placeholder={formData.is_custom ? "أدخل عدد المحاضرات" : "يتم تحديده من الباقة"}
                  required
                />
                {formData.course_package_id && !formData.is_custom && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    عدد المحاضرات الافتراضي من الباقة المختارة (يمكن تعديله)
                  </p>
                )}
                {formData.is_custom && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    أدخل عدد المحاضرات المطلوبة
                  </p>
                )}
              </div>
              
              {formData.is_custom && (
                <div className="col-span-2">
                  <label className="label">المبلغ المستحق (د.ع) *</label>
                  <input
                    type="text"
                    value={formatAmountForInput(formData.custom_total_amount)}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow only numbers and dots
                      if (value === '' || /^[\d.]+$/.test(value)) {
                        handleCustomTotalAmountChange(value);
                      }
                    }}
                    className="input"
                    placeholder="0"
                    required
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    أدخل المبلغ الإجمالي المستحق للكورس
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-500" />
            معلومات الدفع
          </h2>
          <div className="space-y-4">
            {isDual ? (
              // Dual course: Show payment info for each student
              <div className="space-y-6">
                {formData.student_ids.map((studentId, index) => {
                  const student = students.find(s => s.id.toString() === studentId);
                  const studentPayment = formData.student_payments[index] || { paid_amount: '', remaining_amount: '' };
                  
                  return (
                    <div key={index} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
                        {student ? `${student.name} - ${student.phone}` : `الطالب ${index + 1}`}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div>
                          <label className="label" htmlFor={`student-${index}-paid-amount`}>المبلغ المدفوع (د.ع)</label>
                          <input
                            type="text"
                            value={formatAmountForInput(studentPayment.paid_amount)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^[\d.]+$/.test(value)) {
                                handleStudentPaidAmountChange(index, value);
                              }
                            }}
                            className="input"
                            placeholder="0"
                            id={`student-${index}-paid-amount`}
                            name={`student-${index}-paid-amount`}
                          />
                        </div>

                        <div>
                          <label className="label" htmlFor={`student-${index}-discount`}>الخصم (د.ع)</label>
                          <input
                            type="text"
                            value={formatAmountForInput(studentPayment.discount)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^[\d.]+$/.test(value)) {
                                handleStudentDiscountChange(index, value);
                              }
                            }}
                            className="input text-red-500 border-red-200 focus:border-red-500 focus:ring-red-500/20"
                            placeholder="0"
                            id={`student-${index}-discount`}
                            name={`student-${index}-discount`}
                          />
                        </div>

                        <div>
                          <label className="label" htmlFor={`student-${index}-remaining-amount`}>المبلغ المتبقي (د.ع)</label>
                          <input
                            type="text"
                            value={formatAmountForInput(studentPayment.remaining_amount)}
                            className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                            placeholder="0"
                            readOnly
                            disabled
                            id={`student-${index}-remaining-amount`}
                            name={`student-${index}-remaining-amount`}
                          />
                          {formData.course_package_id && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              يتم حساب المتبقي تلقائياً حسب الباقة
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Single course: Show single payment info
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {(() => {
                   const pkg = packages.find(p => p.id.toString() === formData.course_package_id);
                   const basePrice = formData.is_custom 
                     ? (parseFloat(parseAmountInput(formData.custom_total_amount)) || 0)
                     : (pkg ? getPackagePrice(pkg.price) : 0);
                   const discount = parseFloat(parseAmountInput(formData.discount)) || 0;
                   const netPrice = Math.max(0, basePrice - discount);
                   
                   return (
                     <>
                        <div>
                          <label className="label">المبلغ الأصلي (د.ع)</label>
                          <input type="text" value={formatAmountForInput(basePrice)} className="input bg-[var(--color-bg-secondary)] cursor-not-allowed font-semibold text-gray-500 line-through" readOnly disabled />
                        </div>
                        <div>
                          <label className="label" htmlFor="discount-amount">الخصم (د.ع)</label>
                          <input
                            type="text"
                            value={formatAmountForInput(formData.discount)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^[\d.]+$/.test(value)) {
                                handleDiscountChange(value);
                              }
                            }}
                            className="input text-red-500 border-red-200 focus:border-red-500 focus:ring-red-500/20"
                            placeholder="0"
                            id="discount-amount"
                            name="discount-amount"
                          />
                        </div>
                        <div>
                          <label className="label text-green-700 dark:text-green-400">الإجمالي بعد الخصم</label>
                          <input type="text" value={formatAmountForInput(netPrice)} className="input bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 cursor-not-allowed font-bold" readOnly disabled />
                        </div>
                     </>
                   );
                })()}

                <div>
                  <label className="label" htmlFor="paid-amount">المبلغ المدفوع (د.ع)</label>
                  <input
                    type="text"
                    value={formatAmountForInput(formData.paid_amount)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^[\d.]+$/.test(value)) {
                        handlePaidAmountChange(value);
                      }
                    }}
                    className="input"
                    placeholder="0"
                    id="paid-amount"
                    name="paid-amount"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="remaining-amount">المبلغ المتبقي (د.ع)</label>
                  <input
                    type="text"
                    value={formatAmountForInput(formData.remaining_amount)}
                    className="input bg-[var(--color-bg-secondary)] cursor-not-allowed"
                    placeholder="0"
                    readOnly
                    disabled
                    id="remaining-amount"
                    name="remaining-amount"
                  />
                  {formData.course_package_id && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      يتم حساب المتبقي تلقائياً من سعر الباقة
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="label">طريقة الدفع</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="select"
              >
                <option value="zain_cash">زين كاش</option>
                <option value="qi_card">بطاقة كي</option>
                <option value="delivery">توصيل</option>
              </select>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            الجدول الزمني
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="label">تاريخ أول محاضرة *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="input"
                  placeholder="موعد أول محاضرة في الكورس"
                  required
                />
              </div>

              <div>
                <label className="label">وقت المحاضرة *</label>
                <input
                  type="time"
                  value={formData.lecture_time}
                  onChange={(e) => setFormData({ ...formData, lecture_time: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">أيام الدراسة *</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {daysOfWeek.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                      formData.lecture_days.includes(day.value)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-[var(--color-border)] hover:border-primary-300'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {formData.lecture_days.length === 0 && (
                <p className="text-sm text-red-500 mt-2">يرجى اختيار يوم واحد على الأقل</p>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        {formData.lectures_count && formData.start_date && formData.lecture_days.length > 0 && (
          <div className="card p-6 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
            <h3 className="font-bold text-primary-800 dark:text-primary-300 mb-2">
              معاينة الكورس
            </h3>
            <p className="text-sm text-primary-700 dark:text-primary-400">
              سيحتوي هذا الكورس على {formData.lectures_count} محاضرة، تبدأ من{' '}
              {formatDate(formData.start_date, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {formData.lecture_time && ` في الساعة ${formatTime12Hour(formData.lecture_time)}`}، أيام:{' '}
              {formData.lecture_days.map((d) => daysOfWeek.find((day) => day.value === d)?.label).join('، ')}.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={submitting || formData.lecture_days.length === 0 || (isDual && !formData.student_ids[1])}
            className="btn-primary"
          >
            {submitting ? 'جاري الإنشاء...' : 'إنشاء الكورس'}
          </button>
        </div>
      </form>

      {/* Add Student Modal */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !addingStudent && setIsAddStudentModalOpen(false)}
          />
          <div className="bg-[#0f172a] rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden relative z-[101] animate-scale-up border border-[var(--color-border)]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[#1e293b]">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                إضافة طالب جديد
              </h3>
              <button 
                onClick={() => setIsAddStudentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={addingStudent}
              >
                <div className="text-2xl leading-none">&times;</div>
              </button>
            </div>
            
            <form onSubmit={handleAddStudentSubmit} className="p-4 space-y-4">
              <div>
                <label className="label text-sm mb-1">ابحث عن العميل في مسار العملاء *</label>
                <AsyncSelect
                  cacheOptions
                  defaultOptions
                  loadOptions={loadLeads}
                  onChange={(selected) => setSelectedLeadOption(selected)}
                  placeholder="اكتب اسم العميل أو رقمه للبحث..."
                  noOptionsMessage={({ inputValue }) => !inputValue ? "اكتب للبحث..." : "لا يوجد عملاء مطابقين للبحث"}
                  loadingMessage={() => "جاري البحث..."}
                  styles={selectStyles}
                  className="text-sm"
                  isClearable
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  يجب أن يكون الطالب مسجلاً مسبقاً في مسار العملاء (Leads) قبل إضافته للكورس.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="btn-secondary flex-1"
                  disabled={addingStudent}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={addingStudent || !selectedLeadOption}
                >
                  {addingStudent ? 'جاري التحويل...' : 'تحويل وإضافة للكورس'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateCourse;
