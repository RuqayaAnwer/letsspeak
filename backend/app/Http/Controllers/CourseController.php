<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Lecture;
use App\Models\CoursePackage;
use App\Models\CourseStatusHistory;
use App\Models\ActivityLog;
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

        // Filter by student
        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
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
            $courses = $query->withCount('lectures')
                            ->orderBy('id', 'asc')
                            ->get();
            
            return response()->json([
                'data' => $courses,
                'total' => $courses->count(),
                'current_page' => 1,
                'per_page' => $courses->count(),
                'last_page' => 1,
            ]);
        }

        $courses = $query->withCount('lectures')
                        ->orderBy('id', 'asc')
                        ->paginate(15);

        return response()->json($courses);
    }

    /**
     * Store a newly created course and generate lectures schedule.
     */
    public function store(Request $request)
    {
        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'student_id' => 'required_without:student_ids|exists:students,id',
            'student_ids' => 'required_without:student_id|array|min:1',
            'student_ids.*' => 'exists:students,id',
            'course_package_id' => 'required|exists:course_packages,id',
            'start_date' => 'required|date',
            'lecture_time' => 'required|date_format:H:i',
            'lecture_days' => 'required|array|min:1',
            'lecture_days.*' => 'in:sun,mon,tue,wed,thu,fri,sat',
            'is_dual' => 'sometimes|boolean',
        ]);

        // Get lectures count from package
        $package = CoursePackage::find($request->course_package_id);
        $lecturesCount = $request->lectures_count ?? $package->lectures_count;

        // Determine if dual course and get primary student
        $isDual = $request->is_dual ?? false;
        $studentIds = $request->student_ids ?? [$request->student_id];
        $primaryStudentId = $studentIds[0];

        $course = Course::create([
            'trainer_id' => $request->trainer_id,
            'student_id' => $primaryStudentId,
            'course_package_id' => $request->course_package_id,
            'lectures_count' => $lecturesCount,
            'start_date' => $request->start_date,
            'lecture_time' => $request->lecture_time,
            'lecture_days' => $request->lecture_days,
            'is_dual' => $isDual,
            'status' => 'active',
        ]);

        // Attach students to course (for dual courses)
        foreach ($studentIds as $index => $studentId) {
            $course->students()->attach($studentId, [
                'is_primary' => $index === 0,
            ]);
        }

        // Generate lecture schedule
        $this->generateLectureSchedule($course);

        $course->load(['trainer.user', 'student', 'students', 'coursePackage', 'lectures']);

        return response()->json($course, 201);
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

        $course->load(['trainer.user', 'student', 'coursePackage', 'lectures', 'payments']);
        
        return response()->json($course);
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

        $course->load(['trainer.user', 'student', 'coursePackage', 'lectures']);

        return response()->json($course);
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

        $course->load(['trainer.user', 'student', 'coursePackage', 'lectures']);

        return response()->json([
            'success' => true,
            'message' => 'تم تغيير حالة الكورس بنجاح',
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
                    'payment_status' => 'unpaid',
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

                // Trainers and customer_service can update date and time
                if (($user->isTrainer() || $user->isCustomerService()) && isset($lectureData['date'])) {
                    $updateData['date'] = $lectureData['date'];
                }
                if (($user->isTrainer() || $user->isCustomerService()) && isset($lectureData['time'])) {
                    $updateData['time'] = $lectureData['time'];
                }

                // Only customer_service and accounting can update payment_status
                if (($user->isCustomerService() || $user->isAccounting()) && isset($lectureData['payment_status'])) {
                    $updateData['payment_status'] = $lectureData['payment_status'];
                }

                if (!empty($updateData)) {
                    // Save old data for logging
                    $oldData = $lecture->only(['attendance', 'activity', 'homework', 'notes', 'payment_status', 'date', 'time']);
                    
                    $lecture->update($updateData);
                    
                    // Log the modification using reflection
                    $logMethod = $reflection->getMethod('logLectureModification');
                    $logMethod->setAccessible(true);
                    $logMethod->invoke($lectureController, $lecture, $oldData, $updateData, $user);
                    
                    $updatedCount++;
                }
            }
        }

        $course->load('lectures');

        return response()->json([
            'success' => true,
            'data' => $course,
            'updated_count' => $updatedCount
        ]);
    }
}




