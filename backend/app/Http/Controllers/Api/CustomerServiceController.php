<?php
/**
 * Customer Service API Controller
 * Handles customer service endpoints with full edit access
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CourseService;
use App\Services\AuthService;
use App\JsonStorage\Repositories\TrainerRepository;
use App\JsonStorage\Repositories\CourseRepository;
use App\JsonStorage\Repositories\LectureRepository;
use App\Models\Student;
use App\Models\Trainer;
use App\Models\Course;
use App\Models\CoursePackage;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CustomerServiceController extends Controller
{
    protected ?CourseService $courseService = null;
    protected ?AuthService $authService = null;
    protected ?TrainerRepository $trainerRepo = null;
    protected ?CourseRepository $courseRepo = null;
    protected ?LectureRepository $lectureRepo = null;

    public function __construct()
    {
        // Initialize services only if they exist
        if (class_exists(CourseService::class)) {
            $this->courseService = new CourseService();
        }
        if (class_exists(AuthService::class)) {
            $this->authService = new AuthService();
        }
        if (class_exists(TrainerRepository::class)) {
            $this->trainerRepo = new TrainerRepository();
        }
        if (class_exists(CourseRepository::class)) {
            $this->courseRepo = new CourseRepository();
        }
        if (class_exists(LectureRepository::class)) {
            $this->lectureRepo = new LectureRepository();
        }
    }

    /**
     * Get dashboard statistics for customer service
     */
    public function dashboardStats(Request $request): JsonResponse
    {
        try {
            $stats = [
                'students' => Student::count(),
                'trainers' => Trainer::count(),
                'courses' => Course::where('status', 'active')->count(),
                'packages' => CoursePackage::count(),
            ];

            return response()->json($stats);
        } catch (\Exception $e) {
            \Log::error('Dashboard stats error: ' . $e->getMessage());
            return response()->json([
                'students' => 0,
                'trainers' => 0,
                'courses' => 0,
                'packages' => 0,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get customer service dashboard
     */
    public function dashboard(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $dashboard = $this->courseService->getCustomerServiceDashboard();

        return response()->json([
            'success' => true,
            'data' => $dashboard,
        ]);
    }

    /**
     * Get all trainers
     */
    public function trainers(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $trainers = $this->authService->getAllTrainers();

        return response()->json([
            'success' => true,
            'data' => $trainers,
        ]);
    }

    /**
     * Get trainer with their courses
     */
    public function trainerCourses(Request $request, int $trainerId): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $trainer = $this->trainerRepo->find($trainerId);
        
        if (!$trainer) {
            return response()->json(['success' => false, 'message' => 'المدرب غير موجود'], 404);
        }

        unset($trainer['password']);
        $dashboard = $this->courseService->getTrainerDashboard($trainerId);

        return response()->json([
            'success' => true,
            'data' => [
                'trainer' => $trainer,
                'courses' => $dashboard,
            ],
        ]);
    }

    /**
     * Create new trainer
     */
    public function createTrainer(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string',
            'min_level' => 'nullable|string|max:10',
            'max_level' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        // Check if username exists
        $existing = $this->trainerRepo->findByUsername($request->input('username'));
        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'اسم المستخدم موجود بالفعل',
            ], 422);
        }

        $trainer = $this->authService->createTrainer($request->all());
        unset($trainer['password']);

        return response()->json([
            'success' => true,
            'data' => $trainer,
        ], 201);
    }

    /**
     * Reset trainer password
     */
    public function resetTrainerPassword(Request $request, int $trainerId): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $result = $this->authService->resetTrainerPassword($trainerId, $request->input('password'));

        if (!$result) {
            return response()->json(['success' => false, 'message' => 'المدرب غير موجود'], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تغيير كلمة المرور بنجاح',
        ]);
    }

    /**
     * Get all courses by status
     */
    public function coursesByStatus(Request $request, string $status): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validStatuses = ['active', 'finished', 'paused'];
        
        if (!in_array(strtolower($status), $validStatuses)) {
            return response()->json(['success' => false, 'message' => 'حالة غير صالحة'], 400);
        }

        $dashboard = $this->courseService->getCustomerServiceDashboard();
        
        $key = strtolower($status) . '_courses';
        $courses = $dashboard[$key] ?? [];

        return response()->json([
            'success' => true,
            'data' => $courses,
        ]);
    }

    /**
     * Get course details (with full edit access)
     */
    public function courseDetails(Request $request, int $courseId): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $course = $this->courseService->getCourseWithDetails($courseId);

        if (!$course) {
            return response()->json(['success' => false, 'message' => 'الكورس غير موجود'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $course,
        ]);
    }

    /**
     * Update course
     */
    public function updateCourse(Request $request, int $courseId): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $course = $this->courseService->updateCourse($courseId, $request->all());

        if (!$course) {
            return response()->json(['success' => false, 'message' => 'الكورس غير موجود'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $course,
        ]);
    }

    /**
     * Update course status
     */
    public function updateCourseStatus(Request $request, int $courseId): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'status' => 'required|in:Active,Paused,Finished,Paid',
        ]);

        $course = $this->courseService->updateStatus($courseId, $request->input('status'));

        if (!$course) {
            return response()->json(['success' => false, 'message' => 'فشل تحديث الحالة'], 400);
        }

        return response()->json([
            'success' => true,
            'data' => $course,
        ]);
    }

    /**
     * Update lecture (full access)
     */
    public function updateLecture(Request $request, int $lectureId): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $updated = $this->lectureRepo->updateLecture($lectureId, $request->all());

        if (!$updated) {
            return response()->json(['success' => false, 'message' => 'المحاضرة غير موجودة'], 404);
        }

        // Update course completed_lectures count if attendance changed
        if ($request->has('attendance')) {
            $completedCount = $this->lectureRepo->getCompletedCount($updated['course_id']);
            $this->courseRepo->updateCourse($updated['course_id'], ['completed_lectures' => $completedCount]);
        }

        return response()->json([
            'success' => true,
            'data' => $updated,
        ]);
    }

    /**
     * Search courses
     */
    public function search(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $query = $request->input('q', '');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $results = $this->courseService->searchCourses($query, $dateFrom, $dateTo);

        return response()->json([
            'success' => true,
            'data' => $results,
        ]);
    }

    /**
     * Get quick reports
     */
    public function quickReports(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request, 'customer_service')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $dashboard = $this->courseService->getCustomerServiceDashboard();

        return response()->json([
            'success' => true,
            'data' => $dashboard['quick_reports'],
        ]);
    }

    /**
     * Helper: Check authorization
     */
    protected function isAuthorized(Request $request, string $requiredRole): bool
    {
        $token = $request->bearerToken();
        
        if (!$token) {
            return false;
        }

        $result = $this->authService->validateToken($token);
        
        if (!$result) {
            return false;
        }

        return $result['role'] === $requiredRole;
    }
}









