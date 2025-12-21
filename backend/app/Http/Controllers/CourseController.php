<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Lecture;
use App\Models\CoursePackage;
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
                $q->where('title', 'like', "%{$search}%")
                  ->orWhereHas('student', function ($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('trainer.user', function ($tq) use ($search) {
                      $tq->where('name', 'like', "%{$search}%");
                  });
            });
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
            'student_id' => 'required|exists:students,id',
            'course_package_id' => 'nullable|exists:course_packages,id',
            'title' => 'required|string|max:255',
            'lectures_count' => 'required_without:course_package_id|integer|min:1',
            'start_date' => 'required|date',
            'lecture_time' => 'required|date_format:H:i',
            'lecture_days' => 'required|array|min:1',
            'lecture_days.*' => 'in:sun,mon,tue,wed,thu,fri,sat',
        ]);

        // Get lectures count from package if provided
        $lecturesCount = $request->lectures_count;
        if ($request->course_package_id) {
            $package = CoursePackage::find($request->course_package_id);
            $lecturesCount = $lecturesCount ?? $package->lectures_count;
        }

        $course = Course::create([
            'trainer_id' => $request->trainer_id,
            'student_id' => $request->student_id,
            'course_package_id' => $request->course_package_id,
            'title' => $request->title,
            'lectures_count' => $lecturesCount,
            'start_date' => $request->start_date,
            'lecture_time' => $request->lecture_time,
            'lecture_days' => $request->lecture_days,
            'status' => 'active',
        ]);

        // Generate lecture schedule
        $this->generateLectureSchedule($course);

        $course->load(['trainer.user', 'student', 'coursePackage', 'lectures']);

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
            'title' => 'sometimes|required|string|max:255',
            'status' => 'sometimes|required|in:active,paused,finished,paid,cancelled',
            'lecture_time' => 'sometimes|date_format:H:i',
            'lecture_days' => 'sometimes|array|min:1',
            'lecture_days.*' => 'in:sun,mon,tue,wed,thu,fri,sat',
            'trainer_payment_status' => 'sometimes|required|in:unpaid,paid',
            'renewal_status' => 'sometimes|in:alert,messaged,subscribed',
        ]);

        $course->update($request->only(['title', 'status', 'lecture_time', 'lecture_days', 'trainer_payment_status', 'renewal_status']));

        $course->load(['trainer.user', 'student', 'coursePackage', 'lectures']);

        return response()->json($course);
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
                    'title' => $course->title,
                    'student' => $course->student,
                    'trainer' => $course->trainer,
                    'package' => $course->coursePackage,
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
        $request->validate([
            'lectures' => 'required|array',
            'lectures.*.id' => 'required|exists:lectures,id',
        ]);

        foreach ($request->lectures as $lectureData) {
            $lecture = Lecture::find($lectureData['id']);
            if ($lecture && $lecture->course_id === $course->id) {
                $lecture->update($lectureData);
            }
        }

        $course->load('lectures');

        return response()->json([
            'success' => true,
            'data' => $course
        ]);
    }
}




