<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Student;
use App\Models\Lecture;
use App\Models\CoursePackage;
use App\Models\CourseStatusHistory;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Services\LecturePostponementService;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class CourseController extends Controller
{
    /**
     * Display a listing of courses.
     */
    public function index(Request $request)
    {
        $query = Course::select([
                'courses.*',
                DB::raw("SUM(CASE WHEN lectures.id IS NOT NULL AND (lectures.attendance IS NULL OR lectures.attendance NOT LIKE 'postponed_%') THEN 1 ELSE 0 END) as total_lectures_count"),
                DB::raw("SUM(CASE WHEN lectures.attendance IN ('present', 'partially', 'absent') THEN 1 ELSE 0 END) as completed_lectures_count"),
                DB::raw("SUM(CASE WHEN lectures.attendance = 'postponed_by_student' THEN 1 ELSE 0 END) as student_postponement_count"),
                DB::raw("SUM(CASE WHEN lectures.attendance = 'postponed_by_trainer' THEN 1 ELSE 0 END) as trainer_postponement_count"),
                DB::raw("MAX(CASE WHEN lectures.trainer_id IS NOT NULL AND lectures.trainer_id != courses.trainer_id THEN 1 ELSE 0 END) as has_trainer_changed")
            ])
            ->leftJoin('lectures', 'courses.id', '=', 'lectures.course_id')
            ->groupBy('courses.id')
            ->with(['trainer.user', 'students', 'coursePackage'])
            ->whereHas('trainer.user');


        // Filter by trainer for trainer role (if user is authenticated)
        $user = $request->user();
        if ($user && method_exists($user, 'isTrainer') && $user->isTrainer()) {
            $trainerId = $user->trainer->id ?? null;
            if ($trainerId) {
                $query->where('courses.trainer_id', $trainerId);
            }
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('courses.status', $request->status);
        }

        // Filter by trainer
        if ($request->has('trainer_id')) {
            $query->where('courses.trainer_id', $request->trainer_id);
        }

        // Filter by student (using pivot table)
        if ($request->has('student_id')) {
            $query->whereHas('students', function ($q) use ($request) {
                $q->where('students.id', $request->student_id);
            });
        }

        // Filter by category (kids vs regular)
        if ($request->has('category') && $request->category !== 'all') {
            if ($request->category === 'kids') {
                $query->where('courses.is_kids', true);
            } elseif ($request->category === 'regular') {
                $query->where('courses.is_kids', false);
            }
        }

        // Search
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('coursePackage', function ($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('students', function ($sq) use ($search) {
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
                            ->orderBy('courses.id', 'asc')
                            ->get()
                            ->map(function ($course) {
                                // Ensure coursePackage is loaded
                                if (!$course->relationLoaded('coursePackage')) {
                                    $course->load('coursePackage');
                                }
                                
                                // Manually associate parent course instance to avoid N+1 query loops during serialization
                                foreach ($course->lectures as $lecture) {
                                    $lecture->setRelation('course', $course);
                                }
                                
                                // Count completed lectures: either is_completed=true OR attendance is present/absent
                                // Exclude postponed lectures
                                $validLectures = $course->lectures->filter(function ($lecture) {
                                    return !str_starts_with($lecture->attendance ?? '', 'postponed_');
                                });
                                $completedCount = $validLectures->filter(function ($lecture) {
                                    return $lecture->is_completed || in_array($lecture->attendance, ['present', 'absent']);
                                })->count();
                                $totalCount = $validLectures->count();
                                $totalRequired = $course->lectures_count ?: $totalCount;
                                $completionPercentage = $totalRequired > 0 ? round(($completedCount / $totalRequired) * 100) : 0;
                                
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

        $perPage = (int) $request->input('per_page', 15);
        $courses = $query->with(['coursePackage', 'students'])
                        ->orderBy('courses.id', 'asc')
                        ->paginate($perPage);

        // Pre-fetch all previous trainers in bulk to avoid N+1 query issue
        $studentIds = [];
        foreach ($courses->items() as $course) {
            foreach ($course->students as $student) {
                $studentIds[] = $student->id;
            }
        }
        $studentIds = array_unique($studentIds);

        $studentCoursesMap = [];
        if (!empty($studentIds)) {
            $allCoursesForStudents = Course::whereHas('students', function ($q) use ($studentIds) {
                    $q->whereIn('students.id', $studentIds);
                })
                ->with(['students', 'trainer.user'])
                ->orderBy('id', 'desc')
                ->get();

            foreach ($allCoursesForStudents as $c) {
                foreach ($c->students as $student) {
                    $studentCoursesMap[$student->id][] = [
                        'course_id' => $c->id,
                        'trainer_name' => $c->trainer && $c->trainer->user ? $c->trainer->user->name : ($c->trainer ? $c->trainer->name : '-')
                    ];
                }
            }
        }

        // Add completion percentage and previous trainer to each course
        $courses->getCollection()->transform(function ($course) use ($studentCoursesMap) {
            // Ensure coursePackage is loaded
            if (!$course->relationLoaded('coursePackage')) {
                $course->load('coursePackage');
            }
            
            $completedCount = (int) $course->completed_lectures_count;
            $totalRequired = $course->lectures_count ?: (int) $course->total_lectures_count;
            $completionPercentage = $totalRequired > 0 ? round(($completedCount / $totalRequired) * 100) : 0;
            
            // Add attributes to the course model
            $course->completed_lectures_count = $completedCount;
            $course->completion_percentage = $completionPercentage;
            
            // Make coursePackage visible and ensure it's serialized as course_package
            $course->makeVisible('coursePackage');
            
            // Add previous trainer name if available
            $previousTrainerName = '-';
            try {
                $firstStudent = $course->students->first();
                $pStudentId = $firstStudent ? $firstStudent->id : null;
                
                if ($pStudentId && isset($studentCoursesMap[$pStudentId])) {
                    foreach ($studentCoursesMap[$pStudentId] as $prev) {
                        if ($prev['course_id'] < $course->id) {
                            $previousTrainerName = $prev['trainer_name'];
                            break;
                        }
                    }
                }
            } catch (\Throwable $e) {
                $previousTrainerName = 'Error: ' . $e->getMessage();
            }
            $course->previous_trainer_name = $previousTrainerName;
            
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
            'student_max_postponements_override' => 'sometimes|nullable|integer|min:0',
            'trainer_max_postponements_override' => 'sometimes|nullable|integer|min:0',
            'renewed_with_trainer' => 'sometimes|boolean',
            'paid_amount' => 'sometimes|numeric|min:0',
            'remaining_amount' => 'sometimes|numeric|min:0',
            'payment_method' => 'nullable|in:zain_cash,qi_card,delivery',
            'is_custom' => 'sometimes|boolean',
            'custom_total_amount' => $isCustom ? 'required|numeric|min:0' : 'nullable|numeric|min:0',
            'discount' => 'sometimes|numeric|min:0',
            'student_levels' => 'sometimes|array',
            'student_levels.*' => 'nullable|string|max:50',
            'is_kids' => 'sometimes|boolean',
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

        $isKids = $request->input('is_kids');
        if ($isKids === null) {
            // Check if there is a previous course and it was kids course
            $previousCourse = null;
            $previousCourseId = $request->input('previous_course_id');
            if ($previousCourseId) {
                $previousCourse = Course::find($previousCourseId);
            } elseif (!empty($studentIds)) {
                $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                    $query->whereIn('students.id', $studentIds);
                })
                ->where('start_date', '<', $request->start_date)
                ->orderBy('start_date', 'desc')
                ->first();
            }

            if ($previousCourse && $previousCourse->is_kids) {
                $isKids = true;
            } else {
                $isKids = Student::whereIn('id', $studentIds)->where('is_child', true)->exists();
            }
        } else {
            $isKids = filter_var($isKids, FILTER_VALIDATE_BOOLEAN);
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

        $renewalIteration = 1;
        if (!empty($studentIds)) {
            $lastCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                $query->whereIn('students.id', $studentIds);
            })
            ->where('start_date', '<', $request->start_date)
            ->orderBy('start_date', 'desc')
            ->first();
            
            if ($lastCourse) {
                $renewalIteration = $lastCourse->renewal_iteration + 1;
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
            'renewal_iteration' => $renewalIteration,
            'payment_method' => $request->payment_method,
            'status' => 'active',
            'is_kids' => $isKids,
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

        // For package courses, set total_amount from package price
        if (!$isCustom && !empty($request->course_package_id)) {
            $package = CoursePackage::find($request->course_package_id);
            if ($package && $package->price !== null) {
                $price = $package->price;
                if (is_string($price)) {
                    $price = str_replace(',', '', $price);
                }
                $price = (float) $price;
                if ($price > 0 && $price < 5000) {
                    $price *= 1000;
                }
                $courseData['total_amount'] = $price;
            } else {
                $courseData['total_amount'] = 0;
            }
        }
        
        // Apply discount logic
        $totalDiscount = 0;
        if ($isDual) {
            $studentPayments = $request->input('student_payments', []);
            foreach ($studentPayments as $payment) {
                $totalDiscount += floatval($payment['discount'] ?? 0);
            }
        } else {
            $totalDiscount = floatval($request->input('discount', 0));
        }
        
        $courseData['discount'] = $totalDiscount;
        if (!isset($courseData['total_amount'])) {
            $courseData['total_amount'] = 0;
        }
        if ($courseData['total_amount'] > 0) {
            $courseData['total_amount'] = max(0, $courseData['total_amount'] - $totalDiscount);
        }
        
        $course = DB::transaction(function () use ($courseData, $studentIds, $isDual, $request) {
            // Determine levels to save per student (before any updates)
            $levelsToSave = [];
            foreach ($studentIds as $studentId) {
                if ($request->has('student_levels') && isset($request->student_levels[$studentId])) {
                    $levelsToSave[$studentId] = $request->student_levels[$studentId];
                } else {
                    $student = Student::find($studentId);
                    $levelsToSave[$studentId] = $student ? $student->level : null;
                }
            }

            // Save primary student's level to course directly for fallback
            $courseData['student_level'] = $levelsToSave[$studentIds[0]] ?? null;

            $course = Course::create($courseData);

            // Update student levels if provided
            if ($request->has('student_levels') && is_array($request->student_levels)) {
                foreach ($request->student_levels as $studentId => $newLevel) {
                    if (in_array($studentId, $studentIds)) {
                        Student::where('id', $studentId)->update(['level' => $newLevel]);
                    }
                }
            }

            // If the course is kids, update all students is_child attribute to true
            if ($courseData['is_kids'] ?? false) {
                Student::whereIn('id', $studentIds)->update(['is_child' => true]);
            }

            // Attach students to course (for dual courses)
            foreach ($studentIds as $index => $studentId) {
                $course->students()->attach($studentId, [
                    'is_primary' => $index === 0,
                    'student_level' => $levelsToSave[$studentId] ?? null,
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
                                    'payment_method' => $studentPayment['payment_method'] ?? $request->payment_method,
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
                                'payment_method' => $request->payment_method,
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
                            'payment_method' => $request->payment_method,
                            'status' => 'completed',
                            'payment_date' => $request->start_date ?? now()->toDateString(),
                            'receipt_number' => null,
                            'notes' => 'دفعة أولية عند إنشاء الكورس',
                            'recorded_by' => auth()->id(),
                        ]);
                    }
                }
            }

            return $course;
        });

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures.students']);
        
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

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures.students', 'lectures.lectureTrainer.user', 'payments']);
        
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
        $user = $request->user();
        if ($user && method_exists($user, 'isTrainer') && $user->isTrainer()) {
            $trainerId = $user->trainer->id ?? null;
            if (!$trainerId || $course->trainer_id !== $trainerId) {
                return response()->json(['message' => 'غير مصرح لك بتعديل هذا الكورس'], 403);
            }

            // A trainer can only update start_date, lecture_time, and lecture_days
            $allowedFields = ['start_date', 'lecture_time', 'lecture_days'];
            foreach ($request->all() as $key => $val) {
                if (!in_array($key, $allowedFields) && $request->has($key) && $key !== '_method') {
                    return response()->json(['message' => 'غير مسموح للمدرب بتعديل حقل: ' . $key], 403);
                }
            }
        }

        $request->validate([
            'status' => 'sometimes|required|in:active,paused,finished,paid,cancelled',
            'lecture_time' => 'sometimes|date_format:H:i',
            'lecture_days' => 'sometimes|array|min:1',
            'lecture_days.*' => 'in:sun,mon,tue,wed,thu,fri,sat',
            'trainer_payment_status' => 'sometimes|required|in:unpaid,paid',
            'renewal_status' => 'sometimes|in:alert,messaged,subscribed',
            'student_max_postponements_override' => 'sometimes|nullable|integer|min:0',
            'trainer_max_postponements_override' => 'sometimes|nullable|integer|min:0',
            'notes' => 'sometimes|nullable|string',
            'extra_lectures_count' => 'sometimes|nullable|integer|min:0',
            'extra_lectures_fee' => 'sometimes|nullable|numeric|min:0',
            'trainer_id' => 'sometimes|required|exists:trainers,id',
            'is_kids' => 'sometimes|boolean',
            'resumption_date' => 'sometimes|nullable|date',
            'start_date' => 'sometimes|required|date',
        ]);

        $oldStatus = $course->status;
        $oldStartDate = $course->start_date ? $course->start_date->toDateString() : null;
        $oldLectureTime = $course->lecture_time ? substr($course->lecture_time, 0, 5) : null;
        $oldLectureDays = $course->lecture_days;

        if ($request->has('trainer_id')) {
            $newTrainerId = (int) $request->trainer_id;
            $oldTrainerId = (int) $course->trainer_id;
            if ($newTrainerId !== $oldTrainerId) {
                // Freeze old trainer on completed lectures
                $course->lectures()
                    ->whereIn('attendance', ['present', 'partially', 'absent'])
                    ->whereNull('trainer_id')
                    ->update(['trainer_id' => $oldTrainerId]);
            }
        }

        $course->update($request->only([
            'status', 'lecture_time', 'lecture_days', 'trainer_payment_status', 'renewal_status',
            'student_max_postponements_override', 'trainer_max_postponements_override', 'notes',
            'extra_lectures_count', 'extra_lectures_fee', 'trainer_id', 'is_kids', 'start_date'
        ]));

        $newStatus = $course->status;
        
        if ($newStatus === 'active' && $oldStatus === 'paused') {
            $resumptionDate = $request->input('resumption_date', now()->toDateString());
            $this->reschedulePendingLectures($course, $resumptionDate);
        } else {
            // Trigger rescheduling if the start date, days, or time was manually modified
            $startDateChanged = $request->has('start_date') && $request->start_date !== $oldStartDate;
            $daysChanged = $request->has('lecture_days') && $request->lecture_days !== $oldLectureDays;
            
            $reqTime = $request->has('lecture_time') ? substr($request->lecture_time, 0, 5) : null;
            $timeChanged = $request->has('lecture_time') && $reqTime !== $oldLectureTime;

            if ($startDateChanged || $daysChanged || $timeChanged) {
                if ($startDateChanged) {
                    $this->reschedulePendingLectures($course, $request->start_date);
                } else {
                    // Reschedule remaining lectures starting from the date of the first pending lecture
                    $firstPending = $course->lectures()
                        ->whereNotIn('attendance', ['present', 'absent', 'partially', 'postponed_by_student', 'postponed_by_trainer', 'postponed_holiday'])
                        ->orderBy('lecture_number')
                        ->first();
                        
                    $rescheduleStartDate = $firstPending ? $firstPending->date->toDateString() : now()->toDateString();
                    if (\Carbon\Carbon::parse($rescheduleStartDate)->isPast()) {
                        $rescheduleStartDate = now()->toDateString();
                    }
                    $this->reschedulePendingLectures($course, $rescheduleStartDate);
                }
            }
        }

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures.students', 'lectures.lectureTrainer.user']);
        
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
     * تفعيل بدء الكورس الفعلي (للمدرب أو خدمة العملاء).
     * يحدّث actual_start_date دون المساس بتاريخ أول دفعة (start_date).
     */
    public function startCourse(Request $request, Course $course)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'غير مصرح'], 401);
        }

        // المدرب فقط لكرساته، أو خدمة العملاء/الإدارة
        $isTrainerOwner = $user->role === 'trainer' && $user->trainer && (int) $course->trainer_id === (int) $user->trainer->id;
        $isStaff = in_array($user->role, ['customer_service', 'admin'], true);
        if (!$isTrainerOwner && !$isStaff) {
            return response()->json(['message' => 'غير مصرح لتفعيل بدء هذا الكورس'], 403);
        }

        $request->validate([
            'actual_start_date' => 'nullable|date',
        ]);

        $date = $request->filled('actual_start_date')
            ? $request->actual_start_date
            : now()->toDateString();

        $course->actual_start_date = $date;
        $course->save();

        // ------------------------------------------------------------------
        // Shift all pending lectures to align with the actual start date
        // ------------------------------------------------------------------
        if (is_array($course->lecture_days) && count($course->lecture_days) > 0) {
            $dayMap = [
                'sun' => \Carbon\Carbon::SUNDAY,
                'mon' => \Carbon\Carbon::MONDAY,
                'tue' => \Carbon\Carbon::TUESDAY,
                'wed' => \Carbon\Carbon::WEDNESDAY,
                'thu' => \Carbon\Carbon::THURSDAY,
                'fri' => \Carbon\Carbon::FRIDAY,
                'sat' => \Carbon\Carbon::SATURDAY,
            ];
            $lectureDays = array_map(fn($day) => $dayMap[$day] ?? -1, $course->lecture_days);
            $currentDate = \Carbon\Carbon::parse($date);
            
            $pendingLectures = $course->lectures()
                ->whereNotIn('attendance', ['present', 'absent', 'partially', 'postponed_by_student', 'postponed_by_trainer', 'postponed_holiday'])
                ->orderBy('lecture_number')
                ->get();
                
            foreach ($pendingLectures as $lecture) {
                // Find next matching day
                while (!in_array($currentDate->dayOfWeek, $lectureDays)) {
                    $currentDate->addDay();
                }
                
                $lecture->date = $currentDate->format('Y-m-d');
                $lecture->save();
                
                // Move to next day for the next iteration
                $currentDate->addDay();
            }
        }
        
        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures']);
        $course->makeVisible('coursePackage');
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
            'resumption_date' => 'nullable|date',
        ]);

        $oldStatus = $course->status;
        $newStatus = $request->status;

        // Update course status
        $course->update(['status' => $newStatus]);

        if ($newStatus === 'active' && $oldStatus === 'paused') {
            $resumptionDate = $request->input('resumption_date', now()->toDateString());
            $this->reschedulePendingLectures($course, $resumptionDate);
        }

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
     * Add extra lectures to a course (Customer Service & Admin).
     */
    public function addExtraLectures(Request $request, Course $course)
    {
        $user = $request->user();
        $isStaff = in_array($user->role ?? '', ['customer_service', 'admin'], true);
        if (!$isStaff) {
            return response()->json(['message' => 'غير مصرح للقيام بهذه العملية'], 403);
        }

        $request->validate([
            'count' => 'required|integer|min:1',
            'fee'   => 'required|numeric|min:0',
            'is_paid' => 'boolean',
            'payment_method' => 'nullable|string',
        ]);

        $count = (int) $request->input('count');
        $fee = (float) $request->input('fee');

        $course->extra_lectures_count += $count;
        $course->extra_lectures_fee += $fee;
        
        $course->lectures_count += $count;
        $course->total_amount += $fee;
        
        // If the user specified they received the money now, create a Payment and increase amount_paid
        $isPaid = $request->boolean('is_paid');
        if ($isPaid && $fee > 0) {
            $paymentMethod = $request->input('payment_method', 'cash');
            
            // Assume the payment is from the primary student OR just the first student
            $studentId = $course->students()->first()->id ?? null;
            
            if ($studentId) {
                \App\Models\Payment::create([
                    'course_id' => $course->id,
                    'student_id' => $studentId,
                    'amount' => $fee,
                    'payment_method' => $paymentMethod,
                    'status' => 'completed',
                    'payment_date' => now()->toDateString(),
                    'receipt_number' => null,
                    'notes' => 'وارد من المحاضرات الإضافية',
                    'recorded_by' => $user->id ?? null,
                ]);
                
                // Also reflect this in the course amount_paid cache (optional, since the model has a mutator, but let's be safe)
                $course->amount_paid += $fee;
            }
        }
        
        $course->save();

        // Find the last active/scheduled lecture date to continue from.
        // Important: use reorder() because the Course->lectures() relationship has a default orderBy('lecture_number')
        $lastLecture = $course->lectures()->reorder('date', 'desc')->orderBy('time', 'desc')->first();
        
        $startDate = $lastLecture && $lastLecture->date 
            ? Carbon::parse($lastLecture->date)->addDay()->startOfDay() 
            : Carbon::parse($course->start_date)->startOfDay();

        $dayMap = [
            'sun' => Carbon::SUNDAY,
            'mon' => Carbon::MONDAY,
            'tue' => Carbon::TUESDAY,
            'wed' => Carbon::WEDNESDAY,
            'thu' => Carbon::THURSDAY,
            'fri' => Carbon::FRIDAY,
            'sat' => Carbon::SATURDAY,
        ];

        $lectureDays = is_array($course->lecture_days) && count($course->lecture_days) > 0
            ? array_map(fn($day) => $dayMap[$day] ?? -1, $course->lecture_days)
            : [];

        $currentDate = $startDate->copy();
        $lecturesCreated = 0;
        
        $lastNum = $lastLecture ? $lastLecture->lecture_number : 0;

        while ($lecturesCreated < $count) {
            if (empty($lectureDays) || in_array($currentDate->dayOfWeek, $lectureDays)) {
                Lecture::create([
                    'course_id' => $course->id,
                    'lecture_number' => $lastNum + $lecturesCreated + 1,
                    'date' => $currentDate->format('Y-m-d'),
                    'time' => $course->lecture_time,
                    'attendance' => 'pending',
                    'is_extra' => true,
                ]);
                $lecturesCreated++;
            }
            $currentDate->addDay();
        }

        try {
            ActivityLog::create([
                'user_id' => $user->id ?? null,
                'action' => 'add_extra_lectures',
                'model_type' => Course::class,
                'model_id' => $course->id,
                'old_values' => ['lectures_count' => $course->lectures_count - $count, 'total_amount' => $course->total_amount - $fee],
                'new_values' => ['lectures_count' => $course->lectures_count, 'total_amount' => $course->total_amount],
                'description' => "تم إضافة $count محاضرات إضافية بمبلغ $fee",
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to log extra lectures addition: ' . $e->getMessage());
        }

        $course->load(['trainer.user', 'students', 'coursePackage', 'lectures']);
        $course->makeVisible('coursePackage');

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة المحاضرات الإضافية بنجاح',
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
     * Reschedule pending lectures of a course starting from a specific date.
     */
    private function reschedulePendingLectures(Course $course, string $startDate)
    {
        if (is_array($course->lecture_days) && count($course->lecture_days) > 0) {
            $dayMap = [
                'sun' => \Carbon\Carbon::SUNDAY,
                'mon' => \Carbon\Carbon::MONDAY,
                'tue' => \Carbon\Carbon::TUESDAY,
                'wed' => \Carbon\Carbon::WEDNESDAY,
                'thu' => \Carbon\Carbon::THURSDAY,
                'fri' => \Carbon\Carbon::FRIDAY,
                'sat' => \Carbon\Carbon::SATURDAY,
            ];
            $lectureDays = array_map(fn($day) => $dayMap[$day] ?? -1, $course->lecture_days);
            $currentDate = \Carbon\Carbon::parse($startDate);
            
            $pendingLectures = $course->lectures()
                ->whereNotIn('attendance', ['present', 'absent', 'partially', 'postponed_by_student', 'postponed_by_trainer', 'postponed_holiday'])
                ->orderBy('lecture_number')
                ->get();
                
            foreach ($pendingLectures as $lecture) {
                // Find next matching day
                while (!in_array($currentDate->dayOfWeek, $lectureDays)) {
                    $currentDate->addDay();
                }
                
                $lecture->date = $currentDate->format('Y-m-d');
                $lecture->time = $lecture->time ?? $course->lecture_time;
                $lecture->save();
                
                // Move to next day for the next iteration
                $currentDate->addDay();
            }
        }
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
     * Get courses nearing completion (completed 75% or more).
     */
    public function nearingCompletion(Request $request)
    {
        // 1. Get courses with lecture counts through SQL, much faster and zero Memory leakage
        $coursesData = Course::with(['trainer.user', 'student', 'students', 'coursePackage'])

            ->where('status', 'active')
            ->withCount(['lectures as total_lectures' => function ($query) {
                $query->where(function($q) {
                    $q->whereNotIn('attendance', [
                        \App\Models\Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
                        \App\Models\Lecture::ATTENDANCE_POSTPONED_BY_STUDENT,
                        \App\Models\Lecture::ATTENDANCE_POSTPONED_HOLIDAY,
                    ])->orWhereNull('attendance');
                });
            }])
            ->withCount(['lectures as completed_lectures' => function ($query) {
                // Count how many lectures are considered finished
                $query->whereIn('attendance', [
                    \App\Models\Lecture::ATTENDANCE_PRESENT, 
                    \App\Models\Lecture::ATTENDANCE_PARTIALLY, 
                    \App\Models\Lecture::ATTENDANCE_ABSENT
                ]);
            }])
            ->get();

        // 2. Filter in memory ONLY the numeric counts (blazing fast)
        $nearingCourses = $coursesData->filter(function ($course) {
            $total = $course->total_lectures > 0 ? $course->total_lectures : ($course->coursePackage->lectures_count ?? 0);
            if ($total == 0) return false;
            
            $percentage = round(($course->completed_lectures / $total) * 100);
            return $percentage >= 75 && $course->renewal_alert_status !== 'renewed';
        })->map(function ($course) {
            $total = $course->total_lectures > 0 ? $course->total_lectures : ($course->coursePackage->lectures_count ?? 0);
            return [
                'id' => $course->id,
                'is_dual' => $course->is_dual,
                'is_custom' => $course->is_custom,
                'package' => $course->coursePackage,
                'course_package' => $course->coursePackage,
                'student' => $course->student,
                'students' => $course->students,
                'student_name' => $course->student ? $course->student->name : null,
                'student_id' => $course->student_id,
                'trainer' => $course->trainer,
                'trainer_name' => $course->trainer ? ($course->trainer->name ?: 'مدرب محذوف') : 'بدون مدرب',
                'completed_lectures' => $course->completed_lectures,
                'total_lectures' => $total,
                'remaining_lectures' => max(0, $total - $course->completed_lectures),
                'completion_percentage' => $total > 0 ? round(($course->completed_lectures / $total) * 100) : 0,
                'status' => $course->status,
                'renewal_status' => $course->renewal_status ?? 'alert',
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $nearingCourses
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
                // Check if lecture can be modified
                $canModify = $lecture->canBeModifiedArray();
                
                if (!$canModify['canModify']) {
                    continue;
                }

                // Prepare update data based on user role
                $updateData = [];

                // غائب ولديه محاولة تأجيل → تأجيل تلقائي (لا نحفظ غائب)
                if (isset($lectureData['attendance']) && $lectureData['attendance'] === 'absent') {
                    $lecture->load('course.coursePackage');
                    $postponementService = app(LecturePostponementService::class);
                    $limitCheck = $postponementService->checkPostponementLimit($lecture->course);
                    if ($limitCheck['allowed']) {
                        $next = $postponementService->getNextCourseDayAfter(
                            $lecture->course,
                            $lecture->date ? $lecture->date->format('Y-m-d') : now()->format('Y-m-d'),
                            $lecture->time ?? $lecture->course->lecture_time
                        );
                        $result = $postponementService->postpone(
                            $lecture,
                            $next['date'],
                            $next['time'],
                            'student',
                            'غائب - تأجيل تلقائي',
                            $user,
                            false
                        );
                        if ($result['success']) {
                            $updatedCount++;
                            continue;
                        }
                    }
                }
                
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
                
                // Handle student_attendance for dual courses using pivot table
                if (isset($lectureData['student_attendance']) && is_array($lectureData['student_attendance'])) {
                    $syncData = [];
                    foreach ($lectureData['student_attendance'] as $studentId => $studentData) {
                        if (is_array($studentData)) {
                            $pivotData = [];
                            if (isset($studentData['attendance'])) $pivotData['attendance'] = $studentData['attendance'];
                            if (isset($studentData['activity'])) $pivotData['activity'] = $studentData['activity'];
                            if (isset($studentData['homework'])) $pivotData['homework'] = $studentData['homework'];
                            if (isset($studentData['notes'])) $pivotData['notes'] = $studentData['notes'];

                            if (!empty($pivotData)) {
                                $syncData[$studentId] = $pivotData;
                            }
                        }
                    }
                    if (!empty($syncData)) {
                        $lecture->students()->syncWithoutDetaching($syncData);
                    }
                }

                // Finance and customer_service can update trainer_payment_status
                if (($user->isFinance() || $user->isAccounting() || $user->isCustomerService()) && isset($lectureData['trainer_payment_status'])) {
                    $updateData['trainer_payment_status'] = $lectureData['trainer_payment_status'];
                }
                
                // Trainers and customer_service can update date and time
                if (($user->isTrainer() || $user->isCustomerService()) && isset($lectureData['date'])) {
                    $newDate = $lectureData['date'];
                    
                    // Check for conflict
                    $conflict = \App\Models\Lecture::where('course_id', $course->id)
                        ->where('id', '!=', $lecture->id)
                        ->whereDate('date', $newDate)
                        ->whereNotIn('attendance', [
                            \App\Models\Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
                            \App\Models\Lecture::ATTENDANCE_POSTPONED_BY_STUDENT,
                            \App\Models\Lecture::ATTENDANCE_POSTPONED_HOLIDAY
                        ])
                        ->exists();

                    if ($conflict) {
                        return response()->json([
                            'success' => false,
                            'message' => 'تعذر تحديث المحاضرة رقم ' . $lecture->lecture_number . ' لأنه يوجد محاضرة أخرى لنفس الكورس مجدولة في هذا التاريخ (' . $newDate . ').'
                        ], 422);
                    }
                    
                    $updateData['date'] = $newDate;
                }
                if (($user->isTrainer() || $user->isCustomerService()) && isset($lectureData['time'])) {
                    $updateData['time'] = $lectureData['time'];
                }

                // All users can update attendance, activity, homework, notes
                if (isset($lectureData['attendance'])) {
                    $attendance = $lectureData['attendance'];
                    $updateData['attendance'] = $attendance;
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
                                        $completedLecturesList = \App\Models\Lecture::with('course.coursePackage')->whereHas('course', function ($query) use ($course) {
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
                                            });
                                            
                                        $completedLectures = $completedLecturesList->count();
                                        
                                        // Find or create payroll record
                                        $lectureRate = 4000;
                                        $basePay = 0;
                                        foreach ($completedLecturesList as $lecture) {
                                            $rate = 4000;
                                            $pkgName = $lecture->course->coursePackage->name ?? '';
                                            if ($lecture->course->is_kids || mb_strpos($pkgName, 'اطفال') !== false || mb_strpos(mb_strtolower($pkgName, 'UTF-8'), 'kids') !== false) {
                                                $rate = 6000;
                                            }
                                            $basePay += $rate;
                                        }
                                        
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




