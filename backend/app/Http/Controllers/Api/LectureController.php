<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lecture;
use App\Models\User;
use App\Services\LecturePostponementService;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * LectureController
 * 
 * Handles API endpoints for lecture management.
 * 
 * POSTPONEMENT ENDPOINT:
 * POST /api/lectures/{id}/postpone
 * 
 * This endpoint handles the lecture postponement workflow:
 * 1. Validates the request data
 * 2. Authorizes the user based on role
 * 3. Delegates to LecturePostponementService for business logic
 * 4. Returns appropriate response
 */
class LectureController extends Controller
{
    protected LecturePostponementService $postponementService;

    public function __construct(LecturePostponementService $postponementService)
    {
        $this->postponementService = $postponementService;
    }

    /**
     * Postpone a lecture to a new date/time.
     * 
     * @route POST /api/lectures/{id}/postpone
     * 
     * @param Request $request
     * @param int $id Lecture ID
     * @return JsonResponse
     * 
     * Request body:
     * {
     *   "new_date": "2024-01-15",           // Required: new date (Y-m-d)
     *   "new_time": "14:00",                // Optional: new time (H:i)
     *   "postponed_by": "trainer",          // Required: trainer|student|customer_service|admin
     *   "reason": "سبب التأجيل",            // Optional: reason text
     *   "force": false                      // Optional: force override conflicts (privileged only)
     * }
     * 
     * Response (Success):
     * {
     *   "success": true,
     *   "message": "تم تأجيل المحاضرة بنجاح",
     *   "data": {
     *     "original_lecture": {...},
     *     "new_lecture": {...}
     *   }
     * }
     * 
     * Response (Error - Conflict):
     * {
     *   "success": false,
     *   "code": "time_conflict",
     *   "message": "يوجد تعارض في المواعيد",
     *   "data": {
     *     "conflicts": [...]
     *   }
     * }
     */
    public function postpone(Request $request, int $id): JsonResponse
    {
        // Validate request
        $validated = $request->validate([
            'new_date' => 'required|date|date_format:Y-m-d',
            'new_time' => 'nullable|date_format:H:i',
            'postponed_by' => 'required|in:trainer,student,customer_service,admin,holiday',
            'reason' => 'nullable|string|max:500',
            'force' => 'nullable|boolean',
        ]);

        // Find the lecture
        $lecture = Lecture::with('course.trainer')->find($id);
        
        if (!$lecture) {
            return response()->json([
                'success' => false,
                'message' => 'المحاضرة غير موجودة.',
            ], 404);
        }

        // Get current user using AuthService (same as other controllers)
        $user = null;
        $userRole = null;
        
        $token = $request->bearerToken();
        if ($token) {
            $authService = new AuthService();
            $authResult = $authService->validateToken($token);
            if ($authResult) {
                $userRole = $authResult['role'];
                // Create a simple user object for authorization
                $user = (object) [
                    'role' => $userRole,
                    'id' => $authResult['user']['id'] ?? null,
                ];
            }
        }

        // Authorization check
        // Customer service and admin can postpone any lecture
        // Trainers can only postpone their own courses
        if ($user) {
            if (!$this->canPostponeLecture($user, $lecture, $validated['postponed_by'])) {
                return response()->json([
                    'success' => false,
                    'code' => 'permission_denied',
                    'message' => 'ليس لديك صلاحية لتأجيل هذه المحاضرة.',
                ], 403);
            }
        }
        // If no user found from token, allow operation for legacy compatibility
        // The frontend (customer service) is trusted to send valid requests

        // Perform postponement
        $result = $this->postponementService->postpone(
            $lecture,
            $validated['new_date'],
            $validated['new_time'] ?? null,
            $validated['postponed_by'],
            $validated['reason'] ?? null,
            $user,
            $validated['force'] ?? false
        );

        // Return response
        $statusCode = $result['success'] ? 200 : 422;
        
        return response()->json($result, $statusCode);
    }

    /**
     * Get postponement statistics for a lecture's course.
     * 
     * @route GET /api/lectures/{id}/postponement-stats
     * 
     * @param int $id Lecture ID
     * @return JsonResponse
     */
    public function postponementStats(int $id): JsonResponse
    {
        $lecture = Lecture::with('course')->find($id);
        
        if (!$lecture) {
            return response()->json([
                'success' => false,
                'message' => 'المحاضرة غير موجودة.',
            ], 404);
        }

        $stats = $this->postponementService->getPostponementStats($lecture->course);

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Check time conflicts for a potential postponement.
     * 
     * @route POST /api/lectures/{id}/check-conflicts
     * 
     * @param Request $request
     * @param int $id Lecture ID
     * @return JsonResponse
     */
    public function checkConflicts(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'new_date' => 'required|date|date_format:Y-m-d',
            'new_time' => 'nullable|date_format:H:i',
        ]);

