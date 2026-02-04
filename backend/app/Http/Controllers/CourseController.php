<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Lecture;
use App\Models\CoursePackage;
use App\Models\CourseStatusHistory;
use App\Models\ActivityLog;
use App\Models\Payment;
use Illuminate\Http\Request;
use Carbon\Carbon;

class CourseController extends Controller
{
    /**
     * Display a listing of courses.
     */
    public function index(Request $request)
    {
        $query = Course::with(['trainer.user', 'students', 'coursePackage']);

        // Filter by trainer for trainer role (if user is authenticated)
        $user = $request->user();
        if ($user && method_exists($user, 'isTrainer') && $user->isTrainer()) {
            $trainerId = $user->trainer->id ?? null;
            if ($trainerId) {
                $query->where('trainer_id', $trainerId);
            }
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by trainer
        if ($request->has('trainer_id')) {
            $query->where('trainer_id', $request->trainer_id);
        }

        // Filter by student (using pivot table)
        if ($request->has('student_id')) {
            $query->whereHas('students', function ($q) use ($request) {
                $q->where('students.id', $request->student_id);
            });
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('coursePackage', function ($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('student', function ($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('trainer.user', function ($tq) use ($search) {
                      $tq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // For trainers, get all courses (no pagination limit)
        // For other roles, use pagination
        if ($user && method_exists($user, 'isTrainer') && $user->isTrainer()) {
            $courses = $query->with(['lectures', 'coursePackage'])
                            ->withCount('lectures')
                            ->orderBy('id', 'asc')
                            ->get()
                            ->map(function ($course) {
                                // Ensure coursePackage is loaded
                                if (!$course->relationLoaded('coursePackage')) {
                                    $course->load('coursePackage');
                                }
                                
                                // Count completed lectures: either is_completed=true OR attendance is present/absent
                                $completedCount = $course->lectures->filter(function ($lecture) {
                                    return $lecture->is_completed || in_array($lecture->attendance, ['present', 'absent']);
                                })->count();
                                $totalCount = $course->lectures->count();
                                $completionPercentage = $totalCount > 0 ? round(($completedCount / $totalCount) * 100) : 0;
                                
                                // Add attributes to the course model
                                $course->completed_lectures_count = $completedCount;
                                $course->completion_percentage = $completionPercentage;
                                
                                // Make coursePackage visible
                                $course->makeVisible('coursePackage');
                                
                                return $course;
                            });
            
            return response()->json([
                'data' => $courses,
                'total' => $courses->count(),
                'current_page' => 1,
                'per_page' => $courses->count(),
                'last_page' => 1,
            ]);
        }

        $courses = $query->with(['lectures', 'coursePackage'])
                        ->withCount('lectures')
                        ->orderBy('id', 'asc')
                        ->paginate(15);

        // Add completion percentage to each course
        $courses->getCollection()->transform(function ($course) {
            // Ensure coursePackage is loaded
            if (!$course->relationLoaded('coursePackage')) {
                $course->load('coursePackage');
            }
            
            // Count completed lectures: either is_completed=true OR attendance is present/absent
            $completedCount = $course->lectures->filter(function ($lecture) {
                return $lecture->is_completed || in_array($lecture->attendance, ['present', 'absent']);
            })->count();
            $totalCount = $course->lectures->count();
            $completionPercentage = $totalCount > 0 ? round(($completedCount / $totalCount) * 100) : 0;
            
            // Add attributes to the course model
            $course->completed_lectures_count = $completedCount;
            $course->completion_percentage = $completionPercentage;
            
            // Make coursePackage visible and ensure it's serialized as course_package
            $course->makeVisible('coursePackage');
            
            return $course;
        });

        return response()->json($courses);
    }

    /**
     * Store a newly created course and generate lectures schedule.
     */
    public function store(Request $request)
    {
        $isCustom = $request->input('is_custom', false);
        
        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'student_id' => 'required_without:student_ids|exists:students,id',
            'student_ids' => 'required_without:student_id|array|min:1',
            'student_ids.*' => 'exists:students,id',
            'course_package_id' => $isCustom ? 'nullable' : 'required|exists:course_packages,id',
            'lectures_count' => 'required|integer|min:1',
            'start_date' => 'required|date',
            'lecture_time' => 'required|date_format:H:i',
            'lecture_days' => 'required|array|min:1',
            'lecture_days.*' => 'in:sun,mon,tue,wed,thu,fri,sat',
            'is_dual' => 'sometimes|boolean',
            'renewed_with_trainer' => 'sometimes|boolean',
            'paid_amount' => 'sometimes|numeric|min:0',
            'remaining_amount' => 'sometimes|numeric|min:0',
            'payment_method' => 'nullable|in:zain_cash,qi_card,delivery',
            'is_custom' => 'sometimes|boolean',
            'custom_total_amount' => $isCustom ? 'required|numeric|min:0' : 'nullable|numeric|min:0',
        ]);

        // Get lectures count from package or custom
        if ($isCustom) {
            $lecturesCount = $request->lectures_count;
        } else {
            $package = CoursePackage::find($request->course_package_id);
            $lecturesCount = $request->lectures_count ?? $package->lectures_count;
        }

        // Determine if dual course and get primary student
        $isDual = $request->is_dual ?? false;
        $studentIds = $request->student_ids ?? ($request->student_id ? [$request->student_id] : []);

        if (empty($studentIds)) {
            return response()->json(['message' => 'يجب تحديد طالب واحد على الأقل'], 422);
        }

        // Automatically determine if this is a renewal with the same trainer
        $renewedWithTrainer = false;
        if (!empty($studentIds)) {
            // If previous_course_id is provided (renewal reset scenario), use it directly
            $previousCourseId = $request->input('previous_course_id');
            if ($previousCourseId) {
                $previousCourse = Course::find($previousCourseId);
                // If previous course exists and was with the same trainer, it's a renewal
                if ($previousCourse && $previousCourse->trainer_id == $request->trainer_id) {
                    // Verify that the previous course has the same students
                    $previousStudentIds = $previousCourse->students->pluck('id')->toArray();
                    if (count(array_intersect($studentIds, $previousStudentIds)) > 0) {
                        $renewedWithTrainer = true;
                    }
                }
            } else {
                // Find previous course(s) for the same student(s) by start_date
                $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                    $query->whereIn('students.id', $studentIds);
                })
                ->where('start_date', '<', $request->start_date)
                ->orderBy('start_date', 'desc')
                ->first();
                
                // If there's a previous course and it was with the same trainer, it's a renewal
                if ($previousCourse && $previousCourse->trainer_id == $request->trainer_id) {
                    $renewedWithTrainer = true;
                }
            }
        }

        $courseData = [
            'trainer_id' => $request->trainer_id,
            'course_package_id' => $isCustom ? null : $request->course_package_id,
            'lectures_count' => $lecturesCount,
            'start_date' => $request->start_date,
            'lecture_time' => $request->lecture_time,
            'lecture_days' => $request->lecture_days,
            'is_dual' => $isDual,
            'renewed_with_trainer' => $renewedWithTrainer,
            'payment_method' => $request->payment_method,
            'status' => 'active',
        ];
        
        // For custom courses, set total_amount and amount_paid
        if ($isCustom) {
            $customTotalAmount = floatval($request->input('custom_total_amount', 0));
            $courseData['total_amount'] = $customTotalAmount;
            
            if ($isDual) {
                // For dual courses, sum all paid amounts
                $studentPayments = $request->input('student_payments', []);
                $totalPaid = 0;
                foreach ($studentPayments as $payment) {
                    $totalPaid += floatval($payment['paid_amount'] ?? 0);
                }
                $courseData['amount_paid'] = $totalPaid;
            } else {
                // For single courses, use paid_amount
                $courseData['amount_paid'] = floatval($request->input('paid_amount', 0));
            }
        }
        
        $course = Course::create($courseData);

        // Attach students to course (for dual courses)
        foreach ($studentIds as $index => $studentId) {
            $course->students()->attach($studentId, [
                'is_primary' => $index === 0,
            ]);
        }

        // Generate lecture schedule
        $this->generateLectureSchedule($course);

        // Create payment record(s) if paid_amount is provided
        if ($isDual && count($studentIds) > 1) {
            // For dual courses, check if student_payments array is provided
            $studentPayments = $request->input('student_payments', []);
            if (!empty($studentPayments) && is_array($studentPayments)) {
                // Create separate payment for each student with their specific amount
                foreach ($studentIds as $index => $studentId) {
                    $studentPayment = $studentPayments[$index] ?? null;
                    if ($studentPayment && isset($studentPayment['paid_amount'])) {
                        $paidAmount = floatval($studentPayment['paid_amount'] ?? 0);
                        if ($paidAmount > 0) {
                            Payment::create([
                                'course_id' => $course->id,
                                'student_id' => $studentId,
                                'amount' => $paidAmount,
                                'payment_method' => null,
                                'status' => 'completed',
                                'payment_date' => $request->start_date ?? now()->toDateString(),
                                'receipt_number' => null,
                                'notes' => 'دفعة أولية عند إنشاء الكورس',
                                'recorded_by' => auth()->id(),
                            ]);
                        }
                    }
                }
            } else {
                // Fallback: use paid_amount if student_payments not provided
                $paidAmount = $request->paid_amount ?? 0;
                if ($paidAmount > 0) {
                    foreach ($studentIds as $studentId) {
                        Payment::create([
                            'course_id' => $course->id,
                            'student_id' => $studentId,
                            'amount' => $paidAmount,
                            'payment_method' => null,
                            'status' => 'completed',
                            'payment_date' => $request->start_date ?? now()->toDateString(),
                            'receipt_number' => null,
                            'notes' => 'دفعة أولية عند إنشاء الكورس',
                            'recorded_by' => auth()->id(),
                        ]);
                    }
                }
            }
        } else {
            // For single courses, create one payment for the primary student
            $paidAmount = $request->paid_amount ?? 0;
            if ($paidAmount > 0) {
                $primaryStudentId = $studentIds[0] ?? null;
                if ($primaryStudentId) {
                    Payment::create([
                        'course_id' => $course->id,
                        'student_id' => $primaryStudentId,
                        'amount' => $paidAmount,
                        'payment_method' => null,
                        'status' => 'completed',
                        'payment_date' => $request->start_date ?? now()->toDateString(),
                        'receipt_number' => null,
                        'notes' => 'دفعة أولية عند إنشاء الكورس',
                        'recorded_by' => auth()->id(),
                    ]);
                }
            }
        }

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures']);
        
        // Make coursePackage visible and ensure it's serialized as course_package
        $course->makeVisible('coursePackage');
        
        // Manually add course_package to ensure it's in the response
        $courseArray = $course->toArray();
        if ($course->coursePackage) {
            $courseArray['course_package'] = $course->coursePackage->toArray();
        }

        return response()->json($courseArray, 201);
    }

    /**
     * Display the specified course.
     */
    public function show(Request $request, Course $course)
    {
        // Check authorization for trainers (if user is authenticated)
        $user = $request->user();
        if ($user && method_exists($user, 'isTrainer') && $user->isTrainer()) {
            $trainerId = $user->trainer->id ?? null;
            if ($trainerId && $course->trainer_id !== $trainerId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures', 'payments']);
        
        // Make coursePackage visible and ensure it's serialized as course_package
        $course->makeVisible('coursePackage');
        
        // Manually add course_package to ensure it's in the response
        $courseArray = $course->toArray();
        if ($course->coursePackage) {
            $courseArray['course_package'] = $course->coursePackage->toArray();
        }
        
        return response()->json($courseArray);
    }

    /**
     * Update the specified course.
     */
    public function update(Request $request, Course $course)
    {
        $request->validate([
            'status' => 'sometimes|required|in:active,paused,finished,paid,cancelled',
            'lecture_time' => 'sometimes|date_format:H:i',
            'lecture_days' => 'sometimes|array|min:1',
            'lecture_days.*' => 'in:sun,mon,tue,wed,thu,fri,sat',
            'trainer_payment_status' => 'sometimes|required|in:unpaid,paid',
            'renewal_status' => 'sometimes|in:alert,messaged,subscribed',
        ]);

        $course->update($request->only(['status', 'lecture_time', 'lecture_days', 'trainer_payment_status', 'renewal_status']));

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures']);
        
        // Make coursePackage visible and ensure it's serialized as course_package
        $course->makeVisible('coursePackage');
        
        // Manually add course_package to ensure it's in the response
        $courseArray = $course->toArray();
        if ($course->coursePackage) {
            $courseArray['course_package'] = $course->coursePackage->toArray();
        }

        return response()->json($courseArray);
    }

    /**
     * Update course status with logging
     * Updated: 2025-12-21 - Added status change confirmation and logging
     */
    public function updateStatus(Request $request, Course $course)
    {
        $request->validate([
            'status' => 'required|in:active,paused,finished,paid,cancelled',
            'reason' => 'nullable|string|max:255',
        ]);

        $oldStatus = $course->status;
        $newStatus = $request->status;

        // Update course status
        $course->update(['status' => $newStatus]);

        // Log status change in CourseStatusHistory
        CourseStatusHistory::create([
            'course_id' => $course->id,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'changed_by' => auth()->id(),
            'reason' => $request->reason,
        ]);

        // Log in ActivityLog (with error handling)
        try {
            ActivityLog::create([
                'user_id' => auth()->id(),
                'action' => 'course_status_changed',
                'model_type' => 'Course',
                'model_id' => $course->id,
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => $newStatus],
                'description' => "تم تغيير حالة الكورس من {$oldStatus} إلى {$newStatus}" . ($request->reason ? " - السبب: {$request->reason}" : ''),
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Log::warning('Failed to log activity: ' . $e->getMessage());
        }

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures']);
        
        // Make coursePackage visible
        $course->makeVisible('coursePackage');

        return response()->json([
            'success' => true,
            'message' => 'تم تغيير حالة الكورس بنجاح',
            'data' => $course,
        ]);
    }

    /**
     * Update renewal alert status for a course.
     */
    public function updateRenewalAlertStatus(Request $request, Course $course)
    {
        $request->validate([
            'renewal_alert_status' => 'required|in:none,alert,sent,renewed',
        ]);

        $oldStatus = $course->renewal_alert_status;
        $course->renewal_alert_status = $request->renewal_alert_status;
        $course->save();

        // Log the change
        try {
            ActivityLog::create([
                'user_id' => $request->user()->id ?? null,
                'action' => 'update_renewal_alert_status',
                'model_type' => Course::class,
                'model_id' => $course->id,
                'old_data' => ['renewal_alert_status' => $oldStatus],
                'new_data' => ['renewal_alert_status' => $request->renewal_alert_status],
                'description' => "تم تغيير حالة تنبيه التجديد من '{$oldStatus}' إلى '{$request->renewal_alert_status}'",
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to log renewal alert status change: ' . $e->getMessage());
        }

        $course->load(['trainer.user', 'students', 'coursePackage']);
        $course->makeVisible('coursePackage');

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث حالة تنبيه التجديد بنجاح',
            'data' => $course,
        ]);
    }

    /**
     * Confirm evaluation sent for a milestone (every 5 completed lectures)
     */
    public function confirmEvaluationSent(Request $request, Course $course)
    {
        $user = $request->user();
        
        // Only trainers can confirm evaluation
        if (!$user || !method_exists($user, 'isTrainer') || !$user->isTrainer()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }
        
        // Verify trainer owns this course
        $trainerId = $user->trainer->id ?? null;
        if ($trainerId && $course->trainer_id !== $trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }
        
        $request->validate([
            'milestone' => 'required|integer|min:5',
        ]);
        
        $milestone = $request->input('milestone');
        
        // Verify milestone is a multiple of 5
        if ($milestone % 5 !== 0) {
            return response()->json([
                'success' => false,
                'message' => 'Milestone must be a multiple of 5'
            ], 400);
        }
        
        // Update last evaluation milestone
        $course->last_evaluation_milestone = $milestone;
        $course->save();
        
        // Log the action
        try {
            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'confirm_evaluation_sent',
                'model_type' => Course::class,
                'model_id' => $course->id,
                'old_data' => ['last_evaluation_milestone' => $course->getOriginal('last_evaluation_milestone')],
                'new_data' => ['last_evaluation_milestone' => $milestone],
                'description' => "تم تأكيد إرسال التقييم عند milestone {$milestone} محاضرة",
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to log evaluation confirmation: ' . $e->getMessage());
        }
        
        $course->load(['trainer.user', 'students', 'coursePackage']);
        $course->makeVisible('coursePackage');
        
        return response()->json([
            'success' => true,
            'message' => 'تم تأكيد إرسال التقييم بنجاح',
            'data' => $course,
        ]);
    }

    /**
     * Remove the specified course.
     */
    public function destroy(Course $course)
    {
        $course->delete();

        return response()->json(null, 204);
    }

    /**
     * Generate lecture schedule based on course settings.
     */
    private function generateLectureSchedule(Course $course)
    {
        $dayMap = [
            'sun' => Carbon::SUNDAY,
            'mon' => Carbon::MONDAY,
            'tue' => Carbon::TUESDAY,
            'wed' => Carbon::WEDNESDAY,
            'thu' => Carbon::THURSDAY,
            'fri' => Carbon::FRIDAY,
            'sat' => Carbon::SATURDAY,
        ];

        $lectureDays = array_map(fn($day) => $dayMap[$day], $course->lecture_days);
        $startDate = Carbon::parse($course->start_date);
        $currentDate = $startDate->copy();
        $lecturesCreated = 0;

        while ($lecturesCreated < $course->lectures_count) {
            if (in_array($currentDate->dayOfWeek, $lectureDays)) {
                Lecture::create([
                    'course_id' => $course->id,
                    'lecture_number' => $lecturesCreated + 1,
                    'date' => $currentDate->format('Y-m-d'),
                    'attendance' => 'pending',
                ]);
                $lecturesCreated++;
            }
            $currentDate->addDay();
        }
    }

    /**
     * Get dashboard statistics.
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        
        $query = Course::query();
        
        if ($user->isTrainer()) {
            $query->where('trainer_id', $user->trainer->id);
        }

        $stats = [
            'total_courses' => $query->count(),
            'active_courses' => (clone $query)->where('status', 'active')->count(),
            'completed_courses' => (clone $query)->where('status', 'completed')->count(),
            'cancelled_courses' => (clone $query)->where('status', 'cancelled')->count(),
        ];

        if (!$user->isTrainer()) {
            $stats['total_students'] = \App\Models\Student::count();
            $stats['total_trainers'] = \App\Models\Trainer::count();
        }

        return response()->json($stats);
    }

    /**
     * Get courses nearing completion (3 lectures or less remaining).
     */
    public function nearingCompletion(Request $request)
    {
        $courses = Course::with(['trainer', 'student', 'coursePackage', 'lectures'])
            ->where('status', 'active')
            ->get()
            ->filter(function ($course) {
                $completedLectures = $course->lectures->where('is_completed', true)->count();
                $totalLectures = $course->lectures->count();
                $remainingLectures = $totalLectures - $completedLectures;
                return $remainingLectures <= 3 && $remainingLectures > 0;
            })
            ->map(function ($course) {
                $completedLectures = $course->lectures->where('is_completed', true)->count();
                $totalLectures = $course->lectures->count();
                return [
                    'id' => $course->id,
                    'package' => $course->coursePackage,
                    'student' => $course->student,
                    'trainer' => $course->trainer,
                    'completed_lectures' => $completedLectures,
                    'total_lectures' => $totalLectures,
                    'remaining_lectures' => $totalLectures - $completedLectures,
                    'renewal_status' => $course->renewal_status ?? 'alert',
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $courses
        ]);
    }

    /**
     * Bulk update lectures for a course.
     */
    public function bulkUpdateLectures(Request $request, Course $course)
    {
        $user = $request->user();
        
        // Check authorization for trainers
        if ($user && method_exists($user, 'isTrainer') && $user->isTrainer()) {
            $trainerId = $user->trainer->id;
            if ($course->trainer_id !== $trainerId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        $request->validate([
            'lectures' => 'required|array',
            'lectures.*.id' => 'required|exists:lectures,id',
        ]);

        $lectureController = new \App\Http\Controllers\LectureController();
        $updatedCount = 0;

        foreach ($request->lectures as $lectureData) {
            $lecture = Lecture::find($lectureData['id']);
            if ($lecture && $lecture->course_id === $course->id) {
                // Check if lecture can be modified using reflection
                $reflection = new \ReflectionClass($lectureController);
                $canModifyMethod = $reflection->getMethod('canModifyLecture');
                $canModifyMethod->setAccessible(true);
                $canModify = $canModifyMethod->invoke($lectureController, $lecture);
                
                if (!$canModify['canModify']) {
                    continue;
                }

                // Prepare update data based on user role
                $updateData = [];
                
                // All users can update attendance, activity, homework, notes
                if (isset($lectureData['attendance'])) {
                    $updateData['attendance'] = $lectureData['attendance'];
                }
                if (isset($lectureData['activity'])) {
                    $updateData['activity'] = $lectureData['activity'];
                }
                if (isset($lectureData['homework'])) {
                    $updateData['homework'] = $lectureData['homework'];
                }
                if (isset($lectureData['notes'])) {
                    $updateData['notes'] = $lectureData['notes'];
                }
                
                // Handle student_attendance for dual courses
                if (isset($lectureData['student_attendance']) && is_array($lectureData['student_attendance'])) {
                    \Log::info('Processing student_attendance', [
                        'lecture_id' => $lecture->id,
                        'received_data' => $lectureData['student_attendance'],
                        'existing_data' => $lecture->student_attendance
                    ]);
                    
                    // Get existing student_attendance or initialize empty array
                    $existingStudentAttendance = $lecture->student_attendance ?? [];
                    
                    // Convert existing to associative array if it's a numeric array
                    if (!empty($existingStudentAttendance) && array_keys($existingStudentAttendance) === range(0, count($existingStudentAttendance) - 1)) {
                        // It's a numeric array, convert to empty object (we'll rebuild from new data)
                        $existingStudentAttendance = [];
                    }
                    
                    // Merge new student attendance data with existing (preserve keys)
                    // Use array_merge_recursive to properly merge nested arrays
                    $mergedStudentAttendance = $existingStudentAttendance;
                    foreach ($lectureData['student_attendance'] as $studentId => $studentData) {
                        if (is_array($studentData)) {
                            // Merge with existing data for this student, or create new
                            $mergedStudentAttendance[$studentId] = array_merge(
                                $mergedStudentAttendance[$studentId] ?? [],
                                $studentData
                            );
                        }
                    }
                    
                    // For each student in the merged data, handle auto-completion
                    foreach ($mergedStudentAttendance as $studentId => $studentData) {
                        if (is_array($studentData) && isset($studentData['attendance'])) {
                            $studentAttendance = $studentData['attendance'];
                            // Auto-complete if attendance is present or absent
                            if ($studentAttendance === 'present' || $studentAttendance === 'absent') {
                                $mergedStudentAttendance[$studentId]['is_completed'] = true;
                            } elseif ($studentAttendance === 'pending') {
                                $mergedStudentAttendance[$studentId]['is_completed'] = false;
                            }
                        }
                    }
                    
                    \Log::info('Merged student_attendance', [
                        'lecture_id' => $lecture->id,
                        'merged_data' => $mergedStudentAttendance
                    ]);
                    
                    // Ensure keys are strings (JSON requires string keys for objects)
                    $finalStudentAttendance = [];
                    foreach ($mergedStudentAttendance as $studentId => $studentData) {
                        $finalStudentAttendance[(string)$studentId] = $studentData;
                    }
                    
                    $updateData['student_attendance'] = $finalStudentAttendance;
                }

                // Finance and customer_service can update trainer_payment_status
                if (($user->isFinance() || $user->isAccounting() || $user->isCustomerService()) && isset($lectureData['trainer_payment_status'])) {
                    $updateData['trainer_payment_status'] = $lectureData['trainer_payment_status'];
                }
                
                // Trainers and customer_service can update date and time
                if (($user->isTrainer() || $user->isCustomerService()) && isset($lectureData['date'])) {
                    $updateData['date'] = $lectureData['date'];
                }
                if (($user->isTrainer() || $user->isCustomerService()) && isset($lectureData['time'])) {
                    $updateData['time'] = $lectureData['time'];
                }

                // Auto-complete lecture when attendance is set to 'present' or 'absent'
                if (isset($lectureData['attendance'])) {
                    $attendance = $lectureData['attendance'];
                    if ($attendance === 'present' || $attendance === 'absent') {
                        $updateData['is_completed'] = true;
                    } elseif ($attendance === 'pending') {
                        // If attendance is reset to pending, mark as not completed
                        $updateData['is_completed'] = false;
                    }
                }

                if (!empty($updateData)) {
                    try {
                        // Save old data for logging
                        $oldData = $lecture->only(['attendance', 'activity', 'homework', 'notes', 'date', 'time', 'is_completed', 'student_attendance', 'trainer_payment_status']);
                        
                        $lecture->update($updateData);
                        
                        // Log trainer_payment_status change in ActivityLog if it was changed
                        if (isset($updateData['trainer_payment_status']) && 
                            ($oldData['trainer_payment_status'] ?? 'unpaid') !== $updateData['trainer_payment_status']) {
                            try {
                                ActivityLog::create([
                                    'user_id' => $user->id,
                                    'action' => 'lecture_trainer_payment_status_changed',
                                    'model_type' => 'Lecture',
                                    'model_id' => $lecture->id,
                                    'old_values' => ['trainer_payment_status' => $oldData['trainer_payment_status'] ?? 'unpaid'],
                                    'new_values' => ['trainer_payment_status' => $updateData['trainer_payment_status']],
                                    'description' => "تم تغيير حالة دفع المدرب للمحاضرة رقم {$lecture->lecture_number} من " . 
                                                   ($oldData['trainer_payment_status'] ?? 'unpaid') . " إلى {$updateData['trainer_payment_status']}",
                                    'ip_address' => $request->ip(),
                                ]);
                            } catch (\Exception $logError) {
                                // Log error but don't fail the update
                                \Log::error('Failed to log trainer payment status change', [
                                    'lecture_id' => $lecture->id,
                                    'error' => $logError->getMessage()
                                ]);
                            }
                            
                            // Recalculate trainer payroll automatically when payment status changes
                            if ($updateData['trainer_payment_status'] === 'paid' || ($oldData['trainer_payment_status'] ?? 'unpaid') === 'paid') {
                                try {
                                    $course = $lecture->course;
                                    if ($course && $course->trainer_id) {
                                        $lectureDate = \Carbon\Carbon::parse($lecture->date);
                                        $month = $lectureDate->month;
                                        $year = $lectureDate->year;
                                        
                                        // Recalculate payroll for this trainer and month
                                        $startDate = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
                                        $endDate = \Carbon\Carbon::create($year, $month, 1)->endOfMonth();
                                        
                                        // Calculate completed paid lectures
                                        $completedLectures = \App\Models\Lecture::whereHas('course', function ($query) use ($course) {
                                                $query->where('trainer_id', $course->trainer_id);
                                            })
                                            ->whereBetween('date', [$startDate, $endDate])
                                            ->where('trainer_payment_status', 'paid')
                                            ->get()
                                            ->filter(function ($l) {
                                                if ($l->student_attendance && is_array($l->student_attendance)) {
                                                    foreach ($l->student_attendance as $studentData) {
                                                        if (is_array($studentData)) {
                                                            $attendance = $studentData['attendance'] ?? null;
                                                            if ($attendance === 'present' || $attendance === 'absent') {
                                                                return true;
                                                            }
                                                        }
                                                    }
                                                }
                                                return $l->is_completed || in_array($l->attendance, ['present', 'partially', 'absent']);
                                            })
                                            ->count();
                                        
                                        // Find or create payroll record
                                        $lectureRate = 4000;
                                        $basePay = $completedLectures * $lectureRate;
                                        
                                        $payroll = \App\Models\TrainerPayroll::firstOrCreate(
                                            [
                                                'trainer_id' => $course->trainer_id,
                                                'month' => $month,
                                                'year' => $year,
                                            ],
                                            [
                                                'lecture_rate' => $lectureRate,
                                                'renewal_bonus_rate' => 0,
                                                'completed_lectures' => $completedLectures,
                                                'base_pay' => $basePay,
                                                'renewals_count' => 0,
                                                'renewal_total' => 0,
                                                'volume_bonus' => 0,
                                                'competition_bonus' => 0,
                                                'status' => 'draft',
                                            ]
                                        );
                                        
                                        // Update and recalculate
                                        $payroll->completed_lectures = $completedLectures;
                                        $payroll->base_pay = $basePay;
                                        $payroll->recalculate();
                                        $payroll->save();
                                        
                                        \Log::info('Trainer payroll recalculated automatically', [
                                            'trainer_id' => $course->trainer_id,
                                            'month' => $month,
                                            'year' => $year,
                                            'completed_lectures' => $completedLectures,
                                            'base_pay' => $payroll->base_pay,
                                            'payroll_id' => $payroll->id,
                                        ]);
                                    }
                                } catch (\Exception $recalcError) {
                                    // Log error but don't fail the update
                                    \Log::error('Failed to recalculate trainer payroll', [
                                        'lecture_id' => $lecture->id,
                                        'error' => $recalcError->getMessage()
                                    ]);
                                }
                            }
                        }
                        
                        // Log the modification using reflection
                        try {
                            $logMethod = $reflection->getMethod('logLectureModification');
                            $logMethod->setAccessible(true);
                            $logMethod->invoke($lectureController, $lecture, $oldData, $updateData, $user);
                        } catch (\Exception $logError) {
                            // Log error but don't fail the update
                            \Log::error('Failed to log lecture modification', [
                                'lecture_id' => $lecture->id,
                                'error' => $logError->getMessage()
                            ]);
                        }
                        
                        $updatedCount++;
                    } catch (\Exception $e) {
                        \Log::error('Failed to update lecture', [
                            'lecture_id' => $lecture->id,
                            'update_data' => $updateData,
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString()
                        ]);
                        // Continue with other lectures
                    }
                }
            } else {
                \Log::warning('Lecture not found or doesn\'t belong to course', [
                    'lecture_id' => $lectureData['id'] ?? 'missing',
                    'course_id' => $course->id
                ]);
            }
        }

        $course->load('lectures');

        return response()->json([
            'success' => true,
            'message' => "تم تحديث {$updatedCount} محاضرة بنجاح",
            'data' => $course,
            'updated_count' => $updatedCount
        ]);
    }
}




