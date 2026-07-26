import { useState, useEffect, useRef } from 'react';
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
  const lastFetchTimeRef = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [isDual, setIsDual] = useState(false);
  const [isKids, setIsKids] = useState(false);
  const [student1InputMode, setStudent1InputMode] = useState('select'); // 'select' or 'manual'
  const [student2InputMode, setStudent2InputMode] = useState('select'); // 'select' or 'manual'
  const [manualStudent1, setManualStudent1] = useState({
    name: '',
    phone: '',
    age: '',
    level: '',
    notes: '',
  });
  const [manualStudent2, setManualStudent2] = useState({
    name: '',
    phone: '',
    age: '',
    level: '',
    notes: '',
  });

  // Add Student Modal State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentTarget, setAddStudentTarget] = useState(0); // 0 for Student 1, 1 for Student 2
  const [selectedLeadOption, setSelectedLeadOption] = useState(null);
  const [directAdd, setDirectAdd] = useState(false);
  const [showSingleDiscount, setShowSingleDiscount] = useState(false);
  const [showDualDiscount, setShowDualDiscount] = useState([false, false]);
  const [newStudentData, setNewStudentData] = useState({
    name: '',
    phone: '',
    level: '',
    notes: '',
    is_child: false,
    age: '',
  });

  const openAddStudentModal = (targetIndex) => {
    setAddStudentTarget(targetIndex);
    setDirectAdd(false);
    setSelectedLeadOption(null);
    setNewStudentData({
      name: '',
      phone: '',
      level: '',
      notes: '',
      is_child: isKids,
      age: '',
    });
    setIsAddStudentModalOpen(true);
  };

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
      const { studentId, packageSelected, isKids: isKidsState } = location.state;
      const newIds = [...formData.student_ids];
      
      if (isKidsState !== undefined) {
        setIsKids(isKidsState);
      }
      
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
    // If background refetch (focus event), throttle it to once every 30 seconds
    if (skipLoading && Date.now() - lastFetchTimeRef.current < 30000) {
      return;
    }
    lastFetchTimeRef.current = Date.now();
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

  const handleCategoryChange = (kidsValue) => {
    setIsKids(kidsValue);
    setFormData(prev => ({
      ...prev,
      course_package_id: '',
      is_custom: false,
      custom_total_amount: '',
      lectures_count: '',
      paid_amount: '',
      discount: '',
      remaining_amount: '',
      student_payments: [
        { paid_amount: '', discount: '', remaining_amount: '' },
        { paid_amount: '', discount: '', remaining_amount: '' },
      ]
    }));
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
      // Create manual students if any, else use selected student IDs
      const studentIds = [];

      // Handle Student 1
      if (student1InputMode === 'manual') {
        if (!manualStudent1.name || !manualStudent1.phone) {
          alert('يرجى ملء الاسم ورقم الهاتف للطالب الأول');
          setSubmitting(false);
          return;
        }
        if (isKids && !manualStudent1.age) {
          alert('يرجى إدخال عمر الطفل الأول');
          setSubmitting(false);
          return;
        }
        const studentRes = await api.post('/students', {
          name: manualStudent1.name,
          phone: manualStudent1.phone,
          is_child: isKids,
          age: isKids && manualStudent1.age ? parseInt(manualStudent1.age) : null,
          level: isKids ? 'أطفال' : (manualStudent1.level || null),
          notes: manualStudent1.notes || '',
        });
        const createdStudent = studentRes.data;
        studentIds.push(createdStudent.id);
      } else {
        if (!formData.student_ids[0]) {
          alert('يرجى اختيار الطالب الأول');
          setSubmitting(false);
          return;
        }
        studentIds.push(parseInt(formData.student_ids[0]));
      }

      // Handle Student 2
      if (isDual) {
        if (student2InputMode === 'manual') {
          if (!manualStudent2.name || !manualStudent2.phone) {
            alert('يرجى ملء الاسم ورقم الهاتف للطالب الثاني');
            setSubmitting(false);
            return;
          }
          if (isKids && !manualStudent2.age) {
            alert('يرجى إدخال عمر الطفل الثاني');
            setSubmitting(false);
            return;
          }
          const studentRes = await api.post('/students', {
            name: manualStudent2.name,
            phone: manualStudent2.phone,
            is_child: isKids,
            age: isKids && manualStudent2.age ? parseInt(manualStudent2.age) : null,
            level: isKids ? 'أطفال' : (manualStudent2.level || null),
            notes: manualStudent2.notes || '',
          });
          const createdStudent = studentRes.data;
          studentIds.push(createdStudent.id);
        } else {
          if (!formData.student_ids[1]) {
            alert('يرجى اختيار الطالب الثاني');
            setSubmitting(false);
            return;
          }
          studentIds.push(parseInt(formData.student_ids[1]));
        }
      }
      
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
        is_kids: isKids,
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
    
    if (!directAdd && !selectedLeadOption) {
      alert('يرجى اختيار عميل أولاً');
      return;
    }
    
    setAddingStudent(true);
    
    try {
      let createdStudent = null;
      
      if (directAdd) {
        // Validate required fields
        if (!newStudentData.name || !newStudentData.phone) {
          alert('يرجى ملء الاسم ورقم الهاتف');
          setAddingStudent(false);
          return;
        }
        if (newStudentData.is_child && !newStudentData.age) {
          alert('يرجى إدخال عمر الطفل');
          setAddingStudent(false);
          return;
        }
        
        const response = await api.post('/students', {
          name: newStudentData.name,
          phone: newStudentData.phone,
          level: newStudentData.is_child ? 'أطفال' : (newStudentData.level || null),
          notes: newStudentData.notes || '',
          is_child: newStudentData.is_child,
          age: newStudentData.is_child ? parseInt(newStudentData.age) : null,
        });
        createdStudent = response.data;
      } else {
        // Convert Lead and pass child/age if provided
        const payload = {
          is_child: newStudentData.is_child,
          age: newStudentData.is_child && newStudentData.age ? parseInt(newStudentData.age) : null,
          level: newStudentData.is_child ? 'أطفال' : undefined,
        };
        const response = await api.post(`/leads/${selectedLeadOption.value}/convert`, payload);
        createdStudent = response.data.data || response.data.student;
      }
      
      if (createdStudent && createdStudent.id) {
        alert(directAdd ? 'تم إضافة الطالب بنجاح' : 'تم تحويل العميل إلى طالب بنجاح');
        
        // Force add the new student to our local state IMMEDIATELY so the dropdown can find them
        setStudents(prev => {
          const exists = prev.find(s => s.id === createdStudent.id);
          return exists ? prev : [createdStudent, ...prev];
        });
        
        // Auto select the new student
        const newIds = [...formData.student_ids];
        newIds[addStudentTarget] = createdStudent.id.toString();
        
        // Check if lead has a package_selected and try to pre-select it
        let selectedPkgId = formData.course_package_id;
        if (!directAdd) {
          const leadPkg = selectedLeadOption.lead?.package_selected;
          if (leadPkg && packages.length > 0) {
            const matchedPkg = packages.find(p => 
              p.name.toLowerCase().includes(leadPkg.toLowerCase()) || 
              leadPkg.toLowerCase().includes(p.name.toLowerCase())
            );
            if (matchedPkg) {
              selectedPkgId = matchedPkg.id.toString();
            }
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
        setDirectAdd(false);
        
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
  const studentOptions = students
    .filter(student => isKids ? student.is_child : !student.is_child)
    .map(student => ({
      value: student.id,
      label: `${student.name} - ${student.phone} ${student.is_child ? '👶' : ''}`
    }));

  const isKidsPackage = (pkg) => {
    const name = (pkg.name || '').toLowerCase();
    return name.includes('kids') || name.includes('أطفال') || name.includes('اطفال') || name.includes('طفل');
  };

  const filteredPackages = packages.filter(pkg => {
    if (isKids) {
      return isKidsPackage(pkg);
    } else {
      return !isKidsPackage(pkg);
    }
  });

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
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500" />
            تصنيف ونوع الكورس
          </h2>
          
          <div className="space-y-4">
            {/* Category Selector */}
            <div>
              <label className="label text-xs sm:text-sm font-bold text-[var(--color-text-muted)] mb-2">فئة الكورس *</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleCategoryChange(false)}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    !isKids
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-[var(--color-border)] hover:border-primary-300 text-gray-400'
                  }`}
                >
                  <span className="text-xl">🎓</span>
                  <span className="font-bold">كورس كبار (عادي)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange(true)}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    isKids
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300'
                      : 'border-[var(--color-border)] hover:border-pink-300 text-gray-400'
                  }`}
                >
                  <span className="text-xl">👶</span>
                  <span className="font-bold">كورس أطفال</span>
                </button>
              </div>
            </div>

            {/* Course Attendance Type Selector */}
            <div>
              <label className="label text-xs sm:text-sm font-bold text-[var(--color-text-muted)] mb-2">نوع الحضور *</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setIsDual(false)}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    !isDual
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-[var(--color-border)] hover:border-primary-300 text-gray-400'
                  }`}
                >
                  <User className={`w-5 h-5 ${!isDual ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span className="font-bold">كورس فردي</span>
                  <span className="text-xs opacity-75">(طالب واحد)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDual(true)}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    isDual
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-[var(--color-border)] hover:border-primary-300 text-gray-400'
                  }`}
                >
                  <UserPlus className={`w-5 h-5 ${isDual ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span className="font-bold">كورس ثنائي</span>
                  <span className="text-xs opacity-75">(طالبان اثنان)</span>
                </button>
              </div>
            </div>
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
            <div className={`grid gap-4 ${isDual ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Student 1 */}
              <div>
                <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                  <label className="label mb-0">{isDual ? 'الطالب الأول *' : 'الطالب *'}</label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setStudent1InputMode(student1InputMode === 'select' ? 'manual' : 'select')}
                      className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-bold flex items-center gap-1"
                    >
                      {student1InputMode === 'select' ? '✍️ إدخال يدوي سريع' : '🔍 اختيار من المسجلين'}
                    </button>
                    {student1InputMode === 'select' && (
                      <button 
                        type="button" 
                        onClick={() => openAddStudentModal(0)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-semibold flex items-center gap-1 border-r pr-2 border-gray-300 dark:border-gray-700"
                      >
                        + تحويل عميل
                      </button>
                    )}
                  </div>
                </div>

                {student1InputMode === 'select' ? (
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
                    placeholder={isKids ? "ابحث واختر الطفل الأول..." : "ابحث واختر الطالب الأول..."}
                    noOptionsMessage={() => isKids ? "لا يوجد أطفال مطابقين للبحث" : "لا يوجد طلاب مطابقين للبحث"}
                    styles={selectStyles}
                    className="text-sm"
                  />
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 space-y-3 mt-1 animate-fade-in">
                    <div className="text-xs font-bold text-teal-600 dark:text-teal-400 mb-1 flex items-center gap-1">
                      <span>✍️</span> إدخال بيانات الطالب {isDual && 'الأول'} يدوياً
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">الاسم الكامل *</label>
                        <input
                          type="text"
                          value={manualStudent1.name}
                          onChange={(e) => setManualStudent1({ ...manualStudent1, name: e.target.value })}
                          className="input text-sm"
                          placeholder={isKids ? "اسم الطفل" : "اسم الطالب"}
                          required={student1InputMode === 'manual'}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">رقم الهاتف *</label>
                        <input
                          type="tel"
                          value={manualStudent1.phone}
                          onChange={(e) => setManualStudent1({ ...manualStudent1, phone: e.target.value })}
                          className="input text-sm"
                          placeholder="رقم الهاتف"
                          dir="ltr"
                          required={student1InputMode === 'manual'}
                        />
                      </div>
                      {isKids && (
                        <div>
                          <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">عمر الطفل *</label>
                          <input
                            type="number"
                            value={manualStudent1.age}
                            onChange={(e) => setManualStudent1({ ...manualStudent1, age: e.target.value })}
                            className="input text-sm"
                            placeholder="مثال: 9"
                            min="1"
                            max="17"
                            required={student1InputMode === 'manual' && isKids}
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">المستوى</label>
                        {isKids ? (
                          <input
                            type="text"
                            value="أطفال"
                            className="input text-sm bg-[var(--color-bg-secondary)] cursor-not-allowed"
                            readOnly
                            disabled
                          />
                        ) : (
                          <select
                            value={manualStudent1.level}
                            onChange={(e) => setManualStudent1({ ...manualStudent1, level: e.target.value })}
                            className="select text-sm"
                          >
                            <option value="">اختر المستوى</option>
                            {levels.map((level) => (
                              <option key={level.value} value={level.value}>
                                {level.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">ملاحظات</label>
                        <textarea
                          value={manualStudent1.notes}
                          onChange={(e) => setManualStudent1({ ...manualStudent1, notes: e.target.value })}
                          className="input text-sm min-h-[60px]"
                          placeholder="ملاحظات إضافية..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Student 2 */}
              {isDual && (
                <div>
                  <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                    <label className="label mb-0">الطالب الثاني *</label>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setStudent2InputMode(student2InputMode === 'select' ? 'manual' : 'select')}
                        className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-bold flex items-center gap-1"
                      >
                        {student2InputMode === 'select' ? '✍️ إدخال يدوي سريع' : '🔍 اختيار من المسجلين'}
                      </button>
                      {student2InputMode === 'select' && (
                        <button 
                          type="button" 
                          onClick={() => openAddStudentModal(1)}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-semibold flex items-center gap-1 border-r pr-2 border-gray-300 dark:border-gray-700"
                        >
                          + تحويل عميل
                        </button>
                      )}
                    </div>
                  </div>

                  {student2InputMode === 'select' ? (
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
                      placeholder={isKids ? "ابحث واختر الطفل الثاني..." : "ابحث واختر الطالب الثاني..."}
                      noOptionsMessage={() => isKids ? "لا يوجد أطفال مطابقين للبحث" : "لا يوجد طلاب مطابقين للبحث"}
                      styles={selectStyles}
                      className="text-sm"
                    />
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 space-y-3 mt-1 animate-fade-in">
                      <div className="text-xs font-bold text-teal-600 dark:text-teal-400 mb-1 flex items-center gap-1">
                        <span>✍️</span> إدخال بيانات الطالب الثاني يدوياً
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">الاسم الكامل *</label>
                          <input
                            type="text"
                            value={manualStudent2.name}
                            onChange={(e) => setManualStudent2({ ...manualStudent2, name: e.target.value })}
                            className="input text-sm"
                            placeholder={isKids ? "اسم الطفل" : "اسم الطالب"}
                            required={student2InputMode === 'manual'}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">رقم الهاتف *</label>
                          <input
                            type="tel"
                            value={manualStudent2.phone}
                            onChange={(e) => setManualStudent2({ ...manualStudent2, phone: e.target.value })}
                            className="input text-sm"
                            placeholder="رقم الهاتف"
                            dir="ltr"
                            required={student2InputMode === 'manual'}
                          />
                        </div>
                        {isKids && (
                          <div>
                            <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">عمر الطفل *</label>
                            <input
                              type="number"
                              value={manualStudent2.age}
                              onChange={(e) => setManualStudent2({ ...manualStudent2, age: e.target.value })}
                              className="input text-sm"
                              placeholder="مثال: 9"
                              min="1"
                              max="17"
                              required={student2InputMode === 'manual' && isKids}
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">المستوى</label>
                          {isKids ? (
                            <input
                              type="text"
                              value="أطفال"
                              className="input text-sm bg-[var(--color-bg-secondary)] cursor-not-allowed"
                              readOnly
                              disabled
                            />
                          ) : (
                            <select
                              value={manualStudent2.level}
                              onChange={(e) => setManualStudent2({ ...manualStudent2, level: e.target.value })}
                              className="select text-sm"
                            >
                              <option value="">اختر المستوى</option>
                              {levels.map((level) => (
                                <option key={level.value} value={level.value}>
                                  {level.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold block text-gray-600 dark:text-gray-400 mb-1">ملاحظات</label>
                          <textarea
                            value={manualStudent2.notes}
                            onChange={(e) => setManualStudent2({ ...manualStudent2, notes: e.target.value })}
                            className="input text-sm min-h-[60px]"
                            placeholder="ملاحظات إضافية..."
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
                  {filteredPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} {pkg.lectures_count > 0 ? `- ${pkg.lectures_count} محاضرة` : '- (عدد مفتوح)'} {pkg.price > 0 ? `(${formatAmountForInput(getPackagePrice(pkg.price))} د.ع)` : ''}
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
          <div className="space-y-6">
            {isDual ? (
              // Dual course: Show payment info for each student
              <div className="space-y-6">
                {formData.student_ids.map((studentId, index) => {
                  const student = students.find(s => s.id.toString() === studentId);
                  const studentPayment = formData.student_payments[index] || { paid_amount: '', discount: '', remaining_amount: '' };
                  
                  // Calculate student price/packagePrice
                  const selectedPackage = packages.find((p) => p.id.toString() === formData.course_package_id);
                  let packagePrice = 0;
                  if (formData.is_custom) {
                    packagePrice = parseFloat(parseAmountInput(formData.custom_total_amount)) || 0;
                  } else if (selectedPackage) {
                    packagePrice = getStudentPrice(selectedPackage.name, true);
                  }

                  return (
                    <div key={index} className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-200/60 dark:border-blue-900/30">
                      <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-1.5">
                        <span>👤</span> {student ? `${student.name} - ${student.phone}` : `الطالب ${index + 1}`}
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* 1. المبلغ المدفوع */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="label mb-0 text-green-700 dark:text-green-400 font-bold" htmlFor={`student-${index}-paid-amount`}>المبلغ المدفوع (د.ع) *</label>
                            {packagePrice > 0 && (
                              <button
                                type="button"
                                onClick={() => handleStudentPaidAmountChange(index, packagePrice.toString())}
                                className="text-[10px] text-teal-600 hover:text-teal-800 dark:text-teal-400 font-bold underline focus:outline-none"
                              >
                                دفع كامل ({formatAmountForInput(packagePrice)})
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={formatAmountForInput(studentPayment.paid_amount)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^[\d.]+$/.test(value)) {
                                handleStudentPaidAmountChange(index, value);
                              }
                            }}
                            className="input bg-green-50/50 dark:bg-green-950/10 border-green-300 dark:border-green-800/80 text-green-700 dark:text-green-400 font-bold placeholder-green-400 focus:ring-green-500 focus:bg-white"
                            placeholder={packagePrice > 0 ? formatAmountForInput(packagePrice) : "0"}
                            id={`student-${index}-paid-amount`}
                            name={`student-${index}-paid-amount`}
                            required
                          />
                        </div>

                        {/* 2. المبلغ المتبقي */}
                        <div>
                          <label className="label text-gray-700 dark:text-slate-300 font-bold" htmlFor={`student-${index}-remaining-amount`}>المبلغ المتبقي (د.ع)</label>
                          <input
                            type="text"
                            value={formatAmountForInput(studentPayment.remaining_amount)}
                            className="input bg-[var(--color-bg-secondary)] border-gray-300 dark:border-gray-700/80 text-gray-700 dark:text-slate-300 cursor-not-allowed font-semibold"
                            placeholder="0"
                            readOnly
                            disabled
                            id={`student-${index}-remaining-amount`}
                            name={`student-${index}-remaining-amount`}
                          />
                        </div>

                        {/* 3. زر الخصم */}
                        <div className="flex items-end">
                          {!showDualDiscount[index] && (parseFloat(parseAmountInput(studentPayment.discount)) || 0) <= 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const newShow = [...showDualDiscount];
                                newShow[index] = true;
                                setShowDualDiscount(newShow);
                              }}
                              className="w-full py-2.5 px-4 rounded-lg border border-dashed border-red-300 hover:border-red-500 text-red-600 hover:text-red-700 bg-red-50/30 hover:bg-red-50/50 dark:bg-red-950/5 dark:hover:bg-red-950/10 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-250 cursor-pointer"
                            >
                              <span>🏷️</span> إضافة خصم مالي
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const newShow = [...showDualDiscount];
                                newShow[index] = false;
                                setShowDualDiscount(newShow);
                                handleStudentDiscountChange(index, ''); // reset discount if closed
                              }}
                              className="w-full py-2.5 px-4 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-250 cursor-pointer"
                            >
                              <span>❌</span> إلغاء الخصم
                            </button>
                          )}
                        </div>
                      </div>

                      {/* حقول الخصم الإضافية للطالب */}
                      {(showDualDiscount[index] || (parseFloat(parseAmountInput(studentPayment.discount)) || 0) > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/20 dark:bg-red-950/5 animate-fade-in mt-3">
                          <div>
                            <label className="label text-xs text-red-700 dark:text-red-400 font-bold" htmlFor={`student-${index}-discount`}>قيمة الخصم (د.ع) *</label>
                            <input
                              type="text"
                              value={formatAmountForInput(studentPayment.discount)}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^[\d.]+$/.test(value)) {
                                  handleStudentDiscountChange(index, value);
                                }
                              }}
                              className="input text-red-600 border-red-200 focus:border-red-500 focus:ring-red-500/20 text-xs py-2"
                              placeholder="0"
                              id={`student-${index}-discount`}
                              name={`student-${index}-discount`}
                            />
                          </div>

                          <div>
                            <label className="label text-xs text-gray-500">سعر الباقة المخصص للطالب (د.ع)</label>
                            <input type="text" value={formatAmountForInput(packagePrice)} className="input bg-[var(--color-bg-secondary)] cursor-not-allowed text-gray-400 text-xs py-2" readOnly disabled />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Single course: Show single payment info
              <div className="space-y-4">
                {(() => {
                  const pkg = packages.find(p => p.id.toString() === formData.course_package_id);
                  const basePrice = formData.is_custom 
                    ? (parseFloat(parseAmountInput(formData.custom_total_amount)) || 0)
                    : (pkg ? getPackagePrice(pkg.price) : 0);
                  const discount = parseFloat(parseAmountInput(formData.discount)) || 0;
                  const netPrice = Math.max(0, basePrice - discount);

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* 1. المبلغ المدفوع */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="label mb-0 text-green-700 dark:text-green-400 font-bold" htmlFor="paid-amount">المبلغ المدفوع (د.ع) *</label>
                            {basePrice > 0 && (
                              <button
                                type="button"
                                onClick={() => handlePaidAmountChange(basePrice.toString())}
                                className="text-[10px] text-teal-600 hover:text-teal-800 dark:text-teal-400 font-bold underline focus:outline-none"
                              >
                                دفع كامل ({formatAmountForInput(basePrice)})
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={formatAmountForInput(formData.paid_amount)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^[\d.]+$/.test(value)) {
                                handlePaidAmountChange(value);
                              }
                            }}
                            className="input bg-green-50/50 dark:bg-green-950/10 border-green-300 dark:border-green-800/80 text-green-700 dark:text-green-400 font-bold placeholder-green-400 focus:ring-green-500 focus:bg-white"
                            placeholder={basePrice > 0 ? formatAmountForInput(basePrice) : "0"}
                            id="paid-amount"
                            name="paid-amount"
                            required
                          />
                        </div>

                        {/* 2. المبلغ المتبقي */}
                        <div>
                          <label className="label text-gray-700 dark:text-slate-300 font-bold" htmlFor="remaining-amount">المبلغ المتبقي (د.ع)</label>
                          <input
                            type="text"
                            value={formatAmountForInput(formData.remaining_amount)}
                            className="input bg-[var(--color-bg-secondary)] border-gray-300 dark:border-gray-700/80 text-gray-700 dark:text-slate-300 cursor-not-allowed font-semibold"
                            placeholder="0"
                            readOnly
                            disabled
                            id="remaining-amount"
                            name="remaining-amount"
                          />
                        </div>

                        {/* 3. زر الخصم */}
                        <div className="flex items-end">
                          {!showSingleDiscount && discount <= 0 ? (
                            <button
                              type="button"
                              onClick={() => setShowSingleDiscount(true)}
                              className="w-full py-2.5 px-4 rounded-lg border border-dashed border-red-300 hover:border-red-500 text-red-600 hover:text-red-700 bg-red-50/30 hover:bg-red-50/50 dark:bg-red-950/5 dark:hover:bg-red-950/10 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-250 cursor-pointer"
                            >
                              <span>🏷️</span> إضافة خصم مالي
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setShowSingleDiscount(false);
                                handleDiscountChange(''); // clear discount if closed
                              }}
                              className="w-full py-2.5 px-4 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-250 cursor-pointer"
                            >
                              <span>❌</span> إلغاء الخصم
                            </button>
                          )}
                        </div>
                      </div>

                      {/* حقول الخصم الإضافية - تظهر عند التفعيل */}
                      {(showSingleDiscount || discount > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/20 dark:bg-red-950/5 animate-fade-in mt-3">
                          <div>
                            <label className="label text-xs text-gray-500">المبلغ الأصلي قبل الخصم (د.ع)</label>
                            <input type="text" value={formatAmountForInput(basePrice)} className="input bg-[var(--color-bg-secondary)] cursor-not-allowed text-gray-400 line-through text-xs py-2" readOnly disabled />
                          </div>
                          
                          <div>
                            <label className="label text-xs text-red-700 dark:text-red-400 font-bold" htmlFor="discount-amount">قيمة الخصم (د.ع) *</label>
                            <input
                              type="text"
                              value={formatAmountForInput(formData.discount)}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^[\d.]+$/.test(value)) {
                                  handleDiscountChange(value);
                                }
                              }}
                              className="input text-red-600 border-red-200 focus:border-red-500 focus:ring-red-500/20 text-xs py-2"
                              placeholder="0"
                              id="discount-amount"
                              name="discount-amount"
                            />
                          </div>

                          <div>
                            <label className="label text-xs text-green-700 dark:text-green-400 font-bold">الإجمالي بعد الخصم (د.ع)</label>
                            <input type="text" value={formatAmountForInput(netPrice)} className="input bg-green-50 dark:bg-green-900/10 border-green-200 text-green-700 dark:text-green-400 cursor-not-allowed font-bold text-xs py-2" readOnly disabled />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Payment Method */}
            <div className="pt-2">
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
            disabled={
              submitting || 
              formData.lecture_days.length === 0 || 
              (student1InputMode === 'select' && !formData.student_ids[0]) ||
              (isDual && student2InputMode === 'select' && !formData.student_ids[1]) ||
              (student1InputMode === 'manual' && (!manualStudent1.name || !manualStudent1.phone || (isKids && !manualStudent1.age))) ||
              (isDual && student2InputMode === 'manual' && (!manualStudent2.name || !manualStudent2.phone || (isKids && !manualStudent2.age)))
            }
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
            
            <form onSubmit={handleAddStudentSubmit} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Direct Add Checkbox */}
              <div className="flex items-center gap-2 pb-3 mb-2 border-b border-[var(--color-border)]">
                <input
                  type="checkbox"
                  id="directAdd"
                  checked={directAdd}
                  onChange={(e) => setDirectAdd(e.target.checked)}
                  className="checkbox w-4 h-4 text-teal-600 focus:ring-teal-500 rounded cursor-pointer"
                />
                <label htmlFor="directAdd" className="text-xs font-bold text-gray-300 cursor-pointer select-none">
                  إضافة طالب مباشرة (دون اختيار عميل من مسار العملاء)
                </label>
              </div>

              {/* Child and Age Selection */}
              <div className="flex flex-col gap-3 pb-3 mb-2 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isChild"
                    checked={newStudentData.is_child}
                    onChange={(e) => setNewStudentData({ ...newStudentData, is_child: e.target.checked })}
                    className="checkbox w-4 h-4 text-pink-600 focus:ring-pink-500 rounded cursor-pointer"
                  />
                  <label htmlFor="isChild" className="text-xs font-bold text-gray-300 cursor-pointer select-none">
                    تسجيل كطالب طفل 👶
                  </label>
                </div>
                
                {newStudentData.is_child && (
                  <div className="w-full animate-fade-in">
                    <label className="label text-xs">عمر الطفل بالسنوات *</label>
                    <input
                      type="number"
                      value={newStudentData.age}
                      onChange={(e) => setNewStudentData({ ...newStudentData, age: e.target.value })}
                      className="input text-sm"
                      placeholder="مثال: 9"
                      min="1"
                      max="17"
                      required
                    />
                  </div>
                )}
              </div>

              {!directAdd ? (
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
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="label text-xs">اسم الطالب *</label>
                    <input
                      type="text"
                      value={newStudentData.name}
                      onChange={(e) => setNewStudentData({ ...newStudentData, name: e.target.value })}
                      className="input text-sm"
                      placeholder="أدخل اسم الطالب"
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-xs">رقم الهاتف *</label>
                    <input
                      type="tel"
                      value={newStudentData.phone}
                      onChange={(e) => setNewStudentData({ ...newStudentData, phone: e.target.value })}
                      className="input text-sm"
                      placeholder="+964 7XX XXX XXXX"
                      dir="ltr"
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-xs">المستوى</label>
                    {newStudentData.is_child ? (
                      <input
                        type="text"
                        value="أطفال"
                        className="input text-sm bg-[var(--color-bg-secondary)] cursor-not-allowed"
                        readOnly
                        disabled
                      />
                    ) : (
                      <select
                        value={newStudentData.level}
                        onChange={(e) => setNewStudentData({ ...newStudentData, level: e.target.value })}
                        className="select text-sm"
                      >
                        <option value="">اختر المستوى</option>
                        {levels.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="label text-xs">ملاحظات</label>
                    <textarea
                      value={newStudentData.notes}
                      onChange={(e) => setNewStudentData({ ...newStudentData, notes: e.target.value })}
                      className="input text-sm min-h-[80px]"
                      placeholder="ملاحظات إضافية..."
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="btn-secondary flex-1 text-sm"
                  disabled={addingStudent}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 text-sm"
                  disabled={addingStudent || (!directAdd && !selectedLeadOption)}
                >
                  {addingStudent ? 'جاري الإضافة...' : (directAdd ? 'إضافة للكورس' : 'تحويل وإضافة للكورس')}
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
