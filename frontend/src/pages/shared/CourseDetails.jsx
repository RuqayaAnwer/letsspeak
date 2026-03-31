// Updated: 2025-12-21 - Added trainer payment column in lectures table
// Status change confirmation modal with logging
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDateShort } from '../../utils/dateFormat';
import { formatCurrency } from '../../utils/currencyFormat';
import {
  ArrowRight,
  User,
  GraduationCap,
  Calendar,
  Save,
  X,
  AlertCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Trash2,
  PlayCircle,
  PlusCircle,
  Check, CreditCard, Activity, Flag, FileText, Upload, Eye, EyeOff, UserCircle
} from 'lucide-react';
import PackageBadge from '../../components/PackageBadge';
import StudentProfileModal from '../../components/StudentProfileModal';

/**
 * CourseDetails Component
 * 
 * Displays course information and lecture schedule.
 * Supports lecture postponement with the following workflow:
 * 
 * POSTPONEMENT LOGIC:
 * When a lecture is postponed:
 * 1. The original lecture is NOT deleted - only marked as postponed
 * 2. A NEW makeup lecture is created with the chosen date/time
 * 3. Time conflicts are checked before allowing postponement
 * 4. This preserves the original schedule for history and reporting
 */
const CourseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isCustomerService, isAccounting, isTrainer, user } = useAuth();
  
  // Helper function to get package name (handles custom packages)
  const getPackageName = (course) => {
    if (course?.is_custom) return 'مخصص';
    return course?.course_package?.name || course?.coursePackage?.name || 'كورس بدون باقة';
  };

  // تنسيق أيام المحاضرات للعرض (أحد، ثلاثاء، خميس)
  const formatLectureDays = (days) => {
    if (!days || (Array.isArray(days) && days.length === 0)) return '—';
    const daysMap = { sun: 'أحد', mon: 'اثنين', tue: 'ثلاثاء', wed: 'أربعاء', thu: 'خميس', fri: 'جمعة', sat: 'سبت' };
    const order = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const arr = Array.isArray(days) ? [...days] : [days];
    const sorted = arr.slice().sort((a, b) => {
      const keyA = String(a).trim().toLowerCase().slice(0, 3);
      const keyB = String(b).trim().toLowerCase().slice(0, 3);
      const iA = order.indexOf(keyA);
      const iB = order.indexOf(keyB);
      return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
    });
    return sorted.map((d) => daysMap[String(d).trim().toLowerCase().slice(0, 3)] || String(d)).join('، ');
  };

  // ترتيب المحاضرات حسب التاريخ ثم الوقت (المحاضرة التعويضية تظهر في مكانها الزمني)
  const sortLecturesByDate = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return [...list].sort((a, b) => {
      const dA = a.date ? new Date(a.date).getTime() : 0;
      const dB = b.date ? new Date(b.date).getTime() : 0;
      if (dA !== dB) return dA - dB;
      const tA = (a.time || '').slice(0, 5);
      const tB = (b.time || '').slice(0, 5);
      return tA.localeCompare(tB);
    });
  };

  // محاضرة أصلية مؤجلة (لم تعد تُعقد في هذا الموعد؛ تظهر للسجل فقط)
  const isPostponedOriginal = (lecture) =>
    ['postponed_by_trainer', 'postponed_by_student', 'postponed_holiday'].includes(lecture?.attendance);
  
  const [course, setCourse] = useState(null);
  const [lectures, setLectures] = useState([]);
  const sortedLectures = useMemo(() => sortLecturesByDate(lectures), [lectures]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedLectures, setEditedLectures] = useState({});
  
  // Postponement modal state
  const [postponeModal, setPostponeModal] = useState({ 
    open: false, 
    lectureId: null, 
    reason: '', 
    selectedType: null,
    newDate: '',
    newTime: '',
    checking: false,
    conflicts: [],
    error: null,
    forceOverride: false,
  });
  
  // Reason popup state
  const [reasonPopup, setReasonPopup] = useState({ open: false, reason: '' });
  
  // Notes modal state
  const [notesModal, setNotesModal] = useState({ open: false, lectureId: null, notes: '' });
  
  // Postponement stats state
  const [postponementStats, setPostponementStats] = useState(null);
  
  // Edit days modal state
  const [editDaysModal, setEditDaysModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  
  // Selected lecture for editing date/time
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [editingLectureDateTime, setEditingLectureDateTime] = useState({ date: '', time: '' });
  
  // Selected student for dual courses (to show their attendance data)
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  
  // Status change confirmation modal
  const [statusChangeModal, setStatusChangeModal] = useState({
    open: false,
    newStatus: null,
    reason: '',
  });
  const statusSelectRef = useRef(null);
  
  // Evaluation modal state (for trainer)
  const [evaluationModal, setEvaluationModal] = useState({
    open: false,
    milestone: 0,
    completedLectures: 0,
  });

  // Renewal reset modal state
  const [renewalResetModal, setRenewalResetModal] = useState({
    open: false,
    start_date: '',
    course_package_id: '',
    lectures_count: '',
    lecture_time: '',
    lecture_days: [],
    paid_amount: '',
    remaining_amount: '',
    student_ids: [],
  });

  // Profile Modal State
  const [profileModalStudentId, setProfileModalStudentId] = useState(null);

  // تفعيل بدء الكورس الفعلي (للمدرب)
  const [startingCourse, setStartingCourse] = useState(false);
  const [startCourseModal, setStartCourseModal] = useState({
    open: false,
    date: new Date().toISOString().split('T')[0]
  });

  // Extra lectures modal (Customer service)
  const [extraLecturesModal, setExtraLecturesModal] = useState({ 
    open: false, count: 1, fee: 0, isPaid: true, paymentMethod: 'cash', saving: false 
  });

  // Packages and trainers for renewal reset modal
  const [packages, setPackages] = useState([]);
  const [trainers, setTrainers] = useState([]);

  /**
   * Check if a lecture can be modified based on its date/time.
   * - Future lectures: Cannot be modified
   * - Today's lectures: Can be modified (regardless of time)
   * - Past lectures: Can be modified
   */
  const canModifyLecture = (lecture) => {
    // For postponement, users frequently need to edit future lectures.
    // Instead of locking the UI, we'll allow selection.
    // Time validation can be enforced by the backend or specific actions if needed.
    const lectureDate = new Date(lecture.date);
    lectureDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      canModify: true,
      reason: null,
      type: lectureDate > today ? 'future' : (lectureDate.getTime() === today.getTime() ? 'today' : 'past')
    };
  };

  useEffect(() => {
    fetchCourse();
  }, [id]);

  useEffect(() => {
    if (isCustomerService) {
      fetchPackagesAndTrainers();
    }
  }, [isCustomerService]);

  // Fetch packages and trainers for renewal reset modal
  const fetchPackagesAndTrainers = async () => {
    try {
      const [packagesRes, trainersRes] = await Promise.all([
        api.get('/course-packages'),
        api.get('/trainers-list'),
      ]);
      
      const packagesData = packagesRes.data?.data || packagesRes.data || [];
      setPackages(Array.isArray(packagesData) ? packagesData : []);
      
      const trainersData = trainersRes.data?.data || trainersRes.data || [];
      setTrainers(Array.isArray(trainersData) ? trainersData : []);
    } catch (error) {
      console.error('Error fetching packages and trainers:', error);
    }
  };

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${id}`);
      setCourse(response.data);
      setLectures(sortLecturesByDate(response.data.lectures || []));
      
      // Debug: Log course students
      console.log('Course fetched:', {
        id: response.data.id,
        is_dual: response.data.is_dual,
        students_count: response.data.students?.length || 0,
        students: response.data.students?.map(s => ({ id: s.id, name: s.name })) || []
      });
      
      // Set default selected student for dual courses
      if (response.data.is_dual && response.data.students?.length > 0) {
        setSelectedStudentId(response.data.students[0]?.id);
      }
      
      // Check for evaluation milestone (for trainers only)
      if (isTrainer && response.data) {
        checkEvaluationMilestone(response.data);
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      
      // If unauthorized (403), show error and redirect
      if (error.response?.status === 403) {
        alert('غير مصرح - هذا الكورس ليس من كورساتك');
        navigate('/courses');
      } else {
        navigate(-1);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle course deletion
  const handleDeleteCourse = async () => {
    if (!course) return;

    const courseName = getPackageName(course);
    const studentNames = course?.students?.map(s => s.name).join(' و ') || course?.student_name || 'غير محدد';
    
    if (!confirm(`هل أنت متأكد من حذف ${courseName} للطالب/الطلاب: ${studentNames}؟\n\nتحذير: سيتم حذف الكورس وجميع المحاضرات المرتبطة به بشكل نهائي!`)) {
      return;
    }

    try {
      await api.delete(`/courses/${course.id}`);
      alert('تم حذف الكورس بنجاح');
      navigate('/courses'); // Navigate back to courses list
    } catch (error) {
      console.error('Error deleting course:', error);
      const errorMessage = error.response?.data?.message || error.message || 'حدث خطأ أثناء حذف الكورس';
      alert(`فشل حذف الكورس: ${errorMessage}`);
    }
  };

  // تفعيل بدء الكورس الفعلي (للمدرب أو خدمة العملاء)
  const handleStartCourse = async () => {
    if (!course?.id) return;
    
    // If modal is not open, open it instead of starting immediately
    if (!startCourseModal.open) {
      setStartCourseModal({
        open: true,
        date: new Date().toISOString().split('T')[0]
      });
      return;
    }

    if (!startCourseModal.date) {
      alert('يرجى اختيار تاريخ البدء الفعلي');
      return;
    }

    try {
      setStartingCourse(true);
      const res = await api.put(`/courses/${course.id}/actual-start`, {
        actual_start_date: startCourseModal.date
      });
      if (res.data) {
        setCourse(res.data);
        if (res.data.lectures) setLectures(sortLecturesByDate(res.data.lectures));
        setStartCourseModal({ open: false, date: '' });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'فشل تفعيل بدء الكورس');
    } finally {
      setStartingCourse(false);
    }
  };

  /**
   * Handle adding extra lectures
   */
  const handleAddExtraLectures = async () => {
    if (extraLecturesModal.count < 1) {
      alert('يجب أن يكون العدد 1 على الأقل');
      return;
    }
    setExtraLecturesModal(prev => ({ ...prev, saving: true }));
    try {
      const response = await api.post(`/courses/${id}/add-extra-lectures`, {
        count: extraLecturesModal.count,
        fee: extraLecturesModal.fee,
        is_paid: extraLecturesModal.isPaid,
        payment_method: extraLecturesModal.isPaid ? extraLecturesModal.paymentMethod : null,
      });
      if (response.data.success) {
        alert('تم إضافة المحاضرات الإضافية بنجاح');
        setExtraLecturesModal({ open: false, count: 1, fee: 0, isPaid: true, paymentMethod: 'cash', saving: false });
        fetchCourse();
      } else {
        alert(response.data.message || 'حدث خطأ');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'حدث خطأ أثناء الإضافة');
    } finally {
      setExtraLecturesModal(prev => ({ ...prev, saving: false }));
    }
  };

  /**
   * Handle lecture field changes.
   * If 'postponed' is selected, opens the postponement modal.
   * For dual courses, tracks student-specific attendance changes.
   * Auto-completes lecture when attendance is set to 'present' or 'absent'.
   */
  const handleLectureChange = (lectureId, field, value) => {
    // Check if lecture can be modified
    const lecture = lectures.find(l => l.id === lectureId);
    if (lecture) {
      const modifyStatus = canModifyLecture(lecture);
      if (!modifyStatus.canModify) {
        alert(modifyStatus.reason);
        return;
      }
    }
    
    // If "postponed" is selected, open the postponement modal with date/time picker
    if (field === 'attendance' && value === 'postponed') {
      const lecture = lectures.find(l => l.id === lectureId);
      const defaultTime = lecture?.time || course?.lecture_time || '14:00';
      
      // Calculate default new date (next available date)
      const today = new Date();
      const defaultDate = new Date(today);
      defaultDate.setDate(defaultDate.getDate() + 1);
      
      setPostponeModal({ 
        open: true, 
        lectureId, 
        reason: '', 
        selectedType: null,
        newDate: defaultDate.toISOString().split('T')[0],
        newTime: defaultTime,
        checking: false,
        conflicts: [],
        error: null,
      });
      
      // Fetch postponement stats
      fetchPostponementStats(lectureId);
      return;
    }
    
    // Auto-complete lecture when attendance is set to 'present' or 'absent'
    const shouldAutoComplete = field === 'attendance' && (value === 'present' || value === 'absent');
    
    // For dual courses, track student-specific attendance
    const isDualCourse = course?.is_dual;
    const hasSelectedStudent = !!selectedStudentId;
    const isStudentField = ['attendance', 'activity', 'homework'].includes(field);
    
    if (isDualCourse && hasSelectedStudent && isStudentField) {
      setEditedLectures((prev) => {
        const existingLecture = prev[lectureId] || {};
        const existingStudentAttendance = existingLecture.student_attendance || {};
        
        // Convert studentId to string to ensure consistent key format
        const studentIdKey = String(selectedStudentId);
        const existingStudentData = existingStudentAttendance[studentIdKey] || {};
        
        const newStudentAttendance = {
          ...existingStudentAttendance,
          [studentIdKey]: {
            ...existingStudentData,
            [field]: value,
          },
        };
        
        console.log('Dual course - Updating student attendance:', {
          lectureId,
          selectedStudentId,
          studentIdKey,
          field,
          value,
          existingStudentAttendance,
          newStudentAttendance
        });
        
        return {
          ...prev,
          [lectureId]: {
            ...existingLecture,
            id: lectureId,
            // Auto-complete lecture when attendance is present or absent
            ...(shouldAutoComplete ? { is_completed: true } : {}),
            student_attendance: newStudentAttendance,
          },
        };
      });
    } else {
      setEditedLectures((prev) => ({
        ...prev,
        [lectureId]: {
          ...prev[lectureId],
          id: lectureId,
          [field]: value,
          // Auto-complete lecture when attendance is present or absent
          ...(shouldAutoComplete ? { is_completed: true } : {}),
        },
      }));
    }
  };

  /**
   * Fetch postponement statistics for the course
   */
  const fetchPostponementStats = async (lectureId) => {
    try {
      const response = await api.get(`/lectures/${lectureId}/postponement-stats`);
      if (response.data.success) {
        setPostponementStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching postponement stats:', error);
    }
  };

  /**
   * Cancel a postponement and delete the makeup lecture
   */
  const handleCancelPostponement = async (lectureId) => {
    if (!confirm('هل أنت متأكد من إلغاء التأجيل؟ سيتم حذف المحاضرة التعويضية.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await api.post(`/lectures/${lectureId}/cancel-postponement`);
      
      if (response.data.success) {
        // Refresh lectures to show updated data
        fetchCourse();
        alert('تم إلغاء التأجيل وحذف المحاضرة التعويضية بنجاح');
      } else {
        alert(response.data.message || 'حدث خطأ أثناء إلغاء التأجيل');
      }
    } catch (error) {
      console.error('Error cancelling postponement:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء إلغاء التأجيل');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Check for time conflicts before postponing
   */
  const checkConflicts = async () => {
    if (!postponeModal.newDate) return;
    
    setPostponeModal(prev => ({ ...prev, checking: true, error: null }));
    
    try {
      const response = await api.post(`/lectures/${postponeModal.lectureId}/check-conflicts`, {
        new_date: postponeModal.newDate,
        new_time: postponeModal.newTime || null,
      });
      
      if (response.data.success) {
        setPostponeModal(prev => ({
          ...prev,
          checking: false,
          conflicts: response.data.data.conflicts || [],
        }));
      }
    } catch (error) {
      setPostponeModal(prev => ({
        ...prev,
        checking: false,
        error: 'حدث خطأ أثناء التحقق من التعارضات',
      }));
    }
  };

  /**
   * Quick access buttons to select common postponement dates
   */
  const handleQuickDateSelect = (type) => {
    let targetDate = new Date();
    
    if (type === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
      const dateString = targetDate.toISOString().split('T')[0];
      setPostponeModal(prev => ({ ...prev, newDate: dateString, conflicts: [] }));
    } else if (type === 'next_lecture') {
      if (!postponeModal.lectureId) return;
      
      const currentLectureIndex = sortedLectures.findIndex(l => l.id === postponeModal.lectureId);
      if (currentLectureIndex !== -1) {
        let nextLecture = null;
        for (let i = currentLectureIndex + 1; i < sortedLectures.length; i++) {
          if (!isPostponedOriginal(sortedLectures[i])) {
            nextLecture = sortedLectures[i];
            break;
          }
        }
        
        if (nextLecture && nextLecture.date) {
          const dateString = nextLecture.date.split('T')[0];
          setPostponeModal(prev => ({ ...prev, newDate: dateString, conflicts: [] }));
        } else {
          alert('لا توجد محاضرة تالية في تسلسل هذا الكورس يمكن التأجيل لها.');
        }
      }
    }
  };

  /**
   * Handle postponement type selection
   */
  const handlePostponeTypeSelect = (type) => {
    setPostponeModal((prev) => ({ ...prev, selectedType: type }));
  };

  /**
   * Execute the postponement using the dedicated API endpoint.
   * 
   * This calls POST /api/lectures/{id}/postpone which:
   * 1. Validates the request
   * 2. Checks for conflicts
   * 3. Marks the original lecture as postponed (does NOT delete it)
   * 4. Creates a new makeup lecture with the new date/time
   */
  const handlePostponeSave = async () => {
    if (!postponeModal.selectedType || !postponeModal.newDate) return;
    
    setPostponeModal(prev => ({ ...prev, checking: true, error: null }));
    
    try {
      // Map selectedType to postponed_by value
      const postponedByMap = {
        'postponed_by_trainer': 'trainer',
        'postponed_by_student': 'student',
        'postponed_holiday': 'holiday',
      };
      
      const response = await api.post(`/lectures/${postponeModal.lectureId}/postpone`, {
        new_date: postponeModal.newDate,
        new_time: postponeModal.newTime || null,
        postponed_by: postponedByMap[postponeModal.selectedType] || 'trainer',
        reason: postponeModal.reason || null,
        force: postponeModal.forceOverride || false, // Only force if user explicitly confirms
      });
      
      if (response.data.success) {
        // Success - close modal and refresh data
        setPostponeModal({ 
          open: false, 
          lectureId: null, 
          reason: '', 
          selectedType: null,
          newDate: '',
          newTime: '',
          checking: false,
          conflicts: [],
          error: null,
          forceOverride: false,
        });
        
        // Show success message
        alert('تم تأجيل المحاضرة بنجاح وإنشاء محاضرة تعويضية جديدة.');
        
        // Refresh course data to show the new lecture
        fetchCourse();
      } else {
        setPostponeModal(prev => ({
          ...prev,
          checking: false,
          error: response.data.message || 'حدث خطأ أثناء التأجيل',
          conflicts: response.data.data?.conflicts || [],
        }));
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'حدث خطأ أثناء تأجيل المحاضرة';
      const conflicts = error.response?.data?.data?.conflicts || [];
      
      setPostponeModal(prev => ({
        ...prev,
        checking: false,
        error: errorMessage,
        conflicts: conflicts,
      }));
    }
  };

  /**
   * Handle course time change - saves automatically
   */
  const handleCourseTimeChange = async (value) => {
    try {
      setSaving(true);
      await api.put(`/courses/${id}`, { lecture_time: value });
      setCourse(prev => ({ ...prev, lecture_time: value }));
    } catch (error) {
      console.error('Error updating course time:', error);
      alert('حدث خطأ أثناء تحديث الوقت');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle trainer payment status change for a specific lecture - adds to editedLectures
   */
  const handleTrainerPaymentChange = (lectureId, value) => {
    // Find the lecture to get its data
    const lecture = lectures.find(l => l.id === lectureId);
    if (!lecture) return;
    
    // Add to editedLectures instead of saving immediately
    setEditedLectures(prev => ({
      ...prev,
      [lectureId]: {
        ...prev[lectureId],
        id: lectureId, // Ensure id is included
        trainer_payment_status: value
      }
    }));
    
    // Update the lecture in the lectures array for immediate UI feedback
    setLectures(prev => sortLecturesByDate(prev.map(lecture => 
      lecture.id === lectureId 
        ? { ...lecture, trainer_payment_status: value }
        : lecture
    )));
  };

  /**
   * Handle course days change - saves when modal is closed
   */
  const handleCourseDaysChange = async () => {
    try {
      setSaving(true);
      await api.put(`/courses/${id}`, { lecture_days: selectedDays });
      setCourse(prev => ({ ...prev, lecture_days: selectedDays }));
      setEditDaysModal(false);
    } catch (error) {
      console.error('Error updating course days:', error);
      alert('حدث خطأ أثناء تحديث الأيام');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Toggle day selection
   */
  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  /**
   * Normalize date to YYYY-MM-DD for input and API
   */
  const normalizeDateForInput = (dateVal) => {
    if (!dateVal) return '';
    const str = typeof dateVal === 'string' ? dateVal : (dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(dateVal));
    return str.includes('T') ? str.slice(0, 10) : str.slice(0, 10);
  };

  /**
   * Normalize time to HH:mm for input and API (backend expects H:i)
   */
  const normalizeTimeForInput = (timeVal) => {
    if (!timeVal) return '';
    const str = String(timeVal).trim();
    return str.slice(0, 5);
  };

  /**
   * Handle lecture selection for date/time editing
   */
  const handleLectureSelect = (lecture) => {
    if (selectedLecture?.id === lecture.id) {
      // Deselect if clicking the same lecture
      setSelectedLecture(null);
      setEditingLectureDateTime({ date: '', time: '' });
    } else {
      setSelectedLecture(lecture);
      setEditingLectureDateTime({
        date: normalizeDateForInput(lecture.date),
        time: normalizeTimeForInput(lecture.time || course?.lecture_time),
      });
    }
  };

  /**
   * Save individual lecture date/time (sends Y-m-d and H:i to match backend validation)
   */
  const saveLectureDateTime = async () => {
    if (!selectedLecture) return;
    const dateSent = normalizeDateForInput(editingLectureDateTime.date);
    const timeSent = normalizeTimeForInput(editingLectureDateTime.time || selectedLecture?.time || course?.lecture_time);
    if (!dateSent) {
      alert('يرجى اختيار التاريخ');
      return;
    }
    setSaving(true);
    try {
      const payload = { date: dateSent };
      if (timeSent) payload.time = timeSent;
      await api.put(`/lectures/${selectedLecture.id}`, payload);
      
      // Update local state with normalized values
      setLectures(prev => sortLecturesByDate(prev.map(l => 
        l.id === selectedLecture.id 
          ? { ...l, date: dateSent, time: timeSent || l.time }
          : l
      )));
      
      // Clear selection
      setSelectedLecture(null);
      setEditingLectureDateTime({ date: '', time: '' });
      
      // Refresh to get sorted lectures
      fetchCourse();
    } catch (error) {
      console.error('Error updating lecture:', error);
      alert('حدث خطأ أثناء تحديث المحاضرة');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancel lecture date/time editing
   */
  const cancelLectureEdit = () => {
    setSelectedLecture(null);
    setEditingLectureDateTime({ date: '', time: '' });
  };

  /**
   * Delete a makeup or extra lecture
   */
  const handleDeleteLecture = async (lectureId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المحاضرة نهائياً؟')) return;
    
    setSaving(true);
    try {
      const response = await api.delete(`/lectures/${lectureId}`);
      if (response.data.success) {
        alert('تم حذف المحاضرة بنجاح');
        fetchCourse();
      } else {
        alert(response.data.message || 'حدث خطأ أثناء الحذف');
      }
    } catch (error) {
      console.error('Error deleting lecture:', error);
      alert(error.response?.data?.message || 'تعذر حذف المحاضرة');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle course status change - shows confirmation for paused/finished
   */
  const handleCourseStatusChange = (value) => {
    // If changing to paused or finished, show confirmation modal
    if (value === 'paused' || value === 'finished') {
      setStatusChangeModal({
        open: true,
        newStatus: value,
        reason: '',
      });
    } else {
      // For other statuses, change directly
      confirmStatusChange(value, '');
    }
  };

  /**
   * Cancel status change and restore old value
   */
  const cancelStatusChange = () => {
    setStatusChangeModal({ open: false, newStatus: null, reason: '' });
    // Restore select to old value
    if (statusSelectRef.current && course) {
      statusSelectRef.current.value = course.status;
    }
  };

  /**
   * Confirm and apply status change
   */
  const confirmStatusChange = async (newStatus, reason) => {
    try {
      setSaving(true);
      const response = await api.put(`/courses/${id}/status`, {
        status: newStatus,
        reason: reason || null,
      });
      
      if (response.data.success) {
        setCourse(prev => ({ ...prev, status: newStatus }));
        setStatusChangeModal({ open: false, newStatus: null, reason: '' });
        console.log(`✓ تم تغيير حالة الكورس إلى: ${newStatus}`);
      } else {
        alert(response.data.message || 'حدث خطأ أثناء تحديث حالة الكورس');
      }
    } catch (error) {
      console.error('Error updating course status:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء تحديث حالة الكورس');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Save non-postponement lecture changes (attendance, notes, etc.)
   */
  const saveLectures = async (showSuccessAlert = true) => {
    if (Object.keys(editedLectures).length === 0) return;
    const keysSent = Object.keys(editedLectures);

    // Capture the keys we are about to save
    setSaving(true);
    try {
      // Prepare lectures data - ensure each lecture has an id
      const lecturesData = Object.entries(editedLectures).map(([lectureId, lecture]) => {
        // Ensure the lecture has an id
        const lectureWithId = {
          ...lecture,
          id: lecture.id || parseInt(lectureId)
        };
        
        // For dual courses, handle student_attendance separately
        if (lecture.student_attendance) {
          // This is a dual course lecture with student-specific data
          // We need to send the main lecture data plus student attendance
          const { student_attendance, ...mainData } = lectureWithId;
          return {
            ...mainData,
            student_attendance: student_attendance
          };
        }
        return lectureWithId;
      }).filter(lecture => lecture.id); // Only include lectures with valid IDs
      
      if (lecturesData.length === 0) {
        alert('لا توجد بيانات صحيحة للحفظ');
        setSaving(false);
        return;
      }
      
      console.log('Saving lectures data:', JSON.stringify(lecturesData, null, 2));
      
      const response = await api.put(`/courses/${id}/lectures/bulk`, {
        lectures: lecturesData,
      });
      
      console.log('Save response:', response.data);
      
      if (response.data.success) {
        // Only clear the keys we actually sent, preserving edits made during the API call
        setEditedLectures(prev => {
          const next = { ...prev };
          keysSent.forEach(k => delete next[k]);
          return next;
        });
        // Fetch course to get updated data
        const courseResponse = await api.get(`/courses/${id}`);
        if (courseResponse.data) {
          setCourse(courseResponse.data);
          setLectures(sortLecturesByDate(courseResponse.data.lectures || []));
          
          // Check for evaluation milestone after saving (for trainers only)
          if (isTrainer) {
            checkEvaluationMilestone(courseResponse.data);
          }
        } else {
          fetchCourse();
        }
        console.log('Lectures saved successfully');
        if (showSuccessAlert) {
          alert('تم حفظ التغييرات بنجاح');
        }
      } else {
        alert(response.data.message || 'حدث خطأ أثناء الحفظ');
      }
    } catch (error) {
      console.error('Error saving lectures:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'حدث خطأ أثناء الحفظ';
      alert(`خطأ: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save edited lectures after 1.5 seconds of inactivity
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      if (Object.keys(editedLectures).length > 0 && !saving) {
        saveLectures(false); // auto-save without alert
      }
    }, 1500);
    return () => clearTimeout(saveTimer);
  }, [editedLectures, saving]);


  const getAttendanceLabel = (attendance) => {
    const labels = { 
      present: 'حاضر', 
      absent: 'غائب', 
      postponed_by_trainer: 'مؤجل (المدرب)', 
      postponed_by_student: 'مؤجل (الطالب)',
      postponed_holiday: 'عطلة رسمية',
      pending: 'لم يحدد' 
    };
    return labels[attendance] || attendance;
  };

  const getActivityLabel = (activity) => {
    const labels = { 
      engaged: 'Engaged', 
      normal: 'Normal', 
      not_engaged: 'Not Engaged'
    };
    return labels[activity] || activity || '-';
  };

  const getHomeworkLabel = (homework) => {
    const labels = { 
      yes: 'Yes', 
      no: 'No', 
      partial: 'Partial'
    };
    return labels[homework] || homework || '-';
  };

  // Format time to 12-hour format
  const formatTime12Hour = (time24) => {
    if (!time24) return '-';
    const [hours, minutes] = time24.split(':');
    const date = new Date();
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Get student-specific attendance data from lecture
  const getStudentAttendance = (lecture, studentId) => {
    if (!studentId || !lecture.student_attendance) {
      return { attendance: lecture.attendance, activity: lecture.activity, homework: lecture.homework };
    }
    
    // Convert studentId to string to match JSON keys
    const studentIdStr = String(studentId);
    
    // Handle both array and object formats
    let studentData = null;
    if (Array.isArray(lecture.student_attendance)) {
      // If it's an array, find the student by index
      const studentIndex = course?.students?.findIndex(s => s.id === studentId);
      if (studentIndex !== -1 && lecture.student_attendance[studentIndex]) {
        studentData = lecture.student_attendance[studentIndex];
      }
    } else {
      // If it's an object, access by key
      studentData = lecture.student_attendance[studentIdStr] || lecture.student_attendance[studentId];
    }
    
    if (studentData) {
      return {
        attendance: studentData.attendance || 'pending',
        activity: studentData.activity,
        homework: studentData.homework,
        notes: studentData.notes,
      };
    }
    return { attendance: lecture.attendance, activity: lecture.activity, homework: lecture.homework };
  };

  const getAttendanceBadge = (attendance) => {
    const badges = { 
      present: 'badge-success', 
      absent: 'badge-danger', 
      postponed_by_trainer: 'badge-warning',
      postponed_by_student: 'badge-purple',
      postponed_holiday: 'badge-danger',
      pending: 'badge-gray' 
    };
    return badges[attendance] || 'badge-gray';
  };

  const getStatusLabel = (status) => {
    const labels = { 
      active: 'نشط', 
      paused: 'متوقف', 
      finished: 'منتهي', 
      cancelled: 'ملغي' 
    };
    return labels[status] || status;
  };

  // Calculate completion percentage for the course
  const calculateCompletionPercentage = () => {
    if (course?.completion_percentage !== undefined && course?.completion_percentage !== null) {
      return course.completion_percentage;
    }
    
    if (lectures && lectures.length > 0) {
      const completedCount = lectures.filter(l => 
        l.is_completed || l.attendance === 'present' || l.attendance === 'absent'
      ).length;
      // استخدام lectures_count من الكورس إذا كان متوفراً، وإلا استخدام عدد المحاضرات المحملة
      const totalCount = course?.lectures_count || lectures.length;
      return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    }
    
    return 0;
  };

  // Check if course is at 75% completion
  const isAt75Percent = () => {
    const percentage = calculateCompletionPercentage();
    return percentage >= 75 && percentage < 100;
  };

  // Check if evaluation milestone is reached (every 5 completed lectures)
  const checkEvaluationMilestone = (courseData) => {
    if (!courseData || !courseData.lectures) return;
    
    // Count completed lectures
    const completedLectures = courseData.lectures.filter(l => 
      l.is_completed || l.attendance === 'present' || l.attendance === 'absent'
    ).length;
    
    // Calculate current milestone (round down to nearest multiple of 5)
    const currentMilestone = Math.floor(completedLectures / 5) * 5;
    
    // Check if we've reached a new milestone that hasn't been confirmed
    const lastMilestone = courseData.last_evaluation_milestone || 0;
    
    if (currentMilestone >= 5 && currentMilestone > lastMilestone) {
      setEvaluationModal({
        open: true,
        milestone: currentMilestone,
        completedLectures: completedLectures,
      });
    }
  };
  
  // Handle evaluation confirmation
  const handleConfirmEvaluation = async () => {
    try {
      const response = await api.post(`/courses/${id}/confirm-evaluation`, {
        milestone: evaluationModal.milestone,
      });
      
      if (response.data.success) {
        setCourse(response.data.data);
        setEvaluationModal({ open: false, milestone: 0, completedLectures: 0 });
      }
    } catch (error) {
      console.error('Error confirming evaluation:', error);
      alert('حدث خطأ أثناء تأكيد إرسال التقييم');
    }
  };
  
  // Handle renewal alert status change
  const handleRenewalAlertStatusChange = async (newStatus) => {
    if (!isCustomerService) return;
    
    try {
      const response = await api.put(`/courses/${id}/renewal-alert-status`, {
        renewal_alert_status: newStatus,
      });
      
      if (response.data.success) {
        setCourse(response.data.data);
        
        // Show alert message only for 'sent' and 'renewed' statuses
        if (newStatus === 'sent') {
          alert('⚠️ تم إرسال رسالة التنبيه للمتدرب');
        } else if (newStatus === 'renewed') {
          alert('✅ تم اشتراك الطالب، قم بإعادة تعيين الكورس');
        }
        // No alert for 'alert' or 'none' statuses
      }
    } catch (error) {
      console.error('Error updating renewal alert status:', error);
      alert('حدث خطأ أثناء تحديث حالة التنبيه');
    }
  };

  // Open renewal reset modal
  const openRenewalResetModal = () => {
    if (!course) return;
    
    // Get student ID(s)
    const studentIds = course.is_dual && course.students?.length > 0
      ? course.students.map(s => s.id)
      : course.student_id 
        ? [course.student_id]
        : course.student?.id
          ? [course.student.id]
          : course.students?.[0]?.id
            ? [course.students[0].id]
            : [];

    setRenewalResetModal({
      open: true,
      start_date: '',
      course_package_id: '',
      lectures_count: '',
      lecture_time: course.lecture_time || '',
      lecture_days: Array.isArray(course.lecture_days) ? [...course.lecture_days] : [],
      paid_amount: '',
      remaining_amount: '',
      student_ids: studentIds,
    });
  };

  // Close renewal reset modal
  const closeRenewalResetModal = () => {
    setRenewalResetModal({
      open: false,
      start_date: '',
      course_package_id: '',
      lectures_count: '',
      lecture_time: '',
      lecture_days: [],
      paid_amount: '',
      remaining_amount: '',
      student_ids: [],
    });
  };

  // Calculate price per student for dual courses (helper function)
  const getStudentPriceForPackage = (packageName, isDual) => {
    if (!isDual) {
      return 0; // Will use package price for single courses
    }
    
    // For dual courses, each student pays a fixed amount based on package
    if (packageName?.includes('بمزاجي') || packageName === 'بمزاجي') {
      return 90000;
    } else if (packageName?.includes('توازن') || packageName?.includes('التوازن')) {
      return 135000;
    } else if (packageName?.includes('سرعة') || packageName?.includes('السرعة')) {
      return 225000;
    }
    
    return 0;
  };

  // Handle package change in renewal reset modal
  const handleRenewalPackageChange = (packageId) => {
    const selectedPackage = packages.find((p) => p.id.toString() === packageId);
    const lecturesCount = selectedPackage ? selectedPackage.lectures_count.toString() : '';
    const isDual = course?.is_dual || false;
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPriceForPackage(selectedPackage?.name, isDual);
    const packagePrice = isDual && studentPrice > 0 
      ? studentPrice 
      : (selectedPackage ? (selectedPackage.price || 0) : 0);
    
    const paidAmount = parseFloat(renewalResetModal.paid_amount) || 0;
    const remainingAmount = packagePrice - paidAmount;
    
    setRenewalResetModal(prev => ({
      ...prev,
      course_package_id: packageId,
      lectures_count: lecturesCount,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    }));
  };

  // Handle paid amount change in renewal reset modal
  const handleRenewalPaidAmountChange = (value) => {
    const paidAmount = parseFloat(value) || 0;
    const selectedPackage = packages.find((p) => p.id.toString() === renewalResetModal.course_package_id);
    const isDual = course?.is_dual || false;
    
    // Calculate price based on course type (dual or single)
    const studentPrice = getStudentPriceForPackage(selectedPackage?.name, isDual);
    const packagePrice = isDual && studentPrice > 0 
      ? studentPrice 
      : (selectedPackage ? (selectedPackage.price || 0) : 0);
    
    const remainingAmount = packagePrice - paidAmount;
    
    setRenewalResetModal(prev => ({
      ...prev,
      paid_amount: value,
      remaining_amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00',
    }));
  };

  // Toggle day in renewal reset modal
  const toggleRenewalDay = (day) => {
    setRenewalResetModal(prev => ({
      ...prev,
      lecture_days: prev.lecture_days.includes(day)
        ? prev.lecture_days.filter((d) => d !== day)
        : [...prev.lecture_days, day],
    }));
  };

  // Handle renewal reset submit
  const handleRenewalResetSubmit = async () => {
    if (!renewalResetModal.start_date || !renewalResetModal.course_package_id || !renewalResetModal.lecture_time || renewalResetModal.lecture_days.length === 0) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setSaving(true);

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
      const lectureDays = renewalResetModal.lecture_days.map(day => dayMap[day] || day);

      // Get student IDs
      const studentIds = renewalResetModal.student_ids || [];
      if (studentIds.length === 0) {
        alert('لا يمكن تحديد الطالب');
        setSaving(false);
        return;
      }

      // Create new course
      // When resetting from alert status, this is a renewal with the same trainer
      const courseData = {
        trainer_id: course.trainer_id, // Same trainer as the previous course
        course_package_id: parseInt(renewalResetModal.course_package_id),
        lectures_count: renewalResetModal.lectures_count ? parseInt(renewalResetModal.lectures_count) : undefined,
        start_date: renewalResetModal.start_date,
        lecture_time: renewalResetModal.lecture_time,
        lecture_days: lectureDays,
        is_dual: course.is_dual || false,
        student_ids: studentIds.map(id => parseInt(id)),
        paid_amount: renewalResetModal.paid_amount ? parseFloat(renewalResetModal.paid_amount) : 0,
        remaining_amount: renewalResetModal.remaining_amount ? parseFloat(renewalResetModal.remaining_amount) : 0,
        previous_course_id: course.id, // Pass the previous course ID to help identify it as a renewal
      };

      const response = await api.post('/courses', courseData);
      
      if (response.data) {
        // Update current course's renewal_alert_status to 'renewed' to remove it from alerts
        await api.put(`/courses/${id}/renewal-alert-status`, {
          renewal_alert_status: 'renewed',
        });

        // Refresh course data
        fetchCourse();
        
        // Close modal
        closeRenewalResetModal();
        
        alert('✅ تم إنشاء الكورس الجديد بنجاح');
        
        // Navigate to new course
        const newCourseId = response.data.id || response.data.data?.id;
        if (newCourseId) {
          navigate(`/courses/${newCourseId}`);
        }
      }
    } catch (error) {
      console.error('Error creating renewal course:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء إنشاء الكورس الجديد');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (!course) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Evaluation Modal - Blocks access until confirmed (for trainers only) */}
      {evaluationModal.open && isTrainer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-3 sm:p-6 border-2 sm:border-4 border-orange-500 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <AlertTriangle className="w-5 h-5 sm:w-8 sm:h-8 text-orange-500 flex-shrink-0" />
              <h3 className="text-sm sm:text-xl font-bold text-gray-800 dark:text-white">
                ⚠️ تنبيه: يرجى إرسال التقييم
              </h3>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 border-l-2 sm:border-l-4 border-orange-500 p-2.5 sm:p-4 rounded-lg mb-3 sm:mb-4">
              <p className="text-xs sm:text-base text-gray-800 dark:text-gray-200 font-semibold mb-1.5 sm:mb-2">
                تم اكتمال {evaluationModal.completedLectures} محاضرة في هذا الكورس
              </p>
              <p className="text-[10px] sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                يرجى إرسال التقييم للطالب قبل المتابعة. لا يمكنك الوصول إلى لوحة المحاضرات حتى يتم تأكيد إرسال التقييم.
              </p>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleConfirmEvaluation}
                className="flex-1 py-2 sm:py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-base"
              >
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                تم إرسال التقييم
              </button>
            </div>
            
            <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mt-3 sm:mt-4 text-center">
              سيتم إظهار هذا التنبيه عند اكتمال كل 5 محاضرات (5, 10, 15, 20...)
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] mt-1 relative z-10 mr-16 lg:mr-0"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="page-title flex items-center gap-2 font-bold flex-wrap">
                {course.is_dual && course.students && course.students.length > 0
                  ? course.students.map((s, idx) => (
                      <React.Fragment key={s.id}>
                        {idx > 0 && <span className="text-[var(--color-text-muted)] mx-1">و</span>}
                        <button 
                          onClick={() => setProfileModalStudentId(s.id)} 
                          className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors flex items-center gap-1 focus:outline-none"
                          title="عرض ملف الطالب"
                        >
                          {s.name} <UserCircle className="w-5 h-5 xl:w-6 xl:h-6 opacity-60 hover:opacity-100" />
                        </button>
                      </React.Fragment>
                    ))
                  : (
                    <button 
                      onClick={() => setProfileModalStudentId(course.students?.[0]?.id || course.student_id)} 
                      className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors flex items-center gap-1 focus:outline-none"
                      title="عرض ملف الطالب"
                    >
                      {course.student_name || course.student?.name || course.students?.[0]?.name || '-'}
                      <UserCircle className="w-5 h-5 xl:w-6 xl:h-6 opacity-60 hover:opacity-100" />
                    </button>
                  )}
              </h1>
              {isCustomerService ? (
                <select
                  ref={statusSelectRef}
                  value={course.status}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue === course.status) return; // No change
                    handleCourseStatusChange(newValue);
                  }}
                  className="select text-sm py-1 px-3 font-semibold rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                >
                  <option value="active">🟢 نشط</option>
                  <option value="paused">🟠 متوقف</option>
                  <option value="finished">🔵 منتهي</option>
                  <option value="cancelled">⚫ ملغي</option>
                </select>
              ) : (
                <span className={`badge ${
                  course.status === 'active' ? 'badge-success' : 
                  course.status === 'paused' ? 'badge-warning' :
                  course.status === 'finished' ? 'badge-info' : 
                  'badge-gray'
                }`}>
                  {getStatusLabel(course.status)}
                </span>
              )}
            </div>
            <p className="page-subtitle">رقم الكورس: #{course.id}</p>
            {course.extra_lectures_count > 0 && (
              <span className="badge badge-info mt-1 inline-flex mb-2 text-[11px]">
                 <span className="font-bold ml-1">{course.extra_lectures_count}</span> محاضرات إضافية {!isTrainer && `(المبلغ: ${formatCurrency(course.extra_lectures_fee)})`}
              </span>
            )}
            {/* أيام المحاضرات + تاريخ أول دفعة + تاريخ بدء الكورس الفعلي */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">أيام المحاضرات:</span>{' '}
                {formatLectureDays(course.lecture_days)}
              </span>
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">تاريخ أول دفعة:</span>{' '}
                {course.start_date ? formatDateShort(course.start_date) : '—'}
              </span>
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">تاريخ بدء الكورس الفعلي:</span>{' '}
                {course.actual_start_date ? formatDateShort(course.actual_start_date) : 'لم يبدأ بعد'}
                {(isTrainer || isCustomerService) && !course.actual_start_date && (
                  <button
                    type="button"
                    onClick={() => setStartCourseModal({ open: true, date: new Date().toISOString().split('T')[0] })}
                    disabled={startingCourse}
                    className="mr-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 text-[11px] font-medium transition-colors"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    بدء الكورس
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            {saving && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium transition-all bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full"></span>
                جاري الحفظ...
              </span>
            )}
            {!saving && Object.keys(editedLectures).length === 0 && (
              <span className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1 opacity-70 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                مزامنة
              </span>
            )}
          </div>
          {isCustomerService && (
            <>
              <button
                onClick={() => setExtraLecturesModal({ open: true, count: 1, fee: 0, isPaid: true, paymentMethod: course?.payment_method || 'cash', saving: false })}
                className="btn-secondary flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 mt-2 sm:mt-0"
                title="إضافة محاضرات إضافية"
              >
                <PlusCircle className="w-5 h-5" />
                محاضرات إضافية
              </button>
              <button
                onClick={handleDeleteCourse}
                className="btn-secondary flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-300 dark:border-red-700 mt-2 sm:mt-0"
                title="حذف الكورس"
              >
                <Trash2 className="w-5 h-5" />
                حذف الكورس
              </button>
            </>
          )}
        </div>
      </div>

      {/* Renewal Alert Status - Only show for courses at 75%+ completion and for customer service */}
      {isCustomerService && isAt75Percent() && (
        <div className={`card border-2 max-w-full mx-auto ${
          course.renewal_alert_status === 'renewed'
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700'
            : 'bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-orange-300 dark:border-orange-700'
        }`}>
          <div className="p-2.5 sm:p-4">
            <h3 className={`text-xs sm:text-lg font-bold mb-2 sm:mb-3 text-center ${
              course.renewal_alert_status === 'renewed'
                ? 'text-green-800 dark:text-green-200'
                : 'text-orange-800 dark:text-orange-200'
            }`}>
              {course.renewal_alert_status === 'renewed' ? '✅' : '⚠️'} تنبيه: الكورس على وشك الانتهاء ({calculateCompletionPercentage()}% مكتمل)
            </h3>
            <p className={`text-[10px] sm:text-sm mb-2.5 sm:mb-4 text-center ${
              course.renewal_alert_status === 'renewed'
                ? 'text-green-700 dark:text-green-300'
                : 'text-orange-700 dark:text-orange-300'
            }`}>
              {course.renewal_alert_status === 'renewed' 
                ? 'تم اشتراك الطالب، قم بإعادة تعيين الكورس'
                : 'يرجى إرسال رسالة للمتدرب لتجديد الاشتراك'}
            </p>
            
            {/* Two-stage buttons: Sent and Renewed */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap">
              <button
                onClick={() => handleRenewalAlertStatusChange('sent')}
                className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-[10px] sm:text-sm font-semibold transition-all ${
                  course.renewal_alert_status === 'sent'
                    ? 'bg-blue-500 text-white shadow-lg scale-105'
                    : course.renewal_alert_status === 'sent' || course.renewal_alert_status === 'renewed'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                }`}
              >
                📧 تم الإرسال
              </button>
              
              <button
                onClick={() => handleRenewalAlertStatusChange('renewed')}
                className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-[10px] sm:text-sm font-semibold transition-all ${
                  course.renewal_alert_status === 'renewed'
                    ? 'bg-green-500 text-white shadow-lg scale-105'
                    : course.renewal_alert_status === 'sent' || course.renewal_alert_status === 'renewed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
                disabled={course.renewal_alert_status === 'none' || course.renewal_alert_status === 'alert'}
              >
                ✅ تم الاشتراك
              </button>
              
              {course.renewal_alert_status === 'renewed' && (
                <button
                  onClick={openRenewalResetModal}
                  className="px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-[10px] sm:text-sm font-semibold transition-all"
                >
                  🔄 إعادة تعيين
                </button>
              )}
            </div>
            
            {/* Status indicator */}
            {course.renewal_alert_status !== 'none' && course.renewal_alert_status !== 'alert' && (
              <div className={`mt-2 sm:mt-3 pt-2 sm:pt-3 border-t ${
                course.renewal_alert_status === 'renewed'
                  ? 'border-green-300 dark:border-green-700'
                  : 'border-orange-300 dark:border-orange-700'
              }`}>
                <p className={`text-[10px] sm:text-sm text-center ${
                  course.renewal_alert_status === 'renewed'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  الحالة الحالية: 
                  <span className="font-bold ml-2">
                    {course.renewal_alert_status === 'sent' && '📧 تم الإرسال'}
                    {course.renewal_alert_status === 'renewed' && '✅ تم الاشتراك'}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lectures Table - Blocked if evaluation modal is open */}
      <div className={`card ${evaluationModal.open && isTrainer ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-lg font-bold text-[var(--color-text-primary)] whitespace-nowrap">
              جدول المحاضرات
            </h2>
            <span className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">
              {sortedLectures.filter((l) => {
                return l.is_completed || l.attendance === 'present' || l.attendance === 'absent';
              }).length} / {course?.lectures_count || sortedLectures.length} مكتمل
            </span>
          </div>
          
          {/* Student and Trainer Info - compact font for long names */}
          <div className="flex flex-wrap gap-3 text-xs">
          {/* Show students - handle both single and dual courses */}
          {course.is_dual && course.students && course.students.length > 1 && (
              <>
                {course.students.map((student, index) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all cursor-pointer max-w-full min-w-0 ${
                      selectedStudentId === student.id
                        ? index === 0 
                          ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                          : 'bg-purple-500 text-white ring-2 ring-purple-300'
                        : index === 0
                          ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                          : 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                    }`}
                    title={student.name || 'غير محدد'}
                  >
                    <User className={`w-3.5 h-3.5 flex-shrink-0 ${
                      selectedStudentId === student.id 
                        ? 'text-white' 
                        : index === 0 
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-purple-600 dark:text-purple-400'
                    }`} />
                    <span className={selectedStudentId === student.id 
                      ? index === 0 ? 'text-blue-100' : 'text-purple-100'
                      : 'text-[var(--color-text-muted)]'
                    }>
                      {index === 0 ? 'الطالب الأول:' : 'الطالب الثاني:'}
                    </span>
                    <span className="font-semibold truncate">
                      {student.name || 'غير محدد'}
                    </span>
                  </button>
                ))}
              </>
            )}

            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg max-w-full min-w-0" title="الباقة">
              <PackageBadge course={course} className="font-normal text-[var(--color-text-primary)]" />
            </div>

            {course.is_dual && (
              <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                <span className="badge badge-purple text-[10px]">كورس ثنائي</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg max-w-full min-w-0" title={course.trainer?.user?.name || course.trainer?.name || 'غير محدد'}>
              <GraduationCap className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[var(--color-text-muted)] flex-shrink-0">المدرب:</span>
              <span className="font-semibold text-[var(--color-text-primary)] truncate">
                {course.trainer?.user?.name || course.trainer?.name || 'غير محدد'}
              </span>
            </div>
          </div>
        </div>

        {/* Show selected student indicator for dual courses */}
        {course.is_dual && selectedStudentId && (
          <div className="mb-3 p-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="w-4 h-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">عرض بيانات:</span>
                <span className="font-bold text-xs text-indigo-700 dark:text-indigo-300 truncate" title={course.students?.find(s => s.id === selectedStudentId)?.name}>
                  {course.students?.find(s => s.id === selectedStudentId)?.name}
                </span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                اضغط على اسم الطالب الآخر للتبديل
              </span>
            </div>
          </div>
        )}

        {/* Mobile Cards View - مرتبة حسب التاريخ */}
        <div className="md:hidden space-y-2 p-2">
          {sortedLectures.map((lecture) => {
            const rawEdited = editedLectures[lecture.id] || {};
            const lectureDate = new Date(lecture.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            lectureDate.setHours(0, 0, 0, 0);
            const isToday = lectureDate.getTime() === today.getTime();
            const isFuture = lectureDate > today;
            const isMakeup = lecture.is_makeup;
            const isPostponedOrig = isPostponedOriginal(lecture);
            const isSelected = selectedLecture?.id === lecture.id;
            
            const modifyStatus = canModifyLecture(lecture);
            const isLocked = !modifyStatus.canModify;
            
            const studentData = course?.is_dual && selectedStudentId 
              ? getStudentAttendance(lecture, selectedStudentId) 
              : { attendance: lecture.attendance, activity: lecture.activity, homework: lecture.homework };
            
            const studentIdKey = selectedStudentId ? String(selectedStudentId) : null;
            const editedStudentData = course?.is_dual && studentIdKey && rawEdited.student_attendance?.[studentIdKey]
              ? rawEdited.student_attendance[studentIdKey]
              : {};
            
            const currentAttendance = course?.is_dual && selectedStudentId
              ? (editedStudentData.attendance ?? studentData.attendance ?? 'pending')
              : (rawEdited.attendance ?? studentData.attendance ?? 'pending');
            const currentActivity = course?.is_dual && selectedStudentId
              ? (editedStudentData.activity ?? studentData.activity)
              : (rawEdited.activity ?? studentData.activity);
            const currentHomework = course?.is_dual && selectedStudentId
              ? (editedStudentData.homework ?? studentData.homework)
              : (rawEdited.homework ?? studentData.homework);
            
            let isCompleted = false;
            if (rawEdited.is_completed !== undefined && rawEdited.is_completed !== null) {
                isCompleted = rawEdited.is_completed;
            }
            else if (lecture.is_completed !== undefined && lecture.is_completed !== null) {
                isCompleted = lecture.is_completed;
            }
            else if (course?.is_dual) {
                if (rawEdited.student_attendance) {
                    const editedStudentAttendance = rawEdited.student_attendance;
                    const hasEditedCompletedAttendance = Object.values(editedStudentAttendance).some(
                        (studentData) => studentData && 
                        typeof studentData === 'object' &&
                        (studentData.attendance === 'present' || studentData.attendance === 'absent')
                    );
                    if (hasEditedCompletedAttendance) {
                        isCompleted = true;
                    }
                }
                if (!isCompleted && lecture.student_attendance) {
                    const studentAttendanceObj = lecture.student_attendance;
                    const attendanceValues = Array.isArray(studentAttendanceObj) 
                        ? studentAttendanceObj 
                        : Object.values(studentAttendanceObj);
                    const hasCompletedAttendance = attendanceValues.some(
                        (studentData) => studentData && 
                        typeof studentData === 'object' &&
                        (studentData.attendance === 'present' || studentData.attendance === 'absent')
                    );
                    isCompleted = hasCompletedAttendance;
                }
                if (!isCompleted && (currentAttendance === 'present' || currentAttendance === 'absent')) {
                    isCompleted = true;
                }
            }
            else {
                isCompleted = currentAttendance === 'present' || currentAttendance === 'absent';
            }

            return (
              <div
                key={lecture.id}
                className={`p-2.5 rounded-lg border-2 ${
                  isCompleted 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                    : isToday && !isCompleted
                      ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-300 dark:border-primary-700'
                      : isMakeup && !isCompleted
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700'
                        : isPostponedOrig
                          ? 'bg-gray-100 dark:bg-gray-800/70 border-gray-300 dark:border-gray-600'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">رقم المحاضرة</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-xs font-bold ${isPostponedOrig ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-white'}`}>
                        {lecture.lecture_number}
                      </span>
                      {lecture.is_extra && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold whitespace-nowrap" title="محاضرة إضافية">
                          إضافية
                        </span>
                      )}
                      {isPostponedOrig && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold whitespace-nowrap" title="محاضرة أصلية تم تأجيلها">
                          مؤجلة
                        </span>
                      )}
                      {isMakeup && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold whitespace-nowrap" title="محاضرة تعويضية">
                          تعويضية
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">التاريخ</span>
                    {isCustomerService && !isAccounting && isSelected ? (
                      <input
                        type="date"
                        value={editingLectureDateTime.date}
                        onChange={(e) => setEditingLectureDateTime(prev => ({ ...prev, date: e.target.value }))}
                        className="input py-1 px-2 text-xs w-full max-w-[140px] border border-[var(--color-border)] rounded"
                        dir="ltr"
                      />
                    ) : isCustomerService && !isAccounting ? (
                      <button
                        type="button"
                        onClick={() => handleLectureSelect(lecture)}
                        className="text-right text-xs font-medium text-gray-800 dark:text-white hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1 py-0.5 -m-1"
                        title="انقر لتعديل التاريخ والوقت"
                      >
                        {formatDateShort(lecture.date)}
                        {isToday && (
                          <span className="text-[9px] text-primary-600 dark:text-primary-400 font-medium block">
                            اليوم
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-800 dark:text-white">
                          {formatDateShort(lecture.date)}
                        </p>
                        {isToday && (
                          <span className="text-[9px] text-primary-600 dark:text-primary-400 font-medium">
                            اليوم
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">الوقت</span>
                    {(isCustomerService || isTrainer) && !isAccounting && isSelected ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input
                          type="time"
                          value={editingLectureDateTime.time}
                          onChange={(e) => setEditingLectureDateTime(prev => ({ ...prev, time: e.target.value }))}
                          className="input py-1 px-2 text-xs w-24 border border-[var(--color-border)] rounded"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={saveLectureDateTime}
                          disabled={saving}
                          className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          title="حفظ"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelLectureEdit}
                          className="p-1.5 bg-gray-400 text-white rounded hover:bg-gray-500"
                          title="إلغاء"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (isCustomerService || isTrainer) && !isAccounting ? (
                      <button
                        type="button"
                        onClick={() => handleLectureSelect(lecture)}
                        className="text-xs font-medium text-gray-800 dark:text-white hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1 py-0.5 -m-1"
                        dir="ltr"
                        title={isCustomerService ? "انقر لتعديل التاريخ والوقت" : "انقر لتعديل وقت المحاضرة"}
                      >
                        {formatTime12Hour(lecture.time || course?.lecture_time)}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-gray-800 dark:text-white" dir="ltr">
                        {formatTime12Hour(lecture.time || course?.lecture_time)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">الحضور</span>
                    {isLocked || isAccounting ? (
                      <span className={`badge text-[9px] px-1 py-0.5 ${getAttendanceBadge(currentAttendance)}`}>
                        {getAttendanceLabel(currentAttendance)}
                      </span>
                    ) : (
                      <div className="flex gap-1 items-center">
                        <select
                          value={currentAttendance}
                          onChange={(e) => handleLectureChange(lecture.id, 'attendance', e.target.value)}
                          className="text-[9px] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
                          disabled={isLocked}
                          style={{ 
                            fontSize: '9px', 
                            paddingTop: '2px', 
                            paddingBottom: '2px', 
                            paddingLeft: '6px',
                            paddingRight: '6px',
                            height: '20px',
                            width: '80px',
                            borderRadius: '0.5rem'
                          }}
                        >
                          <option value="pending">لم يحدد</option>
                          <option value="present">حاضر</option>
                          <option value="absent">غائب</option>
                          <option value="postponed">مؤجل</option>
                        </select>
                        {(lecture.is_makeup || lecture.is_extra) && isCustomerService && !isAccounting && (
                          <button
                            onClick={() => handleDeleteLecture(lecture.id)}
                            className="text-red-500 hover:text-red-700 p-0.5"
                            title="حذف هذه المحاضرة نهائياً"
                            disabled={saving}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">النشاط</span>
                    {isLocked || isAccounting ? (
                      <span className="text-[9px] text-gray-500">{getActivityLabel(currentActivity)}</span>
                    ) : (
                      <select
                        value={currentActivity ?? ''}
                        onChange={(e) => handleLectureChange(lecture.id, 'activity', e.target.value)}
                        className="text-[9px] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
                        disabled={isLocked}
                        style={{ 
                          fontSize: '9px', 
                          paddingTop: '2px', 
                          paddingBottom: '2px', 
                          paddingLeft: '6px',
                          paddingRight: '6px',
                          height: '20px',
                          width: '80px',
                          borderRadius: '0.5rem'
                        }}
                      >
                        <option value="">-</option>
                        <option value="engaged">Engaged</option>
                        <option value="normal">Normal</option>
                        <option value="not_engaged">Not Engaged</option>
                      </select>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">الواجب</span>
                    {isLocked || isAccounting ? (
                      <span className="text-[9px] text-gray-500">{getHomeworkLabel(currentHomework)}</span>
                    ) : (
                      <select
                        value={currentHomework ?? ''}
                        onChange={(e) => handleLectureChange(lecture.id, 'homework', e.target.value)}
                        className="text-[9px] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
                        disabled={isLocked}
                        style={{ 
                          fontSize: '9px', 
                          paddingTop: '2px', 
                          paddingBottom: '2px', 
                          paddingLeft: '6px',
                          paddingRight: '6px',
                          height: '20px',
                          width: '80px',
                          borderRadius: '0.5rem'
                        }}
                      >
                        <option value="">-</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                        <option value="partial">Partial</option>
                      </select>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">دفع المدرب</span>
                    {(isCustomerService || isAccounting) ? (
                      <select
                        value={lecture.trainer_payment_status || 'unpaid'}
                        onChange={(e) => handleTrainerPaymentChange(lecture.id, e.target.value)}
                        className="text-[9px] border border-[var(--color-border)]"
                        style={{ 
                          fontSize: '9px', 
                          paddingTop: '2px', 
                          paddingBottom: '2px', 
                          paddingLeft: '6px',
                          paddingRight: '6px',
                          height: '20px',
                          width: '80px',
                          borderRadius: '0.5rem',
                          backgroundColor: lecture.trainer_payment_status === 'paid' 
                            ? 'rgb(220 252 231)' 
                            : 'rgb(254 226 226)',
                          color: lecture.trainer_payment_status === 'paid' 
                            ? 'rgb(22 163 74)' 
                            : 'rgb(239 68 68)'
                        }}
                      >
                        <option value="unpaid">غير مدفوع</option>
                        <option value="paid">مدفوع</option>
                      </select>
                    ) : (
                      <span className={`text-[9px] ${lecture.trainer_payment_status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                        {lecture.trainer_payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">ملاحظات</span>
                    {isLocked || isAccounting ? (
                      <span className="text-[9px] text-gray-500">
                        {(rawEdited.notes ?? lecture.notes) ? (
                          <button
                            onClick={() => setReasonPopup({ 
                              open: true, 
                              reason: rawEdited.notes ?? lecture.notes 
                            })}
                            className="text-blue-500 hover:text-blue-600"
                            title="عرض الملاحظة"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        ) : '-'}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          const currentNotes = rawEdited.notes ?? lecture.notes ?? '';
                          setNotesModal({
                            open: true,
                            lectureId: lecture.id,
                            notes: currentNotes
                          });
                        }}
                        className={`p-1 rounded-lg transition-colors ${
                          (rawEdited.notes ?? lecture.notes)
                            ? 'text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        title={rawEdited.notes ?? lecture.notes ?? 'إضافة ملاحظة'}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table View - أعمدة ضيقة، خط صغير، دفع المدرب يظهر كاملاً */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[10px] border-collapse border border-[var(--color-border)] table-fixed" style={{ minWidth: '520px' }}>
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '17%' }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-[var(--color-border)]">
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">رقم</th>
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">التاريخ</th>
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">الوقت</th>
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">الحضور</th>
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">النشاط</th>
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">الواجب</th>
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">دفع المدرب</th>
                <th className="text-center py-1 px-1 border-l border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50 font-semibold text-[var(--color-text-primary)] text-[9px]">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {sortedLectures.map((lecture) => {
                const rawEdited = editedLectures[lecture.id] || {};
                const lectureDate = new Date(lecture.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                lectureDate.setHours(0, 0, 0, 0);
                const isToday = lectureDate.getTime() === today.getTime();
                const isFuture = lectureDate > today;
                const isMakeup = lecture.is_makeup;
                const isPostponedOrig = isPostponedOriginal(lecture);
                const isSelected = selectedLecture?.id === lecture.id;
                
                // Check if lecture can be modified
                const modifyStatus = canModifyLecture(lecture);
                const isLocked = !modifyStatus.canModify;
                
                // For dual courses, get student-specific data
                const studentData = course?.is_dual && selectedStudentId 
                  ? getStudentAttendance(lecture, selectedStudentId) 
                  : { attendance: lecture.attendance, activity: lecture.activity, homework: lecture.homework };
                
                // Merge edited values with student-specific data for dual courses
                // Convert studentId to string to match key format
                const studentIdKey = selectedStudentId ? String(selectedStudentId) : null;
                const editedStudentData = course?.is_dual && studentIdKey && rawEdited.student_attendance?.[studentIdKey]
                  ? rawEdited.student_attendance[studentIdKey]
                  : {};
                
                // For dual courses, use student-specific attendance from editedStudentData first
                // For single courses, use rawEdited.attendance
                const currentAttendance = course?.is_dual && selectedStudentId
                  ? (editedStudentData.attendance ?? studentData.attendance ?? 'pending')
                  : (rawEdited.attendance ?? studentData.attendance ?? 'pending');
                const currentActivity = course?.is_dual && selectedStudentId
                  ? (editedStudentData.activity ?? studentData.activity)
                  : (rawEdited.activity ?? studentData.activity);
                const currentHomework = course?.is_dual && selectedStudentId
                  ? (editedStudentData.homework ?? studentData.homework)
                  : (rawEdited.homework ?? studentData.homework);
                
                // Lecture-level completed status (not student-specific)
                // A lecture is completed if:
                // 1. is_completed is explicitly set to true, OR
                // 2. attendance is 'present' or 'absent' (for single courses), OR
                // 3. For dual courses: if any student has attendance 'present' or 'absent'
                let isCompleted = false;
                
                // First check if explicitly set in edited data
                if (rawEdited.is_completed !== undefined && rawEdited.is_completed !== null) {
                    isCompleted = rawEdited.is_completed;
                }
                // Then check lecture's is_completed
                else if (lecture.is_completed !== undefined && lecture.is_completed !== null) {
                    isCompleted = lecture.is_completed;
                }
                // For dual courses: check student_attendance
                else if (course?.is_dual) {
                    // Check edited student_attendance first (unsaved changes)
                    if (rawEdited.student_attendance) {
                        const editedStudentAttendance = rawEdited.student_attendance;
                        const hasEditedCompletedAttendance = Object.values(editedStudentAttendance).some(
                            (studentData) => studentData && 
                            typeof studentData === 'object' &&
                            (studentData.attendance === 'present' || studentData.attendance === 'absent')
                        );
                        if (hasEditedCompletedAttendance) {
                            isCompleted = true;
                        }
                    }
                    
                    // Also check saved student_attendance from lecture
                    if (!isCompleted && lecture.student_attendance) {
                        const studentAttendanceObj = lecture.student_attendance;
                        // Handle both array and object formats
                        const attendanceValues = Array.isArray(studentAttendanceObj) 
                            ? studentAttendanceObj 
                            : Object.values(studentAttendanceObj);
                        
                        const hasCompletedAttendance = attendanceValues.some(
                            (studentData) => studentData && 
                            typeof studentData === 'object' &&
                            (studentData.attendance === 'present' || studentData.attendance === 'absent')
                        );
                        isCompleted = hasCompletedAttendance;
                    }
                    
                    // Also check current attendance for the selected student
                    if (!isCompleted && (currentAttendance === 'present' || currentAttendance === 'absent')) {
                        isCompleted = true;
                    }
                }
                // Single course: check main attendance
                else {
                    isCompleted = currentAttendance === 'present' || currentAttendance === 'absent';
                }
                
                // Debug log for dual courses
                if (course?.is_dual) {
                    console.log(`Lecture ${lecture.lecture_number} completion:`, {
                        lectureId: lecture.id,
                        isCompleted,
                        currentAttendance,
                        rawEdited_is_completed: rawEdited.is_completed,
                        lecture_is_completed: lecture.is_completed,
                        rawEdited_student_attendance: rawEdited.student_attendance,
                        saved_student_attendance: lecture.student_attendance
                    });
                }

                return (
                  <tr
                    key={lecture.id}
                    className={`border-b border-[var(--color-border)] ${
                      isCompleted ? 'bg-green-100 dark:bg-green-900/30' : ''
                    } ${
                      isToday && !isCompleted ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                    } ${
                      isMakeup && !isCompleted ? 'bg-green-50 dark:bg-green-900/10' : ''
                    } ${
                      isPostponedOrig ? 'bg-gray-100 dark:bg-gray-800/50 opacity-50 grayscale pointer-events-none' : ''
                    } ${
                      isSelected ? 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-900/20' : ''
                    }`}
                  >
                    <td className="border-l border-[var(--color-border)] px-1 py-1 font-bold text-[var(--color-text-primary)] text-[10px] text-center align-middle">
                      <div className="flex flex-col items-center justify-center gap-1 flex-wrap">
                        <span className={isPostponedOrig ? 'text-gray-400 line-through' : ''}>
                          {lecture.lecture_number}
                        </span>
                        {lecture.is_extra && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold whitespace-nowrap" title="محاضرة إضافية">
                            إضافية
                          </span>
                        )}
                        {isPostponedOrig && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold whitespace-nowrap" title="محاضرة أصلية تم تأجيلها">
                            مؤجلة
                          </span>
                        )}
                        {isMakeup && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-bold whitespace-nowrap" title="محاضرة تعويضية">
                            تعويضية
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-[var(--color-border)] px-1 py-0.5 text-center align-middle">
                      {isCustomerService && !isAccounting && isSelected ? (
                        <input
                          type="date"
                          value={editingLectureDateTime.date}
                          onChange={(e) => setEditingLectureDateTime(prev => ({ ...prev, date: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          className="input py-1 px-2 text-sm w-32"
                          dir="ltr"
                        />
                      ) : isCustomerService && !isAccounting ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLectureSelect(lecture);
                          }}
                          className="text-center w-full px-1 py-0.5 rounded transition-all hover:bg-amber-100 dark:hover:bg-amber-900/30 text-[10px]"
                          title="انقر لتعديل التاريخ والوقت"
                        >
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {formatDateShort(lecture.date)}
                          </p>
                          {isToday && (
                            <span className="text-[8px] text-primary-600 dark:text-primary-400 font-medium block">
                              اليوم
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="text-[10px] text-center">
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {formatDateShort(lecture.date)}
                          </p>
                          {isToday && (
                            <span className="text-[8px] text-primary-600 dark:text-primary-400 font-medium block">
                              اليوم
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="border-l border-[var(--color-border)] px-1 py-0.5 text-center text-[10px] align-middle" dir="ltr">
                      {(isCustomerService || isTrainer) && !isAccounting && isSelected ? (
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <input
                            type="time"
                            value={editingLectureDateTime.time}
                            onChange={(e) => setEditingLectureDateTime(prev => ({ ...prev, time: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                            className="input py-1 px-2 text-sm w-24"
                            dir="ltr"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveLectureDateTime();
                            }}
                            disabled={saving}
                            className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                            title="حفظ"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelLectureEdit();
                            }}
                            className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                            title="إلغاء"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (isCustomerService || isTrainer) && !isAccounting ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLectureSelect(lecture);
                          }}
                          className="text-[10px] font-medium px-1 py-0.5 rounded transition-all text-[var(--color-text-primary)] hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          title={isCustomerService ? "انقر لتعديل التاريخ والوقت" : "انقر لتعديل وقت المحاضرة"}
                        >
                          {formatTime12Hour(lecture.time || course?.lecture_time)}
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-[var(--color-text-primary)]">
                          {formatTime12Hour(lecture.time || course?.lecture_time)}
                        </span>
                      )}
                    </td>
                    <td className="border-l border-[var(--color-border)] px-1 py-0.5 text-center align-middle">
                      {['postponed_by_trainer', 'postponed_by_student', 'postponed_holiday'].includes(currentAttendance) ? (
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span className={`badge ${getAttendanceBadge(currentAttendance)}`}>
                            {getAttendanceLabel(currentAttendance)}
                          </span>
                          {((course?.is_dual && selectedStudentId 
                              ? (editedStudentData.notes ?? studentData.notes)
                              : (rawEdited.notes ?? lecture.notes)) || lecture.notes) && (
                            <button
                              onClick={() => {
                                const currentNotes = course?.is_dual && selectedStudentId
                                  ? (editedStudentData.notes ?? studentData.notes ?? lecture.notes)
                                  : (rawEdited.notes ?? lecture.notes);
                                setReasonPopup({ 
                                  open: true, 
                                  reason: currentNotes
                                });
                              }}
                              className="text-amber-500 hover:text-amber-600 transition-colors"
                              title="عرض السبب"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          )}
                          {!isLocked && !isAccounting && (
                            <button
                              onClick={() => handleCancelPostponement(lecture.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                              title="إلغاء التأجيل وحذف المحاضرة التعويضية"
                              disabled={saving}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ) : isLocked || isAccounting ? (
                        <span className={`badge ${getAttendanceBadge(currentAttendance)}`}>
                          {getAttendanceLabel(currentAttendance)}
                        </span>
                      ) : (
                        <div className="flex gap-1 items-center justify-center">
                          <select
                            value={currentAttendance}
                            onChange={(e) =>
                              handleLectureChange(lecture.id, 'attendance', e.target.value)
                            }
                            className="select text-[9px] py-0.5 px-1 w-20 mx-auto"
                            disabled={isLocked}
                          >
                            <option value="pending">لم يحدد</option>
                            <option value="present">حاضر</option>
                            <option value="absent">غائب</option>
                            <option value="postponed">مؤجل</option>
                          </select>
                          {(lecture.is_makeup || lecture.is_extra) && isCustomerService && !isAccounting && (
                            <button
                              onClick={() => handleDeleteLecture(lecture.id)}
                              className="text-red-500 hover:text-red-700 p-0.5"
                              title="حذف هذه المحاضرة نهائياً"
                              disabled={saving}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="border-l border-[var(--color-border)] px-1 py-0.5 text-center align-middle">
                      {isLocked || isAccounting ? (
                        <span className="text-[9px] text-gray-500">{getActivityLabel(currentActivity)}</span>
                      ) : (
                        <select
                          value={currentActivity ?? ''}
                          onChange={(e) => handleLectureChange(lecture.id, 'activity', e.target.value)}
                          className="select text-[9px] py-0.5 px-1 w-16 mx-auto"
                          disabled={isLocked}
                        >
                          <option value="">-</option>
                          <option value="engaged">Engaged</option>
                          <option value="normal">Normal</option>
                          <option value="not_engaged">Not Engaged</option>
                        </select>
                      )}
                    </td>
                    <td className="border-l border-[var(--color-border)] px-1 py-0.5 text-center align-middle">
                      {isLocked || isAccounting ? (
                        <span className="text-[9px] text-gray-500">{getHomeworkLabel(currentHomework)}</span>
                      ) : (
                        <select
                          value={currentHomework ?? ''}
                          onChange={(e) => handleLectureChange(lecture.id, 'homework', e.target.value)}
                          className="select text-[9px] py-0.5 px-1 w-16 mx-auto"
                          disabled={isLocked}
                        >
                          <option value="">-</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                          <option value="partial">Partial</option>
                        </select>
                      )}
                    </td>
                    <td className="border-l border-[var(--color-border)] px-1 py-0.5 text-center align-middle">
                      {(isCustomerService || isAccounting) ? (
                        <select
                          value={lecture.trainer_payment_status || 'unpaid'}
                          onChange={(e) => handleTrainerPaymentChange(lecture.id, e.target.value)}
                          className={`select py-0.5 px-0.5 w-full max-w-[100%] min-w-0 ${
                            lecture.trainer_payment_status === 'paid' 
                              ? 'text-green-600 bg-green-50 dark:bg-green-900/20' 
                              : 'text-red-500 bg-red-50 dark:bg-red-900/20'
                          }`}
                          style={{ fontSize: '8px' }}
                        >
                          <option value="unpaid">غير مدفوع</option>
                          <option value="paid">مدفوع</option>
                        </select>
                      ) : (
                        <span className={`block text-[8px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full ${lecture.trainer_payment_status === 'paid' ? 'text-green-600' : 'text-red-500'}`} title={lecture.trainer_payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}>
                          {lecture.trainer_payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
                        </span>
                      )}
                    </td>
                    <td className="border-l border-[var(--color-border)] px-1 py-0.5 text-center align-middle">
                      {isLocked ? (
                        <span className="text-[9px] text-gray-500">
                          {(rawEdited.notes ?? lecture.notes) ? (
                            <button
                              onClick={() => setReasonPopup({ 
                                open: true, 
                                reason: rawEdited.notes ?? lecture.notes 
                              })}
                              className="text-blue-500 hover:text-blue-600"
                              title="عرض الملاحظة"
                            >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          ) : '-'}
                        </span>
                      ) : isAccounting ? (
                        <span className="text-[9px] text-gray-500">
                          {(rawEdited.notes ?? lecture.notes) ? (
                            <button
                              onClick={() => setReasonPopup({ 
                                open: true, 
                                reason: rawEdited.notes ?? lecture.notes 
                              })}
                              className="text-blue-500 hover:text-blue-600"
                              title="عرض الملاحظة"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          ) : '-'}
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            const currentNotes = rawEdited.notes ?? lecture.notes ?? '';
                            setNotesModal({
                              open: true,
                              lectureId: lecture.id,
                              notes: currentNotes
                            });
                          }}
                          className={`p-1 rounded-lg transition-colors ${
                            (rawEdited.notes ?? lecture.notes)
                              ? 'text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                          title={rawEdited.notes ?? lecture.notes ?? 'إضافة ملاحظة'}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enhanced Postpone Modal with Date/Time Selection */}
      {postponeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPostponeModal({ 
              open: false, 
              lectureId: null, 
              reason: '', 
              selectedType: null,
              newDate: '',
              newTime: '',
              checking: false,
              conflicts: [],
              error: null,
              forceOverride: false,
            })}
          />
          <div className="relative bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 animate-fade-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setPostponeModal({ 
                open: false, 
                lectureId: null, 
                reason: '', 
                selectedType: null,
                newDate: '',
                newTime: '',
                checking: false,
                conflicts: [],
                error: null,
                forceOverride: false,
              })}
              className="absolute top-4 left-4 p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-6 text-center">
              تأجيل المحاضرة
            </h3>
            
            <div className="space-y-5">
              {/* Postponement Stats */}
              {postponementStats && (() => {
                const isStudent = postponeModal.selectedType === 'postponed_by_student';
                const isTrainer = postponeModal.selectedType === 'postponed_by_trainer';
                
                let activeStats = postponementStats;
                let title = 'التأجيلات';
                
                if (isStudent && postponementStats.student) {
                  activeStats = postponementStats.student;
                  title = 'تأجيلات الطالب';
                } else if (isTrainer && postponementStats.trainer) {
                  activeStats = postponementStats.trainer;
                  title = 'تأجيلات المدرب';
                }

                return (
                  <div className={`p-3 rounded-lg flex flex-col gap-2 ${
                    activeStats.can_postpone 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {activeStats.can_postpone ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {title}: {activeStats.used ?? activeStats.total_postponements} / {(activeStats.max > 0 || activeStats.max_allowed > 0 ? (activeStats.max ?? activeStats.max_allowed) : 3)}
                          {!activeStats.can_postpone && ' (تم الوصول للحد الأقصى)'}
                        </span>
                      </div>
                    </div>
                    {(!isStudent && !isTrainer) && postponementStats.student && postponementStats.trainer && (
                      <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-1 flex gap-4">
                        <span>• الطالب: {postponementStats.student.used} / {postponementStats.student.max}</span>
                        <span>• المدرب: {postponementStats.trainer.used} / {postponementStats.trainer.max}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* New Date Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
                  <Calendar className="w-4 h-4 inline ml-1" />
                  التاريخ الجديد للمحاضرة:
                </label>
                <input
                  type="date"
                  value={postponeModal.newDate}
                  onChange={(e) => {
                    setPostponeModal(prev => ({ ...prev, newDate: e.target.value, conflicts: [] }));
                  }}
                  onBlur={checkConflicts}
                  className="input w-full mb-3"
                  dir="ltr"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDateSelect('tomorrow')}
                    className="flex-1 py-2 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-lg text-[11px] sm:text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    يوم غد
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDateSelect('next_lecture')}
                    className="flex-1 py-2 px-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg text-[11px] sm:text-xs font-semibold border border-indigo-200 dark:border-indigo-800 transition-colors"
                  >
                    وقت المحاضرة التالية
                  </button>
                </div>
              </div>

              {/* New Time Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
                  <Clock className="w-4 h-4 inline ml-1" />
                  الوقت الجديد (اختياري):
                </label>
                <input
                  type="time"
                  value={postponeModal.newTime}
                  onChange={(e) => {
                    setPostponeModal(prev => ({ ...prev, newTime: e.target.value, conflicts: [] }));
                  }}
                  onBlur={checkConflicts}
                  className="input w-full"
                  dir="ltr"
                />
              </div>

              {/* Conflict Warning */}
              {postponeModal.conflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        يوجد تعارض في المواعيد!
                      </p>
                      {postponeModal.conflicts.map((conflict, idx) => (
                        <p key={idx} className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          {conflict.message}
                        </p>
                      ))}
                      {isCustomerService && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          يمكنك المتابعة كخدمة عملاء (ستتم الموافقة على التعارض)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {postponeModal.error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <X className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-800 dark:text-red-200">{postponeModal.error}</span>
                  </div>
                </div>
              )}

              {/* Postponement Type */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-muted)]">سبب التأجيل:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handlePostponeTypeSelect('postponed_by_trainer')}
                    className={`p-2 rounded-xl border-2 transition-all text-center ${
                      postponeModal.selectedType === 'postponed_by_trainer'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-[var(--color-border)] hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                    }`}
                  >
                    <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                    <p className="font-bold text-xs text-[var(--color-text-primary)]">بسبب المدرب</p>
                  </button>
                  
                  <button
                    onClick={() => handlePostponeTypeSelect('postponed_by_student')}
                    className={`p-2 rounded-xl border-2 transition-all text-center ${
                      postponeModal.selectedType === 'postponed_by_student'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-[var(--color-border)] hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                    }`}
                  >
                    <User className="w-5 h-5 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                    <p className="font-bold text-xs text-[var(--color-text-primary)]">بسبب الطالب</p>
                  </button>
                  
                  <button
                    onClick={() => handlePostponeTypeSelect('postponed_holiday')}
                    className={`p-2 rounded-xl border-2 transition-all text-center ${
                      postponeModal.selectedType === 'postponed_holiday'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-[var(--color-border)] hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    <Calendar className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
                    <p className="font-bold text-xs text-[var(--color-text-primary)]">عطلة رسمية</p>
                  </button>
                </div>
              </div>
              
              {/* Reason Text */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
                  تفاصيل السبب (اختياري):
                </label>
                <textarea
                  value={postponeModal.reason}
                  onChange={(e) => setPostponeModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="اكتب سبب التأجيل هنا..."
                  className="input w-full h-20 resize-none"
                  dir="rtl"
                />
              </div>
              
              {/* Conflict Warning */}
              {postponeModal.conflicts && postponeModal.conflicts.length > 0 && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="font-bold text-red-800 dark:text-red-200">يوجد تعارض في المواعيد!</span>
                  </div>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 mr-7">
                    {postponeModal.conflicts.map((conflict, idx) => (
                      <li key={idx}>• {conflict.message || `محاضرة في ${conflict.course_title} بنفس الوقت`}</li>
                    ))}
                  </ul>
                  {isCustomerService && !postponeModal.forceOverride && (
                    <button
                      onClick={() => setPostponeModal(prev => ({ ...prev, forceOverride: true }))}
                      className="mt-3 w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                      تجاوز التعارض والمتابعة (خدمة العملاء فقط)
                    </button>
                  )}
                  {postponeModal.forceOverride && (
                    <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-800 dark:text-red-200">
                      ✓ سيتم تجاوز التعارض
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {postponeModal.error && (!postponeModal.conflicts || postponeModal.conflicts.length === 0) && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">{postponeModal.error}</p>
                </div>
              )}

              {/* Important Note */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>ملاحظة:</strong> عند التأجيل، سيتم الاحتفاظ بالمحاضرة الأصلية في السجل وإنشاء محاضرة تعويضية جديدة بالتاريخ المحدد.
                </p>
              </div>
              
              {/* Save Button */}
              <button
                onClick={handlePostponeSave}
                disabled={
                  !postponeModal.selectedType || 
                  !postponeModal.newDate || 
                  postponeModal.checking || 
                  ((postponementStats && postponeModal.selectedType === 'postponed_by_student' && postponementStats.student) ? !postponementStats.student.can_postpone : (postponementStats && postponeModal.selectedType === 'postponed_by_trainer' && postponementStats.trainer) ? !postponementStats.trainer.can_postpone : (postponementStats && !postponementStats.can_postpone)) ||
                  (postponeModal.conflicts && postponeModal.conflicts.length > 0 && !postponeModal.forceOverride)
                }
                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  postponeModal.selectedType && 
                  postponeModal.newDate && 
                  !postponeModal.checking && 
                  ((postponementStats && postponeModal.selectedType === 'postponed_by_student' && postponementStats.student) ? postponementStats.student.can_postpone : (postponementStats && postponeModal.selectedType === 'postponed_by_trainer' && postponementStats.trainer) ? postponementStats.trainer.can_postpone : (!postponementStats || postponementStats.can_postpone)) &&
                  (!postponeModal.conflicts || postponeModal.conflicts.length === 0 || postponeModal.forceOverride)
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                }`}
              >
                {postponeModal.checking ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    جاري المعالجة...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    تأجيل وإنشاء محاضرة تعويضية
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reason Popup */}
      {reasonPopup.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setReasonPopup({ open: false, reason: '' })}
          />
          <div className="relative bg-[var(--color-bg-primary)] rounded-xl p-5 max-w-sm mx-4 shadow-2xl animate-fade-in">
            <button
              onClick={() => setReasonPopup({ open: false, reason: '' })}
              className="absolute top-3 left-3 p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="font-bold text-[var(--color-text-primary)]">سبب التأجيل</h4>
            </div>
            <p className="text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] p-3 rounded-lg">
              {reasonPopup.reason || 'لم يتم تحديد سبب'}
            </p>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setNotesModal({ open: false, lectureId: null, notes: '' })}
          />
          <div className="relative bg-[var(--color-bg-primary)] rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl animate-fade-in">
            <button
              onClick={() => setNotesModal({ open: false, lectureId: null, notes: '' })}
              className="absolute top-3 left-3 p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-bold text-[var(--color-text-primary)]">ملاحظات المحاضرة</h4>
            </div>
            <textarea
              value={notesModal.notes}
              onChange={(e) => setNotesModal(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="أدخل ملاحظاتك هنا..."
              className="input w-full h-32 resize-none"
              dir="rtl"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (notesModal.lectureId) {
                    handleLectureChange(notesModal.lectureId, 'notes', notesModal.notes);
                  }
                  setNotesModal({ open: false, lectureId: null, notes: '' });
                }}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={!notesModal.lectureId}
              >
                <Save className="w-4 h-4" />
                حفظ
              </button>
              <button
                onClick={() => setNotesModal({ open: false, lectureId: null, notes: '' })}
                className="btn-secondary flex-1"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Days Modal */}
      {editDaysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditDaysModal(false)}
          />
          <div className="relative bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-fade-in">
            <button
              onClick={() => setEditDaysModal(false)}
              className="absolute top-4 left-4 p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-6 text-center">
              تعديل أيام المحاضرات
            </h3>
            
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {[
                { value: 'Sunday', label: 'الأحد' },
                { value: 'Monday', label: 'الإثنين' },
                { value: 'Tuesday', label: 'الثلاثاء' },
                { value: 'Wednesday', label: 'الأربعاء' },
                { value: 'Thursday', label: 'الخميس' },
                { value: 'Friday', label: 'الجمعة' },
                { value: 'Saturday', label: 'السبت' },
              ].map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                    selectedDays.includes(day.value)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-[var(--color-border)] hover:border-primary-300'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditDaysModal(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--color-border)] font-medium hover:bg-[var(--color-bg-secondary)]"
              >
                إلغاء
              </button>
              <button
                onClick={handleCourseDaysChange}
                disabled={selectedDays.length === 0 || saving}
                className="flex-1 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {statusChangeModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                تأكيد تغيير حالة الكورس
              </h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              هل أنت متأكد من تغيير حالة الكورس إلى{' '}
              <span className="font-semibold">
                {statusChangeModal.newStatus === 'paused' ? 'متوقف' : 'منتهي'}
              </span>؟
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                السبب (اختياري)
              </label>
              <textarea
                value={statusChangeModal.reason}
                onChange={(e) => setStatusChangeModal(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 text-sm"
                rows="3"
                placeholder="أدخل سبب تغيير الحالة..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelStatusChange}
                className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={saving}
              >
                إلغاء
              </button>
              <button
                onClick={() => confirmStatusChange(statusChangeModal.newStatus, statusChangeModal.reason)}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renewal Reset Modal */}
      {renewalResetModal.open && course && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-2 sm:p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-3 sm:p-6 my-4 sm:my-8 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sm:mb-6">
              <h3 className="text-base sm:text-xl font-bold text-gray-800 dark:text-white">
                إعادة تعيين الكورس
              </h3>
              <button
                onClick={closeRenewalResetModal}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {/* Student Name (Read-only) */}
              <div>
                <label className="label text-[10px] sm:text-sm">الطالب</label>
                <div className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-xs sm:text-sm py-2 sm:py-2.5">
                  {course.is_dual && course.students?.length > 0
                    ? course.students.map(s => s.name).join(' و ')
                    : course.student?.name || course.students?.[0]?.name || 'غير محدد'}
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="label text-[10px] sm:text-sm">تاريخ البدء *</label>
                <input
                  type="date"
                  value={renewalResetModal.start_date}
                  onChange={(e) => setRenewalResetModal(prev => ({ ...prev, start_date: e.target.value }))}
                  className="input text-xs sm:text-sm py-2 sm:py-2.5"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Package */}
              <div>
                <label className="label text-[10px] sm:text-sm">الباقة *</label>
                <select
                  value={renewalResetModal.course_package_id}
                  onChange={(e) => handleRenewalPackageChange(e.target.value)}
                  className="select text-xs sm:text-sm py-2 sm:py-2.5"
                  required
                >
                  <option value="">اختر الباقة</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.price} د.ع - {pkg.lectures_count} محاضرة)
                    </option>
                  ))}
                </select>
              </div>

              {/* Lectures Count (auto-filled from package, but editable) */}
              {renewalResetModal.course_package_id && (
                <div>
                  <label className="label text-[10px] sm:text-sm">عدد المحاضرات</label>
                  <input
                    type="number"
                    value={renewalResetModal.lectures_count}
                    onChange={(e) => setRenewalResetModal(prev => ({ ...prev, lectures_count: e.target.value }))}
                    className="input text-xs sm:text-sm py-2 sm:py-2.5"
                    min="1"
                    placeholder="سيتم ملؤه تلقائياً من الباقة"
                  />
                </div>
              )}

              {/* Lecture Time */}
              <div>
                <label className="label text-[10px] sm:text-sm">وقت المحاضرة *</label>
                <input
                  type="time"
                  value={renewalResetModal.lecture_time}
                  onChange={(e) => setRenewalResetModal(prev => ({ ...prev, lecture_time: e.target.value }))}
                  className="input text-xs sm:text-sm py-2 sm:py-2.5"
                  required
                />
              </div>

              {/* Lecture Days */}
              <div>
                <label className="label text-[10px] sm:text-sm mb-1.5 sm:mb-2">أيام المحاضرات *</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  {[
                    { value: 'Sunday', label: 'الأحد' },
                    { value: 'Monday', label: 'الإثنين' },
                    { value: 'Tuesday', label: 'الثلاثاء' },
                    { value: 'Wednesday', label: 'الأربعاء' },
                    { value: 'Thursday', label: 'الخميس' },
                    { value: 'Friday', label: 'الجمعة' },
                    { value: 'Saturday', label: 'السبت' },
                  ].map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleRenewalDay(day.value)}
                      className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border-2 transition-all font-medium text-[10px] sm:text-sm ${
                        renewalResetModal.lecture_days.includes(day.value)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-300 dark:border-gray-600 hover:border-primary-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid Amount */}
              <div>
                <label className="label text-[10px] sm:text-sm">مبلغ الدفع (د.ع)</label>
                <input
                  type="number"
                  value={renewalResetModal.paid_amount}
                  onChange={(e) => handleRenewalPaidAmountChange(e.target.value)}
                  className="input text-xs sm:text-sm py-2 sm:py-2.5"
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
              </div>

              {/* Remaining Amount (Read-only) */}
              {renewalResetModal.remaining_amount && parseFloat(renewalResetModal.remaining_amount) > 0 && (
                <div>
                  <label className="label text-[10px] sm:text-sm">المتبقي (د.ع)</label>
                  <div className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-xs sm:text-sm py-2 sm:py-2.5">
                    {renewalResetModal.remaining_amount} د.ع
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  onClick={closeRenewalResetModal}
                  className="flex-1 py-2 sm:py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 font-medium text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRenewalResetSubmit}
                  disabled={saving || !renewalResetModal.start_date || !renewalResetModal.course_package_id || !renewalResetModal.lecture_time || renewalResetModal.lecture_days.length === 0}
                  className="flex-1 py-2 sm:py-2.5 rounded-lg bg-primary-600 text-white font-medium text-xs sm:text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'جاري الحفظ...' : 'إنشاء الكورس الجديد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Student Profile Modal */}
      <StudentProfileModal 
        isOpen={!!profileModalStudentId} 
        onClose={() => setProfileModalStudentId(null)} 
        studentId={profileModalStudentId} 
      />
      {/* Extra Lectures Modal */}
      {extraLecturesModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !extraLecturesModal.saving && setExtraLecturesModal({ open: false, count: 1, fee: 0, isPaid: true, paymentMethod: 'cash', saving: false })}
          />
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden relative z-10 animate-scale-up border border-[var(--color-border)]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                إضافة محاضرات إضافية
              </h3>
              <button 
                onClick={() => setExtraLecturesModal({ open: false, count: 1, fee: 0, isPaid: true, paymentMethod: 'cash', saving: false })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={extraLecturesModal.saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="label text-sm mb-1">العدد الإضافي</label>
                <input
                  type="number"
                  min="1"
                  value={extraLecturesModal.count}
                  onChange={(e) => setExtraLecturesModal(prev => ({ ...prev, count: parseInt(e.target.value) || 0 }))}
                  className="input py-2"
                />
              </div>
              <div>
                <label className="label text-sm mb-1">المبلغ المضاف (د.ع)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={extraLecturesModal.fee}
                  onChange={(e) => setExtraLecturesModal(prev => ({ ...prev, fee: parseFloat(e.target.value) || 0 }))}
                  className="input py-2"
                />
              </div>
              
              {extraLecturesModal.fee > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extraLecturesModal.isPaid}
                      onChange={(e) => setExtraLecturesModal(prev => ({ ...prev, isPaid: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                      تم استلام المبلغ للصندوق الآن
                    </span>
                  </label>
                  
                  {extraLecturesModal.isPaid && (
                    <div>
                      <label className="label text-xs mb-1">طريقة الدفع للمبلغ الإضافي</label>
                      <select
                        value={extraLecturesModal.paymentMethod}
                        onChange={(e) => setExtraLecturesModal(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        className="input py-1.5 text-sm"
                      >
                        <option value="cash">نقدي (صندوق المركز)</option>
                        <option value="zain_cash">زين كاش</option>
                        <option value="qi_card">كي كارد</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setExtraLecturesModal({ open: false, count: 1, fee: 0, isPaid: true, paymentMethod: 'cash', saving: false })}
                  className="btn-secondary flex-1"
                  disabled={extraLecturesModal.saving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddExtraLectures}
                  className="btn-primary flex-1"
                  disabled={extraLecturesModal.saving || extraLecturesModal.count < 1}
                >
                  {extraLecturesModal.saving ? 'جاري الإضافة...' : 'إضافة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Course Modal */}
      {startCourseModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 shadow-2xl backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PlayCircle className="w-6 h-6 text-green-500" />
                تحديد تاريخ بدء الكورس
              </h3>
              <button 
                onClick={() => setStartCourseModal({ open: false, date: '' })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-white dark:bg-gray-700 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm border border-blue-100 dark:border-blue-800/30 flex gap-3 leading-relaxed">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                <p>يرجى تحديد التاريخ الفعلي الذي بدأ فيه هذا الكورس. سيتم ترتيب تواريخ المحاضرات القادمة بناءً على هذا التاريخ.</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  تاريخ البدء الفعلي
                </label>
                <input
                  type="date"
                  value={startCourseModal.date}
                  onChange={(e) => setStartCourseModal({ ...startCourseModal, date: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-900/50 dark:border-gray-700 dark:focus:ring-green-500 dark:text-white transition-all outline-none"
                  dir="ltr"
                />
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setStartCourseModal({ open: false, date: '' })}
                disabled={startingCourse}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl transition-all font-medium disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleStartCourse}
                disabled={startingCourse || !startCourseModal.date}
                className={`px-5 py-2.5 text-white rounded-xl transition-all font-medium flex items-center gap-2 shadow-sm ${
                  startingCourse || !startCourseModal.date 
                    ? 'bg-gray-400 opacity-70 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 shadow-green-600/20 hover:shadow-md hover:shadow-green-600/30'
                }`}
              >
                <PlayCircle className="w-5 h-5" />
                {startingCourse ? 'جاري التفعيل...' : 'تأكيد البدء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetails;
