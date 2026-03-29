<?php

namespace App\Http\Controllers;

use App\Models\Student;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    /**
     * Display a listing of students.
     */
    public function index(Request $request)
    {
        $query = Student::query();

        // Search by name or phone
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $students = $query->withCount('courses')->latest()->paginate(15);

        return response()->json($students);
    }

    /**
     * Store a newly created student.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'level' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        $student = Student::create($request->only(['name', 'phone', 'level', 'notes']));

        return response()->json($student, 201);
    }

    /**
     * Display the specified student.
     */
    public function show(Student $student)
    {
        $student->load(['courses.trainer.user', 'courses.lectures', 'payments']);
        
        return response()->json($student);
    }

    /**
     * Update the specified student.
     */
    public function update(Request $request, Student $student)
    {
        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'sometimes|required|string|max:20',
            'level' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        $student->update($request->only(['name', 'phone', 'level', 'notes']));

        return response()->json($student);
    }

    /**
     * Remove the specified student.
     */
    public function destroy(Student $student)
    {
        $student->delete();

        return response()->json(null, 204);
    }

    /**
     * Get student profile history and analytics.
     */
    public function profile(Student $student)
    {
        // Load relationships
        $student->load(['courses' => function ($query) {
            $query->orderBy('created_at', 'desc');
        }, 'courses.trainer.user', 'courses.coursePackage', 'courses.lectures', 'payments']);

        $courses = $student->courses;
        $payments = $student->payments;

        // Analytics variables
        $totalLectures = 0;
        $attendedLectures = 0;
        $missedLectures = 0;
        
        $homeworkAssigned = 0;
        $homeworkCompleted = 0;
        
        $activityScore = 0;
        $activityMax = 0;

        $coursesHistory = [];
        $totalDebt = 0;

        foreach ($courses as $course) {
            $isDual = $course->is_dual;
            $courseLectures = $course->lectures;
            
            // Financials for this course
            $coursePrice = 0;
            if ($course->coursePackage) {
                $coursePrice = (float)$course->coursePackage->price;
            }
            $coursePrice += (float)$course->extra_lectures_fee;
            if ($isDual) {
                // If dual, standard price per student is derived from package
                $pkgName = $course->coursePackage ? $course->coursePackage->name : '';
                if (str_contains($pkgName, 'بمزاجي') || $pkgName === 'بمزاجي') {
                    $coursePrice = 90000;
                } elseif (str_contains($pkgName, 'توازن') || str_contains($pkgName, 'التوازن')) {
                    $coursePrice = 135000;
                } elseif (str_contains($pkgName, 'سرعة') || str_contains($pkgName, 'السرعة')) {
                    $coursePrice = 225000;
                } else {
                    $coursePrice = $coursePrice ? ($coursePrice / 2) : 0;
                }
            }

            // Student specific payments for this course
            $coursePayments = $payments->where('course_id', $course->id);
            $studentPaidCourse = $coursePayments->whereIn('status', ['paid', 'completed', 'partial'])->sum('amount');
            $studentRemainingCourse = max(0, $coursePrice - $studentPaidCourse);
            
            $totalDebt += $studentRemainingCourse;

            $courseData = [
                'id' => $course->id,
                'title' => collect([
                    $course->coursePackage ? $course->coursePackage->name : 'كورس مخصص',
                    $isDual ? '(ثنائي)' : '(فردي)'
                ])->filter()->join(' '),
                'trainer' => $course->trainer ? ($course->trainer->name ?? $course->trainer->user->name ?? 'غير معروف') : 'غير معروف',
                'start_date' => $course->start_date ? $course->start_date->format('Y-m-d') : null,
                'status' => $course->status,
                'lectures_count' => $course->lectures_count,
                'completed_lectures' => 0,
                'payments' => $coursePayments->filter(function($p) { return in_array($p->status, ['paid', 'completed', 'partial']); })->map(function ($payment) {
                    return [
                        'amount' => (float)$payment->amount,
                        'date' => $payment->payment_date ? \Carbon\Carbon::parse($payment->payment_date)->format('Y-m-d') : ($payment->created_at ? $payment->created_at->format('Y-m-d') : date('Y-m-d')),
                        'status' => $payment->status,
                        'payment_method' => $payment->payment_method,
                    ];
                })->values()->toArray(),
                'paid_amount' => $studentPaidCourse,
                'remaining_amount' => $studentRemainingCourse,
                'payment_method' => $course->payment_method,
            ];

            // Attendance limits
            $courseTotalLectures = 0;
            $courseAttended = 0;

            foreach ($courseLectures as $lecture) {
                if (!$lecture->is_completed) continue;

                $courseData['completed_lectures']++;
                $courseTotalLectures++;
                $totalLectures++;

                // Extract student specific data
                $attendance = null;
                $homework = null;
                $activity = null;

                if ($isDual) {
                    $studentAttendanceData = is_string($lecture->student_attendance) ? json_decode($lecture->student_attendance, true) : $lecture->student_attendance;
                    if (is_array($studentAttendanceData) && isset($studentAttendanceData[$student->id])) {
                        $attendance = $studentAttendanceData[$student->id]['attendance'] ?? 'pending';
                        $homework = $studentAttendanceData[$student->id]['homework'] ?? 'none';
                        $activity = $studentAttendanceData[$student->id]['activity'] ?? 'normal';
                    }
                } else {
                    $attendance = $lecture->attendance;
                    $homework = $lecture->homework;
                    $activity = $lecture->activity;
                }

                // Process Attendance
                if (in_array($attendance, ['present', 'partially'])) {
                    $attendedLectures++;
                    $courseAttended++;
                } elseif (in_array($attendance, ['absent'])) {
                    $missedLectures++;
                }

                // Process Homework
                if (in_array($homework, ['yes', 'partial', 'no'])) {
                    $homeworkAssigned++;
                    if (in_array($homework, ['yes', 'partial'])) {
                        $homeworkCompleted++;
                    }
                }

                // Process Activity
                if (in_array($activity, ['engaged', 'normal', 'not_engaged'])) {
                    $activityMax += 2;
                    if ($activity === 'engaged') $activityScore += 2;
                    elseif ($activity === 'normal') $activityScore += 1;
                }
            }

            $courseData['attendance_rate'] = $courseTotalLectures > 0 ? round(($courseAttended / $courseTotalLectures) * 100) : 0;
            $coursesHistory[] = $courseData;
        }

        // Aggregate Financials
        $totalPaid = $payments->where('status', 'completed')->sum('amount');

        // Aggregate percentages
        $attendanceRate = $totalLectures > 0 ? round(($attendedLectures / $totalLectures) * 100) : 0;
        $homeworkRate = $homeworkAssigned > 0 ? round(($homeworkCompleted / $homeworkAssigned) * 100) : 0;
        $engagementRate = $activityMax > 0 ? round(($activityScore / $activityMax) * 100) : 0;

        // Overall commitment score (weighted average: 50% attendance, 30% homework, 20% engagement)
        $commitmentScore = round(($attendanceRate * 0.5) + ($homeworkRate * 0.3) + ($engagementRate * 0.2));

        return response()->json([
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'phone' => $student->phone,
                'level' => $student->level,
                'status' => $student->status,
                'notes' => $student->notes,
                'created_at' => $student->created_at->format('Y-m-d'),
            ],
            'stats' => [
                'total_courses' => $courses->count(),
                'total_lectures' => $totalLectures,
                'attendance_rate' => $attendanceRate,
                'attended_lectures' => $attendedLectures,
                'missed_lectures' => $missedLectures,
                'homework_rate' => $homeworkRate,
                'engagement_rate' => $engagementRate,
                'commitment_score' => $commitmentScore,
            ],
            'financials' => [
                'total_paid' => $totalPaid,
                'total_remaining' => $totalDebt,
            ],
            'courses_history' => $coursesHistory,
        ]);
    }
}
























