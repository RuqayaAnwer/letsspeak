<?php

namespace App\Services;

use App\Models\Student;

class StudentAnalyticsService
{
    /**
     * Get student profile history and analytics.
     * 
     * @param Student $student
     * @return array
     */
    public function getStudentProfileData(Student $student): array
    {
        // Load relationships if not loaded
        $student->loadMissing(['lead', 'courses' => function ($query) {
            $query->orderBy('created_at', 'desc');
        }, 'courses.trainer.user', 'courses.coursePackage', 'courses.lectures.students', 'payments', 'studentNotes.user:id,name']);

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
            $coursePrice = $course->student_price;

            // Student specific payments for this course
            $coursePayments = $payments->where('course_id', $course->id);
            $studentPaidCourse = (float)$coursePayments->whereIn('status', ['paid', 'completed', 'partial'])->sum('amount');
            
            // Retroactive fix for payments saved with dots (e.g. 50.00 instead of 50000)
            if ($studentPaidCourse > 0 && $studentPaidCourse < 5000) {
                $studentPaidCourse *= 1000;
            }
            
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
                    // Get data from pivot table
                    $pivotData = $lecture->students->where('id', $student->id)->first();
                    if ($pivotData && $pivotData->pivot) {
                        $attendance = $pivotData->pivot->attendance ?? 'pending';
                        $homework = $pivotData->pivot->homework ?? 'none';
                        $activity = $pivotData->pivot->activity ?? 'normal';
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

        return [
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'phone' => $student->phone,
                'level' => $student->level,
                'status' => $student->status,
                'notes' => $student->notes,
                'is_child' => (bool)$student->is_child,
                'age' => $student->age,
                'lead' => $student->lead,
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
            'notes' => $student->studentNotes->map(function ($note) {
                return [
                    'id' => $note->id,
                    'text' => $note->note,
                    'type' => $note->type ?? 'general',
                    'created_at' => $note->created_at->format('Y-m-d H:i'),
                    'user' => $note->user ? $note->user->name : 'النظام',
                ];
            })->sortByDesc('created_at')->values()->toArray(),
            'all_payments' => $payments->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'amount' => (float)$payment->amount,
                    'payment_method' => $payment->payment_method,
                    'status' => $payment->status,
                    'date' => $payment->payment_date ? \Carbon\Carbon::parse($payment->payment_date)->format('Y-m-d') : ($payment->created_at ? $payment->created_at->format('Y-m-d') : date('Y-m-d')),
                    'course_id' => $payment->course_id,
                ];
            })->sortByDesc('date')->values()->toArray(),
        ];
    }
}
