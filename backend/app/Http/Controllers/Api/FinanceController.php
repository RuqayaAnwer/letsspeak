<?php
/**
 * Finance API Controller
 * Handles finance/accounting endpoints
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FinanceService;
use App\Services\CourseService;
use App\Services\AuthService;
use App\JsonStorage\Repositories\PaymentRepository;
use App\JsonStorage\Repositories\CourseRepository;
use App\JsonStorage\Repositories\LectureRepository;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FinanceController extends Controller
{
    protected FinanceService $financeService;
    protected CourseService $courseService;
    protected AuthService $authService;
    protected PaymentRepository $paymentRepo;
    protected CourseRepository $courseRepo;
    protected LectureRepository $lectureRepo;

    public function __construct()
    {
        $this->financeService = new FinanceService();
        $this->courseService = new CourseService();
        $this->authService = new AuthService();
        $this->paymentRepo = new PaymentRepository();
        $this->courseRepo = new CourseRepository();
        $this->lectureRepo = new LectureRepository();
    }

    /**
     * Get finance dashboard for current month
     */
    public function dashboard(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $month = (int) $request->input('month', date('m'));
        $year = (int) $request->input('year', date('Y'));

        $summary = $this->financeService->getMonthlySummary($month, $year);
        $payrolls = $this->financeService->getMonthlyPayroll($month, $year);
        $competition = $this->financeService->calculateCompetitionBonus($month, $year);

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'payrolls' => $payrolls,
                'competition_winners' => $competition,
            ],
        ]);
    }

    /**
     * Get monthly payroll for all trainers
     */
    public function monthlyPayroll(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $month = (int) $request->input('month', date('m'));
        $year = (int) $request->input('year', date('Y'));

        $payrolls = $this->financeService->getMonthlyPayroll($month, $year);

        return response()->json([
            'success' => true,
            'data' => $payrolls,
        ]);
    }

    /**
     * Get trainer payroll details
     */
    public function trainerPayroll(Request $request, int $trainerId): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $month = (int) $request->input('month', date('m'));
        $year = (int) $request->input('year', date('Y'));

        $payroll = $this->financeService->calculateTrainerPayroll($trainerId, $month, $year);
        $courses = $this->courseRepo->getByTrainer($trainerId);

        // Add course details
        $coursesWithDetails = array_map(function ($course) {
            return $this->courseService->getCourseWithDetails($course['id']);
        }, $courses);

        return response()->json([
            'success' => true,
            'data' => [
                'payroll' => $payroll,
                'courses' => $coursesWithDetails,
            ],
        ]);
    }

    /**
     * Get course financial details
     */
    public function courseFinancials(Request $request, int $courseId): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $course = $this->courseService->getCourseWithDetails($courseId);
        
        if (!$course) {
            return response()->json(['success' => false, 'message' => 'الكورس غير موجود'], 404);
        }

        $payments = $this->paymentRepo->getByCourse($courseId);
        $totalPaid = $this->paymentRepo->getTotalPaidForCourse($courseId);

        return response()->json([
            'success' => true,
            'data' => [
                'course' => $course,
                'payments' => $payments,
                'total_paid' => $totalPaid,
            ],
        ]);
    }

    /**
     * Update payment status for a lecture
     */
    public function updateLecturePayment(Request $request, int $lectureId): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'payment_status' => 'required|in:paid,unpaid',
        ]);

        $updated = $this->lectureRepo->updateLecture($lectureId, [
            'payment_status' => $request->input('payment_status'),
        ]);

        if (!$updated) {
            return response()->json(['success' => false, 'message' => 'المحاضرة غير موجودة'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $updated,
        ]);
    }

    /**
     * Add payment record
     */
    public function addPayment(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'course_id' => 'required|integer',
            'amount' => 'required|numeric|min:0',
            'payment_method' => 'nullable|string',
            'date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $course = $this->courseRepo->find($request->input('course_id'));
        
        if (!$course) {
            return response()->json(['success' => false, 'message' => 'الكورس غير موجود'], 404);
        }

        $payment = $this->paymentRepo->create([
            'course_id' => $course['id'],
            'trainer_id' => $course['trainer_id'],
            'student_name' => $course['student_name'],
            'amount' => $request->input('amount'),
            'payment_method' => $request->input('payment_method', ''),
            'status' => 'paid',
            'date' => $request->input('date', date('Y-m-d')),
            'notes' => $request->input('notes'),
        ]);

        return response()->json([
            'success' => true,
            'data' => $payment,
        ], 201);
    }

    /**
     * Update payment record
     */
    public function updatePayment(Request $request, int $paymentId): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $updated = $this->paymentRepo->updatePayment($paymentId, $request->all());

        if (!$updated) {
            return response()->json(['success' => false, 'message' => 'الدفعة غير موجودة'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $updated,
        ]);
    }

    /**
     * Get available years for history
     */
    public function availableYears(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $years = $this->financeService->getAvailableYears();

        return response()->json([
            'success' => true,
            'data' => $years,
        ]);
    }

    /**
     * Get history for a specific month/year
     */
    public function history(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $month = (int) $request->input('month');
        $year = (int) $request->input('year');

        if (!$month || !$year) {
            return response()->json(['success' => false, 'message' => 'الشهر والسنة مطلوبان'], 400);
        }

        $summary = $this->financeService->getMonthlySummary($month, $year);
        $payrolls = $this->financeService->getMonthlyPayroll($month, $year);

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'payrolls' => $payrolls,
            ],
        ]);
    }

    /**
     * Helper: Check authorization
     */
    protected function isAuthorized(Request $request): bool
    {
        $token = $request->bearerToken();
        
        if (!$token) {
            return false;
        }

        $result = $this->authService->validateToken($token);
        
        if (!$result) {
            return false;
        }

        return $result['role'] === 'finance';
    }
}


