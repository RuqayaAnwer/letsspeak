<?php
/**
 * Trainer API Controller
 * Handles trainer-specific endpoints
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CourseService;
use App\Services\AuthService;
use App\JsonStorage\Repositories\TrainerRepository;
use App\JsonStorage\Repositories\LectureRepository;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TrainerController extends Controller
{
    protected CourseService $courseService;
    protected AuthService $authService;
    protected TrainerRepository $trainerRepo;
    protected LectureRepository $lectureRepo;

    public function __construct()
    {
        $this->courseService = new CourseService();
        $this->authService = new AuthService();
        $this->trainerRepo = new TrainerRepository();
        $this->lectureRepo = new LectureRepository();
    }

    /**
     * Get trainer dashboard
     */
    public function dashboard(Request $request): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $dashboard = $this->courseService->getTrainerDashboard($trainerId);

        return response()->json([
            'success' => true,
            'data' => $dashboard,
        ]);
    }

    /**
     * Get active courses for trainer
     */
    public function activeCourses(Request $request): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $dashboard = $this->courseService->getTrainerDashboard($trainerId);

        return response()->json([
            'success' => true,
            'data' => $dashboard['active_courses'],
        ]);
    }

    /**
     * Get finished courses for trainer
     */
    public function finishedCourses(Request $request): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $dashboard = $this->courseService->getTrainerDashboard($trainerId);

        return response()->json([
            'success' => true,
            'data' => $dashboard['finished_courses'],
        ]);
    }

    /**
     * Get paused courses for trainer
     */
    public function pausedCourses(Request $request): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $dashboard = $this->courseService->getTrainerDashboard($trainerId);

        return response()->json([
            'success' => true,
            'data' => $dashboard['paused_courses'],
        ]);
    }

    /**
     * Get course details with lectures
     */
    public function courseDetails(Request $request, int $courseId): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $course = $this->courseService->getCourseWithDetails($courseId);

        if (!$course) {
            return response()->json(['success' => false, 'message' => 'الكورس غير موجود'], 404);
        }

        // Verify trainer owns this course
        if ($course['trainer_id'] != $trainerId) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $course,
        ]);
    }

    /**
     * Update lecture (attendance, activity, homework, notes)
     */
    public function updateLecture(Request $request, int $lectureId): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'attendance' => 'sometimes|in:Present,Partially,Absent,Excused,Postponed_by_me,pending',
            'activity' => 'sometimes|nullable|in:Engaged,Normal,NotEngaged',
            'homework' => 'sometimes|nullable|in:Yes,50%,No',
            'notes' => 'sometimes|nullable|string',
        ]);

        // Handle attendance update with postponement logic
        if ($request->has('attendance')) {
            $result = $this->courseService->updateLectureAttendance(
                $lectureId,
                $request->input('attendance'),
                $request->input('notes')
            );

            if (!$result['success']) {
                return response()->json($result, 400);
            }

            // Also update activity and homework if provided
            if ($request->has('activity') || $request->has('homework')) {
                $this->lectureRepo->updateLecture($lectureId, $request->only(['activity', 'homework']));
            }

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        }

        // Regular update (activity, homework, notes only)
        $updated = $this->lectureRepo->updateLecture($lectureId, $request->only([
            'activity', 'homework', 'notes'
        ]));

        return response()->json([
            'success' => true,
            'data' => $updated,
        ]);
    }

    /**
     * Bulk update lectures
     */
    public function bulkUpdateLectures(Request $request, int $courseId): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'lectures' => 'required|array',
            'lectures.*.id' => 'required|integer',
        ]);

        $updates = $request->input('lectures');
        $updated = $this->lectureRepo->bulkUpdate($courseId, $updates);

        // Update course completed_lectures count
        $completedCount = $this->lectureRepo->getCompletedCount($courseId);
        $this->courseService->updateCourse($courseId, ['completed_lectures' => $completedCount]);

        return response()->json([
            'success' => true,
            'data' => $updated,
        ]);
    }

    /**
     * Get financial summary for trainer
     */
    public function financialSummary(Request $request): JsonResponse
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $dashboard = $this->courseService->getTrainerDashboard($trainerId);

        return response()->json([
            'success' => true,
            'data' => $dashboard['financial_summary'],
        ]);
    }

    /**
     * Helper: Get trainer ID from token
     */
    protected function getTrainerId(Request $request): ?int
    {
        $token = $request->bearerToken();
        
        if (!$token) {
            return null;
        }

        $result = $this->authService->validateToken($token);
        
        if (!$result || $result['role'] !== 'trainer') {
            return null;
        }

        return $result['user']['id'] ?? null;
    }
}





















