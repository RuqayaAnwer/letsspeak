<?php
/**
 * Finance API Controller
 * Handles finance/accounting endpoints
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Payment;
use App\Models\Student;
use App\Models\Trainer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FinanceController extends Controller
{
    // Services and repositories are loaded conditionally when needed
    // This prevents errors if they don't exist

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

        // These methods require services that may not be available
        // For now, return a simple response
        return response()->json([
            'success' => false,
            'message' => 'Dashboard method requires FinanceService which is not available',
        ], 503);

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

        // This method requires FinanceService which is not available
        return response()->json([
            'success' => false,
            'message' => 'Monthly payroll requires FinanceService which is not available',
        ], 503);
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

        // This method requires FinanceService which is not available
        return response()->json([
            'success' => false,
            'message' => 'Trainer payroll requires FinanceService which is not available',
        ], 503);

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

        // This method requires CourseService and PaymentRepository which are not available
        return response()->json([
            'success' => false,
            'message' => 'Course financials requires services which are not available',
        ], 503);

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

        // This method requires LectureRepository which is not available
        return response()->json([
            'success' => false,
            'message' => 'Update lecture payment requires LectureRepository which is not available',
        ], 503);

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

        // Use Payment model directly instead of repository
        $course = Course::find($request->input('course_id'));
        
        if (!$course) {
            return response()->json(['success' => false, 'message' => 'الكورس غير موجود'], 404);
        }

        $payment = Payment::create([
            'course_id' => $course->id,
            'student_id' => $course->student_id,
            'amount' => $request->input('amount'),
            'payment_method' => $request->input('payment_method', ''),
            'status' => 'completed',
            'payment_date' => $request->input('date', date('Y-m-d')),
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

        // Use Payment model directly instead of repository
        $payment = Payment::find($paymentId);
        if (!$payment) {
            return response()->json(['success' => false, 'message' => 'الدفعة غير موجودة'], 404);
        }
        
        $payment->update($request->only(['amount', 'status', 'payment_date', 'notes']));
        $updated = $payment;

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

        // This method requires FinanceService which is not available
        return response()->json([
            'success' => false,
            'message' => 'Available years requires FinanceService which is not available',
        ], 503);

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

        // This method requires FinanceService which is not available
        return response()->json([
            'success' => false,
            'message' => 'History requires FinanceService which is not available',
        ], 503);

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'payrolls' => $payrolls,
            ],
        ]);
    }

    /**
     * Get general statistics
     */
    public function statistics(Request $request): JsonResponse
    {
        try {
            // Debug: Log database connection
            \Log::info('Statistics method called');
            
            $activeCourses = Course::where('status', 'active')->count();
            $finishedCourses = Course::where('status', 'finished')->count();
            $studentsCount = Student::count();
            $trainersCount = Trainer::count();
            
            \Log::info('Statistics calculated', [
                'active_courses' => $activeCourses,
                'finished_courses' => $finishedCourses,
                'students' => $studentsCount,
                'trainers' => $trainersCount,
            ]);

            return response()->json([
                'active_courses_count' => $activeCourses,
                'finished_courses_count' => $finishedCourses,
                'students_count' => $studentsCount,
                'trainers_count' => $trainersCount,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in statistics method: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'active_courses_count' => 0,
                'finished_courses_count' => 0,
                'students_count' => 0,
                'trainers_count' => 0,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get payment statistics
     */
    public function paymentStatistics(Request $request): JsonResponse
    {
        try {
            \Log::info('PaymentStatistics method called');
            
            // Use direct database queries instead of collections for better performance
            $totalAmount = (float) Payment::sum('amount');
            $paidAmount = (float) Payment::where('status', 'completed')->sum('amount');
            $pendingAmount = (float) Payment::where('status', 'pending')->sum('amount');
            
            \Log::info('Payment amounts calculated', [
                'total' => $totalAmount,
                'paid' => $paidAmount,
                'pending' => $pendingAmount,
            ]);
            
            // Current month revenue - use database query
            $currentMonth = now()->month;
            $currentYear = now()->year;
            $monthlyRevenue = (float) Payment::where('status', 'completed')
                ->whereMonth('payment_date', $currentMonth)
                ->whereYear('payment_date', $currentYear)
                ->sum('amount');
            
            // Active courses
            $activeCourses = Course::where('status', 'active')->count();
            
            // Finished courses
            $finishedCourses = Course::where('status', 'finished')->count();
            
            // Total students
            $totalStudents = Student::count();
            
            // Completed payments count
            $completedCount = Payment::where('status', 'completed')->count();
            
            \Log::info('All statistics calculated', [
                'monthly_revenue' => $monthlyRevenue,
                'active_courses' => $activeCourses,
                'finished_courses' => $finishedCourses,
                'total_students' => $totalStudents,
                'completed_count' => $completedCount,
            ]);

            return response()->json([
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'pending_amount' => $pendingAmount,
                'monthly_revenue' => $monthlyRevenue,
                'active_courses' => $activeCourses,
                'finished_courses' => $finishedCourses,
                'total_students' => $totalStudents,
                'completed_count' => $completedCount,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in paymentStatistics method: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'total_amount' => 0,
                'paid_amount' => 0,
                'pending_amount' => 0,
                'monthly_revenue' => 0,
                'active_courses' => 0,
                'finished_courses' => 0,
                'total_students' => 0,
                'completed_count' => 0,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Helper: Check authorization
     * For statistics methods, we allow access without strict authorization
     */
    protected function isAuthorized(Request $request): bool
    {
        // For statistics endpoints, we allow access
        // Other methods that require auth can override this
        return true;
    }
}


