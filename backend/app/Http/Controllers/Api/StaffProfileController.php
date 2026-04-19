<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Trainer;
use App\Models\User;
use App\Models\TrainerPayroll;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class StaffProfileController extends Controller
{
    /**
     * Get a unified profile for a staff member (Trainer or Employee).
     *
     * @param Request $request
     * @param string $type ('trainer' or 'user')
     * @param int $id The ID of the Trainer or the User
     * @return JsonResponse
     */
    public function getProfile(Request $request, string $type, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        // Only allow appropriate roles to view this info
        $isAdminOrFinanceOrCustomerService = in_array($user->role, ['admin', 'finance', 'customer_service']);
        
        // Let trainers view their own profile ONLY
        $isSelf = false;
        if ($type === 'user' && $user->id == $id) {
            $isSelf = true;
        } else if ($type === 'trainer') {
            $myTrainer = Trainer::where('user_id', $user->id)->first();
            if ($myTrainer && $myTrainer->id == $id) {
                $isSelf = true;
            }
        }

        if (!$isAdminOrFinanceOrCustomerService && !$isSelf) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $profile = null;
        $courses = [];
        $payrolls = [];

        if ($type === 'trainer') {
            $trainer = Trainer::with(['user:id,job_title,role,created_at,base_salary', 'courses.student', 'courses.package'])->find($id);

            if (!$trainer) {
                return response()->json(['success' => false, 'message' => 'Trainer not found'], 404);
            }

            $userId = $trainer->user_id;

            // Normalize Profile structure
            $profile = [
                'id' => $trainer->id,
                'user_id' => $userId,
                'name' => $trainer->name,
                'email' => $trainer->email,
                'phone' => $trainer->phone,
                'role' => $trainer->user ? $trainer->user->role : 'trainer',
                'job_title' => $trainer->user ? $trainer->user->job_title : 'مدرب',
                'status' => $trainer->status,
                'min_level' => $trainer->min_level,
                'max_level' => $trainer->max_level,
                'notes' => $trainer->notes,
                'base_salary' => $trainer->user ? $trainer->user->base_salary : 0,
                'created_at' => $trainer->created_at,
                'type' => 'trainer'
            ];

            // Map Courses
            $courses = $trainer->courses->map(function ($course) {
                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'student' => $course->student,
                    'package' => $course->package,
                    'status' => $course->status,
                    'start_date' => $course->start_date,
                    'actual_start_date' => $course->actual_start_date,
                    'finished_at' => $course->finished_at,
                    'completed_lectures' => $course->lectures()->whereIn('attendance', ['present', 'partially', 'absent'])->count(),
                    'total_lectures' => $course->lectures_count,
                    'progress' => $course->progress
                ];
            });

            // Get Payrolls
            $payrollQuery = TrainerPayroll::where('trainer_id', $trainer->id);
            if ($userId) {
                // Fetch payrolls matching either trainer_id or user_id for safety
                $payrollQuery->orWhere('user_id', $userId);
            }
            $payrolls = $payrollQuery->orderBy('year', 'desc')->orderBy('month', 'desc')->get();

        } else if ($type === 'user') {
            $targetUser = User::with(['trainer.courses.student', 'trainer.courses.package'])->find($id);

            if (!$targetUser) {
                return response()->json(['success' => false, 'message' => 'User not found'], 404);
            }

            $trainerId = $targetUser->trainer ? $targetUser->trainer->id : null;

            // Normalize Profile structure
            $profile = [
                'id' => $targetUser->id,
                'trainer_id' => $trainerId,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'phone' => $targetUser->trainer ? $targetUser->trainer->phone : null,
                'role' => $targetUser->role,
                'job_title' => $targetUser->job_title,
                'status' => $targetUser->status,
                'base_salary' => $targetUser->base_salary,
                'created_at' => $targetUser->created_at,
                'type' => 'user'
            ];

            // If user happens to be a trainer, extract metrics
            if ($targetUser->trainer) {
                $profile['min_level'] = $targetUser->trainer->min_level;
                $profile['max_level'] = $targetUser->trainer->max_level;
                $profile['notes'] = $targetUser->trainer->notes;

                $courses = $targetUser->trainer->courses->map(function ($course) {
                    return [
                        'id' => $course->id,
                        'title' => $course->title,
                        'student' => $course->student,
                        'package' => $course->package,
                        'status' => $course->status,
                        'start_date' => $course->start_date,
                        'actual_start_date' => $course->actual_start_date,
                        'finished_at' => $course->finished_at,
                        'completed_lectures' => $course->lectures()->whereIn('attendance', ['present', 'partially', 'absent'])->count(),
                        'total_lectures' => $course->lectures_count,
                        'progress' => $course->progress
                    ];
                });
            }

            // Get Payrolls
            $payrollQuery = TrainerPayroll::where('user_id', $targetUser->id);
            if ($trainerId) {
                $payrollQuery->orWhere('trainer_id', $trainerId);
            }
            $payrolls = $payrollQuery->orderBy('year', 'desc')->orderBy('month', 'desc')->get();

        } else {
            return response()->json(['success' => false, 'message' => 'Invalid profile type requested'], 400);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'profile' => $profile,
                'courses' => $courses,
                'payrolls' => $payrolls,
                'summary' => [
                    'active_courses' => collect($courses)->where('status', 'active')->count(),
                    'finished_courses' => collect($courses)->where('status', 'finished')->count(),
                    'total_payroll_paid' => $payrolls->where('status', 'paid')->sum('total_pay'),
                ]
            ]
        ]);
    }
}
