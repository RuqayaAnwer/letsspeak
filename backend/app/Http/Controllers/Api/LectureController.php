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
            'notes' => 'sometimes|nullable|string|max:1000',
            'is_completed' => 'sometimes|boolean',
        ]);

        $lecture->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المحاضرة بنجاح.',
            'data' => $lecture->fresh(),
        ]);
    }
}