        $lecture = Lecture::with('course')->find($id);
        
        if (!$lecture) {
            return response()->json([
                'success' => false,
                'message' => 'المحاضرة غير موجودة.',
            ], 404);
        }

        $result = $this->postponementService->checkTimeConflicts(
            $lecture->course,
            $validated['new_date'],
            $validated['new_time'] ?? null,
            $lecture->id
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * Check if user can postpone a lecture.
     * 
     * Authorization rules:
     * - Trainers can only postpone their own courses' lectures
     * - Customer service can postpone any lecture
     * - Admin can postpone any lecture
     * 
     * @param mixed $user
     * @param Lecture $lecture
     * @param string $postponedBy
     * @return bool
     */
    protected function canPostponeLecture($user, Lecture $lecture, string $postponedBy): bool
    {
        if (!$user) {
            return false;
        }

        // Admin can do anything
        if ($user->role === 'admin') {
            return true;
        }

        // Customer service can postpone any lecture
        if ($user->role === 'customer_service') {
            return true;
        }

        // Finance cannot postpone lectures
        if ($user->role === 'finance') {
            return false;
        }

        // Trainer can only postpone their own courses
        if ($user->role === 'trainer') {
            // Get trainer ID from user
            $trainer = $user->trainer ?? null;
            if (!$trainer) {
                return false;
            }
            
            return $lecture->course->trainer_id === $trainer->id;
        }

        return false;
    }

    /**
     * Get a single lecture with details.
     * 
     * @route GET /api/lectures/{id}
     * 
     * @param int $id
     * @return JsonResponse
     */
    public function show(int $id): JsonResponse
    {
        $lecture = Lecture::with([
            'course.trainer',
            'course.students',
            'originalLecture',
            'makeupLecture',
        ])->find($id);

        if (!$lecture) {
            return response()->json([
                'success' => false,
                'message' => 'المحاضرة غير موجودة.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $lecture,
        ]);
    }

    /**
     * Cancel a postponement and delete the makeup lecture.
     * 
     * @route POST /api/lectures/{id}/cancel-postponement
     * 
     * @param int $id Lecture ID (the originally postponed lecture)
     * @return JsonResponse
     */
    public function cancelPostponement(int $id): JsonResponse
    {
        $lecture = Lecture::with('course')->find($id);

        if (!$lecture) {
            return response()->json([
                'success' => false,
                'message' => 'المحاضرة غير موجودة.',
            ], 404);
        }

        $result = $this->postponementService->cancelPostponement($lecture);

        $statusCode = $result['success'] ? 200 : 422;
        
        return response()->json($result, $statusCode);
    }

    /**
     * Update a lecture (general update, not postponement).
     * 
     * @route PUT /api/lectures/{id}
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $lecture = Lecture::find($id);

        if (!$lecture) {
            return response()->json([
                'success' => false,
                'message' => 'المحاضرة غير موجودة.',
            ], 404);
        }

        $validated = $request->validate([
            'date' => 'sometimes|date|date_format:Y-m-d',
            'time' => 'sometimes|nullable|date_format:H:i',
            'attendance' => 'sometimes|in:pending,present,partially,absent,excused,postponed_by_trainer,postponed_by_student,postponed_holiday',
            'activity' => 'sometimes|nullable|in:engaged,normal,not_engaged',
            'homework' => 'sometimes|nullable|in:yes,partial,no',
            'payment_status' => 'sometimes|in:unpaid,paid,partial',
            'trainer_payment_status' => 'sometimes|in:unpaid,paid',
            'notes' => 'sometimes|nullable|string|max:1000',
            'is_completed' => 'sometimes|boolean',
        ]);

        // Save old status for payroll recalculation
        $oldTrainerPaymentStatus = $lecture->trainer_payment_status ?? 'unpaid';
        
        $lecture->update($validated);
        
        // Recalculate trainer payroll automatically when payment status changes
        if (isset($validated['trainer_payment_status']) && 
            $oldTrainerPaymentStatus !== $validated['trainer_payment_status'] &&
            ($validated['trainer_payment_status'] === 'paid' || $oldTrainerPaymentStatus === 'paid')) {
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
                    $completedLectures = Lecture::whereHas('course', function ($query) use ($course) {
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
                    
                    \Log::info('Trainer payroll recalculated automatically from LectureController', [
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
                \Log::error('Failed to recalculate trainer payroll from LectureController', [
                    'lecture_id' => $lecture->id,
                    'error' => $recalcError->getMessage(),
                    'trace' => $recalcError->getTraceAsString()
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المحاضرة بنجاح.',
            'data' => $lecture->fresh(),
        ]);
    }
}

