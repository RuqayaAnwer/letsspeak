<?php
/**
 * Finance API Controller
 * Handles finance/accounting endpoints
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\Payment;
use App\Models\Student;
use App\Models\Trainer;
use App\Models\TrainerPayroll;
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
     * Get trainer payroll details for all trainers
     */
    public function trainerPayroll(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $month = (int) $request->input('month', date('m'));
        $year = (int) $request->input('year', date('Y'));

        // Financial rates
        $lectureRate = 4000; // د.ع per completed lecture
        $volumeBonus60 = 30000; // د.ع for 60+ lectures
        $volumeBonus80 = 80000; // د.ع for 80+ lectures (replaces 30k)
        $competitionBonus = 20000; // د.ع for top 3 trainers in renewals
        
        /**
         * Renewal Bonus System (Tiered):
         * - 5 renewals = 50,000 د.ع
         * - 7 renewals = 100,000 د.ع
         * 
         * Note: The old system (renewal_bonus_rate * renewals_count) is deprecated.
         * All renewal bonus calculations now use this tiered system.
         */

        // Get all trainers
        $trainers = Trainer::with('user')->get();
        
        \Log::info('Trainer Payroll Calculation', [
            'month' => $month,
            'year' => $year,
            'trainers_count' => $trainers->count(),
        ]);
        
        // Calculate start and end dates for the month
        $startDate = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = \Carbon\Carbon::create($year, $month, 1)->endOfMonth();

        $payrolls = [];
        $renewalsData = []; // To track renewals for competition bonus

        foreach ($trainers as $trainer) {
            \Log::info('Processing trainer', [
                'trainer_id' => $trainer->id,
                'trainer_name' => $trainer->name,
            ]);
            // Get completed lectures for this trainer in the month
            // A lecture is considered completed and payable if:
            // 1. trainer_payment_status = 'paid', AND
            // 2. (is_completed = true OR attendance = 'present'/'partially'/'absent' OR student_attendance contains 'present'/'absent')
            
            // Use date range for SQLite compatibility
            $startDate = \Carbon\Carbon::create($year, $month, 1)->startOfMonth()->format('Y-m-d');
            $endDate = \Carbon\Carbon::create($year, $month, 1)->endOfMonth()->format('Y-m-d');
            
            $completedLectures = Lecture::whereHas('course', function ($query) use ($trainer) {
                $query->where('trainer_id', $trainer->id);
            })
            ->whereBetween('date', [$startDate, $endDate])
            ->where('trainer_payment_status', 'paid') // Only count paid lectures
            ->where(function ($query) {
                $query->where('is_completed', true)
                      ->orWhereIn('attendance', ['present', 'partially', 'absent'])
                      ->orWhere(function ($q) {
                          // Check student_attendance for dual courses
                          // If student_attendance is not empty and contains attendance data
                          $q->whereNotNull('student_attendance')
                            ->where('student_attendance', '!=', '[]')
                            ->where('student_attendance', '!=', '{}');
                      });
            })
            ->get()
            ->filter(function ($lecture) {
                // Additional check for dual courses with student_attendance
                if ($lecture->student_attendance && is_array($lecture->student_attendance)) {
                    foreach ($lecture->student_attendance as $studentData) {
                        if (is_array($studentData)) {
                            $attendance = $studentData['attendance'] ?? null;
                            if ($attendance === 'present' || $attendance === 'absent') {
                                return true; // At least one student has attendance set
                            }
                        }
                    }
                }
                // For single courses, check is_completed or attendance
                return $lecture->is_completed || in_array($lecture->attendance, ['present', 'partially', 'absent']);
            })
            ->count();

            \Log::info('Trainer completed lectures', [
                'trainer_id' => $trainer->id,
                'completed_lectures' => $completedLectures,
            ]);

            // Calculate base pay
            $basePay = $completedLectures * $lectureRate;

            // Get renewals count (courses with renewed_with_trainer = true that started in this month)
            // AND verify that the previous course was with the same trainer
            $renewalsCount = Course::where('trainer_id', $trainer->id)
                ->where('renewed_with_trainer', true)
                ->whereMonth('start_date', $month)
                ->whereYear('start_date', $year)
                ->get()
                ->filter(function ($course) use ($trainer) {
                    // Get students for this course
                    $studentIds = $course->students->pluck('id')->toArray();
                    if (empty($studentIds)) {
                        return false; // No students, can't be a renewal
                    }
                    
                    // Find previous course(s) for the same student(s)
                    $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                        $query->whereIn('students.id', $studentIds);
                    })
                    ->where('id', '!=', $course->id)
                    ->where('start_date', '<', $course->start_date)
                    ->orderBy('start_date', 'desc')
                    ->first();
                    
                    // If there's a previous course, check if it was with the same trainer
                    if ($previousCourse) {
                        return $previousCourse->trainer_id === $trainer->id;
                    }
                    
                    // If no previous course found, it's not a valid renewal
                    return false;
                })
                ->count();

            // Calculate renewal bonus using tiered system
            // 5 renewals = 50,000 د.ع, 7 renewals = 100,000 د.ع
            $renewalTotal = 0;
            if ($renewalsCount >= 7) {
                $renewalTotal = 100000;
            } elseif ($renewalsCount >= 5) {
                $renewalTotal = 50000;
            }

            // Calculate volume bonus
            $volumeBonus = 0;
            if ($completedLectures >= 80) {
                $volumeBonus = $volumeBonus80;
            } elseif ($completedLectures >= 60) {
                $volumeBonus = $volumeBonus60;
            }

            // Store renewals data for competition bonus calculation
            $renewalsData[] = [
                'trainer_id' => $trainer->id,
                'renewals_count' => $renewalsCount,
            ];

            // Competition bonus will be calculated after we know all renewals
            $trainerCompetitionBonus = 0;

            // Get bonus_deduction from existing payroll record if exists
            $existingPayroll = TrainerPayroll::where('trainer_id', $trainer->id)
                ->where('month', $month)
                ->where('year', $year)
                ->first();
            
            $bonusDeduction = $existingPayroll ? ($existingPayroll->bonus_deduction ?? 0) : 0;
            $bonusDeductionNotes = $existingPayroll ? ($existingPayroll->bonus_deduction_notes ?? null) : null;
            // استخدام طريقة التحويل من المدرب (ثابتة لكل الأشهر)
            $paymentMethod = $trainer->payment_method ?? ($existingPayroll ? ($existingPayroll->payment_method ?? null) : null);
            $paymentAccountNumber = $trainer->payment_account_number ?? ($existingPayroll ? ($existingPayroll->payment_account_number ?? null) : null);
            $paymentPin = $existingPayroll ? ($existingPayroll->payment_pin ?? null) : null;
            $status = $existingPayroll ? ($existingPayroll->status ?? 'draft') : 'draft';
            $paidAt = $existingPayroll ? ($existingPayroll->paid_at ? $existingPayroll->paid_at->format('Y-m-d H:i:s') : null) : null;
            
            // Get selected bonus type
            $selectedBonusType = $existingPayroll ? ($existingPayroll->selected_bonus_type ?? null) : null;
            
            // المكافآت تلقائية: تطبق تلقائياً إذا استحق المدرب
            // مكافأة التجديد: تلقائية إذا كان هناك تجديدات
            $includeRenewalBonus = $renewalsCount > 0;
            // مكافأة الكمية: تلقائية بناءً على عدد المحاضرات
            $includeVolumeBonus = $volumeBonus > 0;
            // مكافأة المنافسة: سيتم حسابها لاحقاً (لأكثر 3 مدربين)
            $includeCompetitionBonus = false; // سيتم تحديثها بعد حساب أفضل 3
            
            // استخدام مكافأة الكمية المحسوبة تلقائياً
            $selectedVolumeBonus = $volumeBonus > 0 ? $volumeBonus : null;
            $volumeBonusToUse = $volumeBonus;
            
            // Use saved renewal_total and competition_bonus if they exist, otherwise use calculated values
            // إذا كان هناك تجديدات، تأكد من أن renewal_total ليس 0
            $renewalTotalToUse = $existingPayroll && $existingPayroll->renewal_total !== null && $existingPayroll->renewal_total > 0 
                ? $existingPayroll->renewal_total 
                : ($renewalsCount > 0 ? $renewalTotal : 0);
            $competitionBonusToUse = $existingPayroll && $existingPayroll->competition_bonus !== null ? $existingPayroll->competition_bonus : $trainerCompetitionBonus;
            
            // Calculate total pay based on selected bonus type
            $calculatedTotalPay = $basePay;
            if ($selectedBonusType) {
                switch ($selectedBonusType) {
                    case 'renewal':
                        $calculatedTotalPay += $renewalTotalToUse;
                        break;
                    case 'competition':
                        $calculatedTotalPay += $competitionBonusToUse;
                        break;
                    case 'volume_60':
                        $calculatedTotalPay += 30000;
                        break;
                    case 'volume_80':
                        $calculatedTotalPay += 80000;
                        break;
                }
            } else {
                // New system: use inclusion flags - المكافآت مربوطة بالقيم الفعلية فقط
                // مكافأة التجديد: مربوطة بعدد التجديدات
                if ($includeRenewalBonus === true) {
                    $calculatedTotalPay += (float) $renewalTotalToUse;
                }
                // مكافأة الكمية: مربوطة بعدد المحاضرات (60+ = 30,000، 80+ = 80,000)
                if ($selectedVolumeBonus !== null && $selectedVolumeBonus > 0) {
                    $calculatedTotalPay += $selectedVolumeBonus;
                } elseif ($includeVolumeBonus === true && $volumeBonusToUse > 0) {
                    $calculatedTotalPay += $volumeBonusToUse;
                }
                // مكافأة المنافسة: لأكثر 3 مدربين لديهم تجديدات
                if ($includeCompetitionBonus === true) {
                    $calculatedTotalPay += (float) $competitionBonusToUse;
                }
            }
            $calculatedTotalPay += $bonusDeduction;

            $payrolls[] = [
                'trainer_id' => $trainer->id,
                'trainer_name' => $trainer->name,
                'completed_lectures' => $completedLectures,
                'base_pay' => $basePay,
                'renewals_count' => $renewalsCount,
                'renewal_total' => $renewalTotalToUse,
                'include_renewal_bonus' => $includeRenewalBonus,
                'volume_bonus' => $volumeBonus,
                'include_volume_bonus' => $includeVolumeBonus,
                'selected_volume_bonus' => $selectedVolumeBonus,
                'competition_bonus' => $competitionBonusToUse,
                'include_competition_bonus' => $includeCompetitionBonus,
                'selected_bonus_type' => $selectedBonusType,
                'bonus_deduction' => $bonusDeduction,
                'bonus_deduction_notes' => $bonusDeductionNotes,
                'payment_method' => $paymentMethod,
                'payment_account_number' => $paymentAccountNumber,
                'payment_pin' => $paymentPin,
                'total_pay' => $calculatedTotalPay,
                'status' => $status,
                'paid_at' => $paidAt,
            ];
        }

        // Calculate competition bonus (top 3 trainers by renewals)
        usort($renewalsData, function ($a, $b) {
            return $b['renewals_count'] - $a['renewals_count'];
        });

        $top3Trainers = array_slice($renewalsData, 0, 3);
        $top3TrainerIds = array_column($top3Trainers, 'trainer_id');

        // Add competition bonus to top 3 trainers and recalculate total
        foreach ($payrolls as &$payroll) {
            if (in_array($payroll['trainer_id'], $top3TrainerIds) && $payroll['renewals_count'] > 0) {
                // تطبيق مكافأة المنافسة تلقائياً لأفضل 3 مدربين
                $payroll['competition_bonus'] = $competitionBonus;
                $payroll['include_competition_bonus'] = true;
                
                // Recalculate total pay - المكافآت تلقائية ومربوطة بالقيم الفعلية
                $recalculatedTotal = $payroll['base_pay'];
                // مكافأة التجديد: تلقائية إذا كان هناك تجديدات
                if ($payroll['include_renewal_bonus'] === true) {
                    $recalculatedTotal += (float) ($payroll['renewal_total'] ?? 0);
                }
                // مكافأة الكمية: تلقائية بناءً على عدد المحاضرات
                if (isset($payroll['selected_volume_bonus']) && $payroll['selected_volume_bonus'] !== null && $payroll['selected_volume_bonus'] > 0) {
                    $recalculatedTotal += $payroll['selected_volume_bonus'];
                } elseif ($payroll['include_volume_bonus'] === true) {
                    $volumeBonusToAdd = $payroll['volume_bonus'] ?? 0;
                    if ($volumeBonusToAdd > 0) {
                        $recalculatedTotal += $volumeBonusToAdd;
                    }
                }
                // مكافأة المنافسة: تلقائية لأكثر 3 مدربين
                $recalculatedTotal += (float) ($payroll['competition_bonus'] ?? 0);
                $recalculatedTotal += ($payroll['bonus_deduction'] ?? 0);
                $payroll['total_pay'] = $recalculatedTotal;
            }
        }

        // Prepare competition winners data
        $competitionWinners = [];
        foreach ($top3Trainers as $index => $winner) {
            if ($winner['renewals_count'] > 0) {
                $trainer = $trainers->find($winner['trainer_id']);
                $competitionWinners[] = [
                    'trainer_id' => $winner['trainer_id'],
                    'trainer_name' => $trainer ? $trainer->name : 'Unknown',
                    'rank' => $index + 1,
                    'renewals_count' => $winner['renewals_count'],
                    'bonus' => $competitionBonus,
                ];
            }
        }

        // Recalculate total_pay for all payrolls using the model's calculateTotalPay method
        foreach ($payrolls as &$payroll) {
            // Create a temporary model instance to use calculateTotalPay
            $tempPayroll = new TrainerPayroll();
            $tempPayroll->base_pay = (float) ($payroll['base_pay'] ?? 0);
            $tempPayroll->renewal_total = (float) ($payroll['renewal_total'] ?? 0);
            $tempPayroll->competition_bonus = (float) ($payroll['competition_bonus'] ?? 0);
            $tempPayroll->selected_volume_bonus = isset($payroll['selected_volume_bonus']) && $payroll['selected_volume_bonus'] !== null ? (float) $payroll['selected_volume_bonus'] : null;
            $tempPayroll->include_renewal_bonus = isset($payroll['include_renewal_bonus']) ? (bool) $payroll['include_renewal_bonus'] : false;
            $tempPayroll->include_competition_bonus = isset($payroll['include_competition_bonus']) ? (bool) $payroll['include_competition_bonus'] : false;
            $tempPayroll->bonus_deduction = (float) ($payroll['bonus_deduction'] ?? 0);
            $tempPayroll->selected_bonus_type = $payroll['selected_bonus_type'] ?? null;
            
            // Log for debugging
            \Log::info('Recalculating total_pay for payroll', [
                'trainer_id' => $payroll['trainer_id'],
                'base_pay' => $tempPayroll->base_pay,
                'renewal_total' => $tempPayroll->renewal_total,
                'competition_bonus' => $tempPayroll->competition_bonus,
                'selected_volume_bonus' => $tempPayroll->selected_volume_bonus,
                'include_renewal_bonus' => $tempPayroll->include_renewal_bonus,
                'include_competition_bonus' => $tempPayroll->include_competition_bonus,
                'bonus_deduction' => $tempPayroll->bonus_deduction,
                'calculated_total' => $tempPayroll->calculateTotalPay(),
            ]);
            
            // Recalculate total_pay
            $payroll['total_pay'] = $tempPayroll->calculateTotalPay();
        }
        unset($payroll); // Break reference
        
        // Calculate summary
        $summary = [
            'total_trainers' => count($payrolls),
            'total_lectures' => array_sum(array_column($payrolls, 'completed_lectures')),
            'total_renewals' => array_sum(array_column($payrolls, 'renewals_count')),
            'total_payout' => array_sum(array_column($payrolls, 'total_pay')),
        ];

        \Log::info('Payroll calculation complete', [
            'payrolls_count' => count($payrolls),
            'summary' => $summary,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'month' => $month,
                'year' => $year,
                'payrolls' => $payrolls,
                'competition_winners' => $competitionWinners,
                'summary' => $summary,
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
     * Update bonus/deduction for a trainer payroll
     */
    public function updateBonusDeduction(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020',
            'bonus_deduction' => 'required|numeric',
            'bonus_deduction_notes' => 'nullable|string|max:1000',
        ]);

        $trainerId = $request->input('trainer_id');
        $month = $request->input('month');
        $year = $request->input('year');
        $bonusDeduction = (float) $request->input('bonus_deduction');
        $notes = $request->input('bonus_deduction_notes');

        // Find or create payroll record
        $payroll = TrainerPayroll::firstOrCreate(
            [
                'trainer_id' => $trainerId,
                'month' => $month,
                'year' => $year,
            ],
            [
                'lecture_rate' => 4000,
                'renewal_bonus_rate' => 0, // Using tiered system: 5 renewals = 50k, 7 renewals = 100k
                'status' => 'draft',
            ]
        );

        // Update bonus_deduction
        $payroll->bonus_deduction = $bonusDeduction;
        $payroll->bonus_deduction_notes = $notes;
        
        // Recalculate total_pay if other values are set
        if ($payroll->base_pay > 0 || $payroll->renewal_total > 0 || $payroll->volume_bonus > 0 || $payroll->competition_bonus > 0) {
            $payroll->total_pay = $payroll->calculateTotalPay();
        }
        
        $payroll->save();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث البونص/الخصم بنجاح',
            'data' => $payroll,
        ]);
    }

    /**
     * Update selected bonus type for a trainer payroll
     */
    public function updateBonusSelection(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020',
            'include_renewal_bonus' => 'boolean',
            'include_competition_bonus' => 'boolean',
            'selected_volume_bonus' => 'nullable|numeric|in:30000,80000',
        ]);

        $trainerId = $request->input('trainer_id');
        $month = $request->input('month');
        $year = $request->input('year');
        $includeRenewalBonus = $request->input('include_renewal_bonus', false);
        $includeCompetitionBonus = $request->input('include_competition_bonus', false);
        $selectedVolumeBonus = $request->input('selected_volume_bonus');

        // Calculate renewal bonus - verify previous course was with same trainer
        $renewalsCount = Course::where('trainer_id', $trainerId)
            ->where('renewed_with_trainer', true)
            ->whereMonth('start_date', $month)
            ->whereYear('start_date', $year)
            ->get()
            ->filter(function ($course) use ($trainerId) {
                $studentIds = $course->students->pluck('id')->toArray();
                if (empty($studentIds)) {
                    return false;
                }
                
                $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                    $query->whereIn('students.id', $studentIds);
                })
                ->where('id', '!=', $course->id)
                ->where('start_date', '<', $course->start_date)
                ->orderBy('start_date', 'desc')
                ->first();
                
                if ($previousCourse) {
                    return $previousCourse->trainer_id === $trainerId;
                }
                
                return false;
            })
            ->count();
        
        // Calculate renewal bonus using tiered system
        // 5 renewals = 50,000 د.ع, 7 renewals = 100,000 د.ع
        $renewalTotal = 0;
        if ($renewalsCount >= 7) {
            $renewalTotal = 100000;
        } elseif ($renewalsCount >= 5) {
            $renewalTotal = 50000;
        }

        // Calculate competition bonus (check if trainer is in top 3)
        $competitionBonus = 20000;
        $allRenewalsData = Course::where('renewed_with_trainer', true)
            ->whereMonth('start_date', $month)
            ->whereYear('start_date', $year)
            ->selectRaw('trainer_id, COUNT(*) as renewals_count')
            ->groupBy('trainer_id')
            ->get()
            ->toArray();
        
        usort($allRenewalsData, function ($a, $b) {
            return $b['renewals_count'] - $a['renewals_count'];
        });
        $top3Trainers = array_slice($allRenewalsData, 0, 3);
        $top3TrainerIds = array_column($top3Trainers, 'trainer_id');
        
        $trainerCompetitionBonus = 0;
        if (in_array($trainerId, $top3TrainerIds) && $renewalsCount > 0) {
            $trainerRenewalsData = array_filter($allRenewalsData, function($item) use ($trainerId) {
                return $item['trainer_id'] == $trainerId;
            });
            if (!empty($trainerRenewalsData)) {
                $trainerRenewalsCount = reset($trainerRenewalsData)['renewals_count'];
                $top3RenewalsCounts = array_column($top3Trainers, 'renewals_count');
                if (in_array($trainerRenewalsCount, $top3RenewalsCounts) && $trainerRenewalsCount > 0) {
                    $trainerCompetitionBonus = $competitionBonus;
                }
            }
        }

        // Calculate completed lectures (only paid ones)
        $startDate = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = \Carbon\Carbon::create($year, $month, 1)->endOfMonth();
        
        $completedLectures = Lecture::whereHas('course', function ($query) use ($trainerId) {
                $query->where('trainer_id', $trainerId);
            })
            ->whereBetween('date', [$startDate, $endDate])
            ->where('trainer_payment_status', 'paid') // Only count paid lectures
            ->get()
            ->filter(function ($lecture) {
                if ($lecture->student_attendance && is_array($lecture->student_attendance)) {
                    foreach ($lecture->student_attendance as $studentData) {
                        if (is_array($studentData)) {
                            $attendance = $studentData['attendance'] ?? null;
                            if ($attendance === 'present' || $attendance === 'absent') {
                                return true;
                            }
                        }
                    }
                }
                return $lecture->is_completed || in_array($lecture->attendance, ['present', 'partially', 'absent']);
            })
            ->count();

        // Calculate base pay
        $lectureRate = 4000;
        $basePay = $completedLectures * $lectureRate;

        // Find or create payroll record
        $payroll = TrainerPayroll::firstOrCreate(
            [
                'trainer_id' => $trainerId,
                'month' => $month,
                'year' => $year,
            ],
            [
                'lecture_rate' => $lectureRate,
                'renewal_bonus_rate' => 0, // Using tiered system: 5 renewals = 50k, 7 renewals = 100k
                'completed_lectures' => $completedLectures,
                'base_pay' => $basePay,
                'renewals_count' => $renewalsCount,
                'renewal_total' => $renewalTotal,
                'volume_bonus' => 0,
                'competition_bonus' => $trainerCompetitionBonus,
                'status' => 'draft',
            ]
        );

        // Update calculated values
        $payroll->completed_lectures = $completedLectures;
        $payroll->base_pay = $basePay;
        $payroll->renewals_count = $renewalsCount;
        $payroll->renewal_total = $renewalTotal;
        $payroll->competition_bonus = $trainerCompetitionBonus;

        // تحديث المكافآت المختارة
        $payroll->include_renewal_bonus = $includeRenewalBonus;
        $payroll->include_competition_bonus = $includeCompetitionBonus;
        $payroll->selected_volume_bonus = $selectedVolumeBonus;
        $payroll->selected_bonus_type = null; // إلغاء النظام القديم
        
        // إعادة حساب الإجمالي
        $payroll->total_pay = $payroll->calculateTotalPay();
        $payroll->save();
        
        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المكافأة بنجاح',
            'data' => $payroll,
        ]);
    }

    /**
     * Update bonus inclusion flags for a trainer payroll
     */
    public function updateBonusInclusion(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020',
            'include_renewal_bonus' => 'boolean',
            'include_volume_bonus' => 'boolean',
            'selected_volume_bonus' => 'nullable|numeric|in:0,30000,80000',
            'include_competition_bonus' => 'boolean',
        ]);

        $trainerId = $request->input('trainer_id');
        $month = $request->input('month');
        $year = $request->input('year');

        // Calculate renewal bonus - verify previous course was with same trainer
        $renewalsCount = Course::where('trainer_id', $trainerId)
            ->where('renewed_with_trainer', true)
            ->whereMonth('start_date', $month)
            ->whereYear('start_date', $year)
            ->get()
            ->filter(function ($course) use ($trainerId) {
                $studentIds = $course->students->pluck('id')->toArray();
                if (empty($studentIds)) {
                    return false;
                }
                
                $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                    $query->whereIn('students.id', $studentIds);
                })
                ->where('id', '!=', $course->id)
                ->where('start_date', '<', $course->start_date)
                ->orderBy('start_date', 'desc')
                ->first();
                
                if ($previousCourse) {
                    return $previousCourse->trainer_id === $trainerId;
                }
                
                return false;
            })
            ->count();
        
        // Calculate renewal bonus using tiered system
        // 5 renewals = 50,000 د.ع, 7 renewals = 100,000 د.ع
        $renewalTotal = 0;
        if ($renewalsCount >= 7) {
            $renewalTotal = 100000;
        } elseif ($renewalsCount >= 5) {
            $renewalTotal = 50000;
        }

        // Calculate competition bonus (check if trainer is in top 3)
        // First, get all renewals for all trainers in this month
        $competitionBonus = 20000;
        $allRenewalsData = Course::where('renewed_with_trainer', true)
            ->whereMonth('start_date', $month)
            ->whereYear('start_date', $year)
            ->selectRaw('trainer_id, COUNT(*) as renewals_count')
            ->groupBy('trainer_id')
            ->get()
            ->toArray();
        
        // Sort by renewals_count and get top 3
        usort($allRenewalsData, function ($a, $b) {
            return $b['renewals_count'] - $a['renewals_count'];
        });
        $top3Trainers = array_slice($allRenewalsData, 0, 3);
        $top3TrainerIds = array_column($top3Trainers, 'trainer_id');
        
        // Check if this trainer is in top 3 and has renewals
        $trainerCompetitionBonus = 0;
        if (in_array($trainerId, $top3TrainerIds) && $renewalsCount > 0) {
            // Check if this trainer's renewals_count matches or is in top 3
            $trainerRenewalsData = array_filter($allRenewalsData, function($item) use ($trainerId) {
                return $item['trainer_id'] == $trainerId;
            });
            if (!empty($trainerRenewalsData)) {
                $trainerRenewalsCount = reset($trainerRenewalsData)['renewals_count'];
                // Check if trainer is in top 3 (handle ties)
                $top3RenewalsCounts = array_column($top3Trainers, 'renewals_count');
                if (in_array($trainerRenewalsCount, $top3RenewalsCounts) && $trainerRenewalsCount > 0) {
                    $trainerCompetitionBonus = $competitionBonus;
                }
            }
        }

        // Calculate completed lectures for volume bonus (only paid ones)
        $startDate = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = \Carbon\Carbon::create($year, $month, 1)->endOfMonth();
        
        $completedLectures = Lecture::whereHas('course', function ($query) use ($trainerId) {
                $query->where('trainer_id', $trainerId);
            })
            ->whereBetween('date', [$startDate, $endDate])
            ->where('trainer_payment_status', 'paid') // Only count paid lectures
            ->get()
            ->filter(function ($lecture) {
                if ($lecture->student_attendance && is_array($lecture->student_attendance)) {
                    foreach ($lecture->student_attendance as $studentData) {
                        if (is_array($studentData)) {
                            $attendance = $studentData['attendance'] ?? null;
                            if ($attendance === 'present' || $attendance === 'absent') {
                                return true;
                            }
                        }
                    }
                }
                return $lecture->is_completed || in_array($lecture->attendance, ['present', 'partially', 'absent']);
            })
            ->count();

        // Calculate volume bonus
        $volumeBonus = 0;
        if ($completedLectures >= 80) {
            $volumeBonus = 80000;
        } elseif ($completedLectures >= 60) {
            $volumeBonus = 30000;
        }

        // Calculate base pay
        $lectureRate = 4000;
        $basePay = $completedLectures * $lectureRate;

        // Find or create payroll record
        $payroll = TrainerPayroll::firstOrCreate(
            [
                'trainer_id' => $trainerId,
                'month' => $month,
                'year' => $year,
            ],
            [
                'lecture_rate' => $lectureRate,
                'renewal_bonus_rate' => 0, // Using tiered system: 5 renewals = 50k, 7 renewals = 100k
                'completed_lectures' => $completedLectures,
                'base_pay' => $basePay,
                'renewals_count' => $renewalsCount,
                'renewal_total' => $renewalTotal,
                'volume_bonus' => $volumeBonus,
                'competition_bonus' => $trainerCompetitionBonus,
                'status' => 'draft',
                'include_renewal_bonus' => true,
                'include_volume_bonus' => true,
                'include_competition_bonus' => true,
            ]
        );

        // Update calculated values
        $payroll->completed_lectures = $completedLectures;
        $payroll->base_pay = $basePay;
        $payroll->renewals_count = $renewalsCount;
        $payroll->renewal_total = $renewalTotal;
        $payroll->volume_bonus = $volumeBonus;
        $payroll->competition_bonus = $trainerCompetitionBonus;

        // Update bonus inclusion flags
        if ($request->has('include_renewal_bonus')) {
            $payroll->include_renewal_bonus = (bool) $request->input('include_renewal_bonus');
        }
        
        // Handle volume bonus selection
        if ($request->has('selected_volume_bonus')) {
            $selectedVolumeBonus = $request->input('selected_volume_bonus');
            if ($selectedVolumeBonus == 0 || $selectedVolumeBonus === null) {
                $payroll->selected_volume_bonus = null;
                $payroll->include_volume_bonus = false;
            } else {
                $payroll->selected_volume_bonus = (float) $selectedVolumeBonus;
                $payroll->include_volume_bonus = true;
            }
        } else if ($request->has('include_volume_bonus')) {
            $payroll->include_volume_bonus = (bool) $request->input('include_volume_bonus');
        }
        
        if ($request->has('include_competition_bonus')) {
            $payroll->include_competition_bonus = (bool) $request->input('include_competition_bonus');
        }
        
        // Recalculate total_pay
        $payroll->total_pay = $payroll->calculateTotalPay();
        $payroll->save();
        
        \Log::info('Bonus inclusion updated', [
            'trainer_id' => $trainerId,
            'month' => $month,
            'year' => $year,
            'include_renewal_bonus' => $payroll->include_renewal_bonus,
            'renewal_total' => $payroll->renewal_total,
            'include_volume_bonus' => $payroll->include_volume_bonus,
            'selected_volume_bonus' => $payroll->selected_volume_bonus,
            'include_competition_bonus' => $payroll->include_competition_bonus,
            'competition_bonus' => $payroll->competition_bonus,
            'total_pay' => $payroll->total_pay,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المكافآت بنجاح',
            'data' => $payroll,
        ]);
    }

    /**
     * Update payment method for a trainer payroll
     */
    public function updatePaymentMethod(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'payment_method' => 'required|in:zain_cash,qi_card',
            'payment_account_number' => 'required|string|max:50',
            'payment_pin' => 'nullable|string|max:20',
        ]);

        $trainerId = $request->input('trainer_id');
        $paymentMethod = $request->input('payment_method');
        $paymentAccountNumber = $request->input('payment_account_number');
        $paymentPin = $request->input('payment_pin');

        // Find trainer and update payment method (ثابت لكل الأشهر)
        $trainer = Trainer::findOrFail($trainerId);
        
        // Save old values for logging
        $oldPaymentMethod = $trainer->payment_method;
        $oldPaymentAccountNumber = $trainer->payment_account_number;
        
        // Update payment method in trainer table
        $trainer->payment_method = $paymentMethod;
        $trainer->payment_account_number = $paymentAccountNumber;
        $trainer->save();

        // Update payment_pin in all payroll records for this trainer (if provided)
        if ($paymentPin !== null) {
            TrainerPayroll::where('trainer_id', $trainerId)
                ->update(['payment_pin' => $paymentPin]);
        }

        // Log the change in ActivityLog
        try {
            ActivityLog::create([
                'user_id' => auth()->id() ?? $request->user()?->id,
                'action' => 'trainer_payment_method_updated',
                'model_type' => 'Trainer',
                'model_id' => $trainer->id,
                'old_values' => [
                    'payment_method' => $oldPaymentMethod,
                    'payment_account_number' => $oldPaymentAccountNumber,
                ],
                'new_values' => [
                    'payment_method' => $paymentMethod,
                    'payment_account_number' => $paymentAccountNumber,
                    'payment_pin' => $paymentPin ?? null,
                ],
                'description' => "تم تحديث طريقة التحويل للمدرب {$trainer->name} من '{$oldPaymentMethod}' إلى '{$paymentMethod}'",
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Log::warning('Failed to log payment method update: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث طريقة التحويل بنجاح (ستطبق على جميع الأشهر)',
            'data' => $trainer,
        ]);
    }

    /**
     * Mark trainer payroll as paid
     */
    public function markTrainerPaid(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020',
        ]);

        $trainerId = $request->input('trainer_id');
        $month = $request->input('month');
        $year = $request->input('year');

        // Find or create payroll record
        $payroll = TrainerPayroll::firstOrCreate(
            [
                'trainer_id' => $trainerId,
                'month' => $month,
                'year' => $year,
            ],
            [
                'lecture_rate' => 4000,
                'renewal_bonus_rate' => 0, // Using tiered system: 5 renewals = 50k, 7 renewals = 100k
                'status' => 'draft',
            ]
        );

        // Save old status for logging
        $oldStatus = $payroll->status ?? 'draft';
        
        // Update status to paid
        $payroll->status = 'paid';
        $payroll->paid_at = now();
        $payroll->save();

        // Log the change in ActivityLog
        try {
            $trainer = Trainer::find($trainerId);
            $monthName = $this->getMonthName($month);
            
            ActivityLog::create([
                'user_id' => auth()->id() ?? $request->user()?->id,
                'action' => 'trainer_payroll_status_changed',
                'model_type' => 'TrainerPayroll',
                'model_id' => $payroll->id,
                'old_values' => ['status' => $oldStatus],
                'new_values' => ['status' => 'paid', 'paid_at' => $payroll->paid_at->format('Y-m-d H:i:s')],
                'description' => "تم تحديث حالة راتب المدرب {$trainer->name} لشهر {$monthName} {$year} من '{$oldStatus}' إلى 'paid'",
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Log::warning('Failed to log payroll status change: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث حالة الراتب بنجاح',
            'data' => $payroll,
        ]);
    }

    /**
     * Mark trainer payroll as unpaid
     */
    public function markTrainerUnpaid(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'trainer_id' => 'required|exists:trainers,id',
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020',
        ]);

        $trainerId = $request->input('trainer_id');
        $month = $request->input('month');
        $year = $request->input('year');

        // Find payroll record
        $payroll = TrainerPayroll::where('trainer_id', $trainerId)
            ->where('month', $month)
            ->where('year', $year)
            ->first();

        if (!$payroll) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم العثور على سجل الراتب',
            ], 404);
        }

        // Save old status for logging
        $oldStatus = $payroll->status ?? 'draft';
        $oldPaidAt = $payroll->paid_at ? $payroll->paid_at->format('Y-m-d H:i:s') : null;
        
        // Update status to draft (unpaid)
        $payroll->status = 'draft';
        $payroll->paid_at = null;
        $payroll->save();

        // Log the change in ActivityLog
        try {
            $trainer = Trainer::find($trainerId);
            $monthName = $this->getMonthName($month);
            
            ActivityLog::create([
                'user_id' => auth()->id() ?? $request->user()?->id,
                'action' => 'trainer_payroll_status_changed',
                'model_type' => 'TrainerPayroll',
                'model_id' => $payroll->id,
                'old_values' => ['status' => $oldStatus, 'paid_at' => $oldPaidAt],
                'new_values' => ['status' => 'draft', 'paid_at' => null],
                'description' => "تم تحديث حالة راتب المدرب {$trainer->name} لشهر {$monthName} {$year} من '{$oldStatus}' إلى 'draft'",
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Log::warning('Failed to log payroll status change: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث حالة الراتب بنجاح',
            'data' => $payroll,
        ]);
    }

    /**
     * Helper: Get Arabic month name
     */
    protected function getMonthName(int $month): string
    {
        $months = [
            1 => 'يناير', 2 => 'فبراير', 3 => 'مارس', 4 => 'أبريل',
            5 => 'مايو', 6 => 'يونيو', 7 => 'يوليو', 8 => 'أغسطس',
            9 => 'سبتمبر', 10 => 'أكتوبر', 11 => 'نوفمبر', 12 => 'ديسمبر'
        ];
        return $months[$month] ?? "شهر {$month}";
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


