// Updated: 2025-12-21 - Added trainer payment column in lectures table
// Status change confirmation modal with logging
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDateShort } from '../../utils/dateFormat';
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
} from 'lucide-react';

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
  const [course, setCourse] = useState(null);
  const [lectures, setLectures] = useState([]);
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

  /**
   * Check if a lecture can be modified based on its date/time.
   * - Future lectures: Cannot be modified
   * - Today's lectures: Can be modified (regardless of time)
   * - Past lectures: Can be modified
   */
  const canModifyLecture = (lecture) => {
    const lectureDate = new Date(lecture.date);
    lectureDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Future lecture - cannot be modified
    if (lectureDate > today) {
      return {
        canModify: false,
        reason: 'محاضرة مستقبلية - لا يمكن التعديل',
        type: 'future'
      };
    }
    
    // Today's lecture or past lecture - can be modified
    return {
      canModify: true,
      reason: null,
      type: lectureDate.getTime() === today.getTime() ? 'today' : 'past'
    };
  };

  useEffect(() => {
    fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${id}`);
      setCourse(response.data);
      setLectures(response.data.lectures || []);
      
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
    setLectures(prev => prev.map(lecture => 
      lecture.id === lectureId 
        ? { ...lecture, trainer_payment_status: value }
        : lecture
    ));
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
        date: lecture.date || '',
        time: lecture.time || course?.lecture_time || '',
      });
    }
  };

  /**
   * Save individual lecture date/time
   */
  const saveLectureDateTime = async () => {
    if (!selectedLecture) return;
    
    setSaving(true);
    try {
      await api.put(`/lectures/${selectedLecture.id}`, {
        date: editingLectureDateTime.date,
        time: editingLectureDateTime.time,
      });
      
      // Update local state
      setLectures(prev => prev.map(l => 
        l.id === selectedLecture.id 
          ? { ...l, date: editingLectureDateTime.date, time: editingLectureDateTime.time }
          : l
      ));
      
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
  const saveLectures = async () => {
    if (Object.keys(editedLectures).length === 0) return;

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
        setEditedLectures({});
        // Fetch course to get updated data
        const courseResponse = await api.get(`/courses/${id}`);
        if (courseResponse.data) {
          setCourse(courseResponse.data);
          setLectures(courseResponse.data.lectures || []);
          
          // Check for evaluation milestone after saving (for trainers only)
          if (isTrainer) {
            checkEvaluationMilestone(courseResponse.data);
          }
        } else {
          fetchCourse();
        }
        console.log('Lectures saved successfully');
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
      const totalCount = lectures.length;
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
          alert('✅ تم تأكيد تجديد الاشتراك');
        }
        // No alert for 'alert' or 'none' statuses
      }
    } catch (error) {
      console.error('Error updating renewal alert status:', error);
      alert('حدث خطأ أثناء تحديث حالة التنبيه');
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border-4 border-orange-500">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                ⚠️ تنبيه: يرجى إرسال التقييم
              </h3>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-lg mb-4">
              <p className="text-gray-800 dark:text-gray-200 font-semibold mb-2">
                تم اكتمال {evaluationModal.completedLectures} محاضرة في هذا الكورس
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                يرجى إرسال التقييم للطالب قبل المتابعة. لا يمكنك الوصول إلى لوحة المحاضرات حتى يتم تأكيد إرسال التقييم.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmEvaluation}
                className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                تم إرسال التقييم
              </button>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
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
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title">{course.course_package?.name || course.coursePackage?.name || 'كورس بدون باقة'}</h1>
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
          </div>
        </div>
        {Object.keys(editedLectures).length > 0 && (
          <button
            onClick={saveLectures}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        )}
      </div>

      {/* Renewal Alert Status - Only show for courses at 75%+ completion and for customer service */}
      {isCustomerService && isAt75Percent() && (
        <div className="card bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-2 border-orange-300 dark:border-orange-700">
          <div className="p-4">
            <h3 className="text-lg font-bold text-orange-800 dark:text-orange-200 mb-3">
              ⚠️ تنبيه: الكورس على وشك الانتهاء ({calculateCompletionPercentage()}% مكتمل)
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
              يرجى إرسال رسالة للمتدرب لتجديد الاشتراك
            </p>
            
            {/* Two-stage buttons: Sent and Renewed */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => handleRenewalAlertStatusChange('sent')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
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
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
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
              
              {course.renewal_alert_status !== 'none' && course.renewal_alert_status !== 'alert' && (
                <button
                  onClick={() => handleRenewalAlertStatusChange('none')}
                  className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                >
                  إعادة تعيين
                </button>
              )}
            </div>
            
            {/* Status indicator */}
            {course.renewal_alert_status !== 'none' && course.renewal_alert_status !== 'alert' && (
              <div className="mt-3 pt-3 border-t border-orange-300 dark:border-orange-700">
                <p className="text-sm text-orange-600 dark:text-orange-400">
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
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              جدول المحاضرات
            </h2>
            <span className="badge badge-info">
              {lectures.filter((l) => {
                // Check if lecture is completed based on is_completed flag or attendance
                return l.is_completed || l.attendance === 'present' || l.attendance === 'absent';
              }).length} / {lectures.length} مكتمل
            </span>
          </div>
          
          {/* Student and Trainer Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            {/* Show students - handle both single and dual courses */}
            {course.is_dual && course.students?.length > 1 ? (
              <>
                <button
                  onClick={() => setSelectedStudentId(course.students[0]?.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedStudentId === course.students[0]?.id
                      ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                      : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                  }`}
                >
                  <User className={`w-4 h-4 ${selectedStudentId === course.students[0]?.id ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                  <span className={selectedStudentId === course.students[0]?.id ? 'text-blue-100' : 'text-[var(--color-text-muted)]'}>الطالب الأول:</span>
                  <span className="font-semibold">
                    {course.students[0]?.name || 'غير محدد'}
                  </span>
                </button>
                <button
                  onClick={() => setSelectedStudentId(course.students[1]?.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedStudentId === course.students[1]?.id
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                      : 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                  }`}
                >
                  <User className={`w-4 h-4 ${selectedStudentId === course.students[1]?.id ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
                  <span className={selectedStudentId === course.students[1]?.id ? 'text-purple-100' : 'text-[var(--color-text-muted)]'}>الطالب الثاني:</span>
                  <span className="font-semibold">
                    {course.students[1]?.name || 'غير محدد'}
                  </span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-[var(--color-text-muted)]">الطالب:</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {course.student?.name || course.students?.[0]?.name || 'غير محدد'}
                </span>
              </div>
            )}
            {course.is_dual && (
              <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                <span className="badge badge-purple text-xs">كورس ثنائي</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg">
              <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[var(--color-text-muted)]">المدرب:</span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {course.trainer?.user?.name || course.trainer?.name || 'غير محدد'}
              </span>
            </div>
          </div>
        </div>

        {/* Show selected student indicator for dual courses */}
        {course.is_dual && selectedStudentId && (
          <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm text-[var(--color-text-muted)]">عرض بيانات:</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                  {course.students?.find(s => s.id === selectedStudentId)?.name}
                </span>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                اضغط على اسم الطالب الآخر للتبديل
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>رقم</th>
                <th>التاريخ</th>
                <th>الوقت</th>
                <th>الحضور</th>
                <th>النشاط</th>
                <th>الواجب</th>
                <th>دفع المدرب</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {lectures.map((lecture) => {
                const rawEdited = editedLectures[lecture.id] || {};
                const lectureDate = new Date(lecture.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                lectureDate.setHours(0, 0, 0, 0);
                const isToday = lectureDate.getTime() === today.getTime();
                const isFuture = lectureDate > today;
                const isMakeup = lecture.is_makeup;
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
                    className={`
                      ${isCompleted ? 'bg-green-100 dark:bg-green-900/30' : ''}
                      ${isToday && !isCompleted ? 'bg-primary-50 dark:bg-primary-900/10' : ''}
                      ${isMakeup && !isCompleted ? 'bg-green-50 dark:bg-green-900/10' : ''}
                      ${isSelected ? 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-900/20' : ''}
                    `}
                  >
                    <td className="font-bold text-[var(--color-text-primary)]">
                      <div className="flex items-center gap-1">
                        {lecture.lecture_number}
                        {isMakeup && (
                          <span className="text-xs text-green-600 dark:text-green-400" title="محاضرة تعويضية">
                            (تعويضية)
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {(isCustomerService || isTrainer) && !isAccounting && isSelected ? (
                        <input
                          type="date"
                          value={editingLectureDateTime.date}
                          onChange={(e) => setEditingLectureDateTime(prev => ({ ...prev, date: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          className="input py-1 px-2 text-sm w-32"
                          dir="ltr"
                        />
                      ) : (isCustomerService || isTrainer) && !isAccounting ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLectureSelect(lecture);
                          }}
                          className="text-right w-full px-2 py-1 rounded transition-all hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          title="انقر لتعديل التاريخ والوقت"
                        >
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {formatDateShort(lecture.date)}
                          </p>
                          {isToday && (
                            <span className="text-xs text-primary-600 dark:text-primary-400 font-medium block">
                              اليوم
                            </span>
                          )}
                        </button>
                      ) : (
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {formatDateShort(lecture.date)}
                          </p>
                          {isToday && (
                            <span className="text-xs text-primary-600 dark:text-primary-400 font-medium block">
                              اليوم
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-center" dir="ltr">
                      {(isCustomerService || isTrainer) && !isAccounting && isSelected ? (
                        <div className="flex items-center gap-2">
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
                          className="text-sm font-medium px-2 py-1 rounded transition-all text-[var(--color-text-primary)] hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          title="انقر لتعديل التاريخ والوقت"
                        >
                          {formatTime12Hour(lecture.time || course?.lecture_time)}
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {formatTime12Hour(lecture.time || course?.lecture_time)}
                        </span>
                      )}
                    </td>
                    <td>
                      {['postponed_by_trainer', 'postponed_by_student', 'postponed_holiday'].includes(currentAttendance) ? (
                        <div className="flex items-center gap-2">
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
                        <select
                          value={currentAttendance}
                          onChange={(e) =>
                            handleLectureChange(lecture.id, 'attendance', e.target.value)
                          }
                          className="select text-sm py-1.5 w-28"
                          disabled={isLocked}
                        >
                          <option value="pending">لم يحدد</option>
                          <option value="present">حاضر</option>
                          <option value="absent">غائب</option>
                          <option value="postponed">مؤجل</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {isLocked || isAccounting ? (
                        <span className="text-xs text-gray-500">{getActivityLabel(currentActivity)}</span>
                      ) : (
                        <select
                          value={currentActivity ?? ''}
                          onChange={(e) => handleLectureChange(lecture.id, 'activity', e.target.value)}
                          className="select text-xs py-1 px-1.5 w-20"
                          disabled={isLocked}
                        >
                          <option value="">-</option>
                          <option value="engaged">Engaged</option>
                          <option value="normal">Normal</option>
                          <option value="not_engaged">Not Engaged</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {isLocked || isAccounting ? (
                        <span className="text-xs text-gray-500">{getHomeworkLabel(currentHomework)}</span>
                      ) : (
                        <select
                          value={currentHomework ?? ''}
                          onChange={(e) => handleLectureChange(lecture.id, 'homework', e.target.value)}
                          className="select text-xs py-1 px-1.5 w-20"
                          disabled={isLocked}
                        >
                          <option value="">-</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                          <option value="partial">Partial</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {(isCustomerService || isAccounting) ? (
                        <select
                          value={lecture.trainer_payment_status || 'unpaid'}
                          onChange={(e) => handleTrainerPaymentChange(lecture.id, e.target.value)}
                          className={`select text-xs py-1 px-1.5 w-20 ${
                            lecture.trainer_payment_status === 'paid' 
                              ? 'text-green-600 bg-green-50 dark:bg-green-900/20' 
                              : 'text-red-500 bg-red-50 dark:bg-red-900/20'
                          }`}
                        >
                          <option value="unpaid">غير مدفوع</option>
                          <option value="paid">مدفوع</option>
                        </select>
                      ) : (
                        <span className={`text-xs ${lecture.trainer_payment_status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                          {lecture.trainer_payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      {isLocked ? (
                        <span className="text-sm text-gray-500">
                          {(rawEdited.notes ?? lecture.notes) ? (
                            <button
                              onClick={() => setReasonPopup({ 
                                open: true, 
                                reason: rawEdited.notes ?? lecture.notes 
                              })}
                              className="text-blue-500 hover:text-blue-600"
                              title="عرض الملاحظة"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          ) : '-'}
                        </span>
                      ) : isAccounting ? (
                        <span className="text-sm text-gray-500">
                          {(rawEdited.notes ?? lecture.notes) ? (
                            <button
                              onClick={() => setReasonPopup({ 
                                open: true, 
                                reason: rawEdited.notes ?? lecture.notes 
                              })}
                              className="text-blue-500 hover:text-blue-600"
                              title="عرض الملاحظة"
                            >
                              <MessageSquare className="w-4 h-4" />
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
                          className={`p-1.5 rounded-lg transition-colors ${
                            (rawEdited.notes ?? lecture.notes)
                              ? 'text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                          title={rawEdited.notes ?? lecture.notes ?? 'إضافة ملاحظة'}
                        >
                          <MessageSquare className="w-4 h-4" />
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
              {postponementStats && (
                <div className={`p-3 rounded-lg ${
                  postponementStats.can_postpone 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {postponementStats.can_postpone ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-sm">
                      التأجيلات: {postponementStats.total_postponements} / {postponementStats.max_allowed}
                      {!postponementStats.can_postpone && ' (تم الوصول للحد الأقصى)'}
                    </span>
                  </div>
                </div>
              )}

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
                  min={new Date().toISOString().split('T')[0]}
                  className="input w-full"
                  dir="ltr"
                />
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
                  (postponementStats && !postponementStats.can_postpone) ||
                  (postponeModal.conflicts && postponeModal.conflicts.length > 0 && !postponeModal.forceOverride)
                }
                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  postponeModal.selectedType && 
                  postponeModal.newDate && 
                  !postponeModal.checking && 
                  (!postponementStats || postponementStats.can_postpone) &&
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
    </div>
  );
};

export default CourseDetails;
