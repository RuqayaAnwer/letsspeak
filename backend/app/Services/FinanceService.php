<?php
/**
 * Finance Service - Financial calculations and payroll logic
 * Uses MySQL database via Eloquent models
 */

namespace App\Services;

use App\Models\Trainer;
use App\Models\TrainerPayroll;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\Payment;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class FinanceService
{
    /**
     * Calculate trainer payroll for a specific month
     */
    public function calculateTrainerPayroll(int $trainerId, int $month, int $year): array
    {
        $trainer = Trainer::find($trainerId);
        
        if (!$trainer) {
            return ['error' => 'Trainer not found'];
        }

        // Get settings
        $lectureRate = Setting::getLectureRate();
        $renewalBonus = Setting::getRenewalBonus();
        $volumeBonus60 = Setting::getVolumeBonus60();
        $volumeBonus80 = Setting::getVolumeBonus80();

        // Calculate completed lectures for the month
        $completedLectures = Lecture::whereHas('course', function ($query) use ($trainerId) {
            $query->where('trainer_id', $trainerId);
        })
        ->whereMonth('date', $month)
        ->whereYear('date', $year)
        ->whereIn('attendance', ['present', 'partially'])
        ->count();

        // Calculate renewals for the month
        $renewalsCount = Course::where('trainer_id', $trainerId)
            ->where('renewed_with_trainer', true)
            ->whereMonth('start_date', $month)
            ->whereYear('start_date', $year)
            ->count();

        // Base pay
        $basePay = $completedLectures * $lectureRate;

        // Renewal bonus
        $renewalTotal = $renewalsCount * $renewalBonus;

        // Volume bonus (80 lectures replaces 60)
        $volumeBonus = 0;
        if ($completedLectures >= 80) {
            $volumeBonus = $volumeBonus80;
        } elseif ($completedLectures >= 60) {
            $volumeBonus = $volumeBonus60;
        }

        // Competition bonus will be calculated separately
        $competitionBonus = 0;

        $totalPay = $basePay + $renewalTotal + $volumeBonus + $competitionBonus;

        return [
            'trainer_id' => $trainerId,
            'trainer_name' => $trainer->name,
            'month' => $month,
            'year' => $year,
            'completed_lectures' => $completedLectures,
            'lecture_rate' => $lectureRate,
            'base_pay' => $basePay,
            'renewals_count' => $renewalsCount,
            'renewal_bonus_rate' => $renewalBonus,
            'renewal_total' => $renewalTotal,
            'volume_bonus' => $volumeBonus,
            'competition_bonus' => $competitionBonus,
            'total_pay' => $totalPay,
        ];
    }

    /**
     * Calculate competition bonus (top 3 trainers in renewals)
     */
    public function calculateCompetitionBonus(int $month, int $year): array
    {
        $competitionBonus = Setting::getCompetitionBonus();

        // Get all trainers with their renewal counts for the month
        $trainerRenewals = Course::where('renewed_with_trainer', true)
            ->whereMonth('start_date', $month)
            ->whereYear('start_date', $year)
            ->select('trainer_id', DB::raw('COUNT(*) as renewals_count'))
            ->groupBy('trainer_id')
            ->orderBy('renewals_count', 'desc')
            ->get();

        if ($trainerRenewals->isEmpty()) {
            return [];
        }

        // Get top 3 (allowing ties)
        $topRenewals = $trainerRenewals->first()->renewals_count;
        $topTrainers = [];
        $rank = 0;
        $lastCount = null;

        foreach ($trainerRenewals as $tr) {
            if ($lastCount !== $tr->renewals_count) {
                $rank++;
                if ($rank > 3) break;
            }
            
            $trainer = Trainer::find($tr->trainer_id);
            $topTrainers[] = [
                'trainer_id' => $tr->trainer_id,
                'trainer_name' => $trainer ? $trainer->name : 'Unknown',
                'renewals_count' => $tr->renewals_count,
                'bonus' => $competitionBonus,
                'rank' => $rank,
            ];
            
            $lastCount = $tr->renewals_count;
        }

        return $topTrainers;
    }

    /**
     * Generate monthly payroll for all trainers
     */
    public function generateMonthlyPayroll(int $month, int $year): array
    {
        $trainers = Trainer::where('status', 'active')->get();
        $payrolls = [];

        // Calculate competition bonus first
        $competitionWinners = $this->calculateCompetitionBonus($month, $year);
        $winnerIds = array_column($competitionWinners, 'trainer_id');
        $competitionBonus = Setting::getCompetitionBonus();

        foreach ($trainers as $trainer) {
            $payroll = $this->calculateTrainerPayroll($trainer->id, $month, $year);
            
            // Add competition bonus if winner
            if (in_array($trainer->id, $winnerIds)) {
                $payroll['competition_bonus'] = $competitionBonus;
                $payroll['total_pay'] += $competitionBonus;
            }

            $payrolls[] = $payroll;
        }

        return [
            'month' => $month,
            'year' => $year,
            'payrolls' => $payrolls,
            'competition_winners' => $competitionWinners,
            'summary' => [
                'total_trainers' => count($payrolls),
                'total_lectures' => array_sum(array_column($payrolls, 'completed_lectures')),
                'total_renewals' => array_sum(array_column($payrolls, 'renewals_count')),
                'total_payout' => array_sum(array_column($payrolls, 'total_pay')),
            ],
        ];
    }

    /**
     * Save payroll record
     */
    public function savePayroll(array $payrollData): TrainerPayroll
    {
        return TrainerPayroll::updateOrCreate(
            [
                'trainer_id' => $payrollData['trainer_id'],
                'month' => $payrollData['month'],
                'year' => $payrollData['year'],
            ],
            [
                'completed_lectures' => $payrollData['completed_lectures'],
                'lecture_rate' => $payrollData['lecture_rate'],
                'base_pay' => $payrollData['base_pay'],
                'renewals_count' => $payrollData['renewals_count'],
                'renewal_bonus_rate' => $payrollData['renewal_bonus_rate'],
                'renewal_total' => $payrollData['renewal_total'],
                'volume_bonus' => $payrollData['volume_bonus'],
                'competition_bonus' => $payrollData['competition_bonus'] ?? 0,
                'total_pay' => $payrollData['total_pay'],
                'status' => 'draft',
            ]
        );
    }

    /**
     * Get financial summary for a period
     */
    public function getFinancialSummary(int $month, int $year): array
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = Carbon::create($year, $month, 1)->endOfMonth();

        // Total payments received
        $totalPayments = Payment::whereBetween('payment_date', [$startDate, $endDate])
            ->where('status', 'completed')
            ->sum('amount');

        // Total trainer payout
        $totalPayout = TrainerPayroll::where('month', $month)
            ->where('year', $year)
            ->sum('total_pay');

        // Course statistics
        $newCourses = Course::whereBetween('start_date', [$startDate, $endDate])->count();
        $finishedCourses = Course::whereIn('status', ['finished', 'paid'])
            ->whereBetween('finished_at', [$startDate, $endDate])
            ->count();

        // Pending payments (courses with remaining balance)
        $pendingPayments = Course::where('status', 'active')
            ->whereRaw('total_amount > amount_paid')
            ->sum(DB::raw('total_amount - amount_paid'));

        return [
            'period' => [
                'month' => $month,
                'year' => $year,
                'month_name' => $startDate->translatedFormat('F'),
            ],
            'revenue' => [
                'total_payments' => $totalPayments,
                'pending_payments' => $pendingPayments,
            ],
            'expenses' => [
                'total_trainer_payout' => $totalPayout,
            ],
            'courses' => [
                'new_courses' => $newCourses,
                'finished_courses' => $finishedCourses,
            ],
            'profit' => $totalPayments - $totalPayout,
        ];
    }

    /**
     * Get trainer financial details
     */
    public function getTrainerFinancials(int $trainerId, int $month, int $year): array
    {
        $trainer = Trainer::find($trainerId);
        
        if (!$trainer) {
            return ['error' => 'Trainer not found'];
        }

        $payroll = $this->calculateTrainerPayroll($trainerId, $month, $year);

        // Get courses for this trainer in this period
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = Carbon::create($year, $month, 1)->endOfMonth();

        $courses = Course::where('trainer_id', $trainerId)
            ->where(function ($query) use ($startDate, $endDate) {
                $query->where('status', 'active')
                    ->orWhere(function ($q) use ($startDate, $endDate) {
                        $q->whereIn('status', ['finished', 'paid'])
                            ->whereBetween('finished_at', [$startDate, $endDate]);
                    });
            })
            ->with('students')
            ->get();

        // Get lectures for this period
        $lectures = Lecture::whereHas('course', function ($query) use ($trainerId) {
            $query->where('trainer_id', $trainerId);
        })
        ->whereBetween('date', [$startDate, $endDate])
        ->with('course.students')
        ->orderBy('date')
        ->get();

        return [
            'trainer' => [
                'id' => $trainer->id,
                'name' => $trainer->name,
            ],
            'payroll' => $payroll,
            'courses' => $courses->map(function ($course) {
                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'students' => $course->students->pluck('name'),
                    'status' => $course->status,
                    'progress' => $course->progress_percentage,
                ];
            }),
            'lectures' => $lectures->map(function ($lecture) {
                return [
                    'id' => $lecture->id,
                    'course_id' => $lecture->course_id,
                    'lecture_number' => $lecture->lecture_number,
                    'date' => $lecture->date->format('Y-m-d'),
                    'attendance' => $lecture->attendance,
                    'payment_status' => $lecture->payment_status,
                ];
            }),
        ];
    }

    /**
     * Update payment status
     */
    public function updatePaymentStatus(int $paymentId, string $status): ?Payment
    {
        $payment = Payment::find($paymentId);
        
        if (!$payment) {
            return null;
        }

        $payment->status = $status;
        $payment->save();

        // Update course amount_paid if completed
        if ($status === 'completed') {
            $course = $payment->course;
            $totalPaid = $course->payments()->where('status', 'completed')->sum('amount');
            $course->amount_paid = $totalPaid;
            $course->save();
        }

        return $payment;
    }

    /**
     * Record new payment
     */
    public function recordPayment(array $data): Payment
    {
        $payment = Payment::create($data);

        // Update course amount_paid
        $course = Course::find($data['course_id']);
        if ($course) {
            $totalPaid = $course->payments()->where('status', 'completed')->sum('amount');
            $course->amount_paid = $totalPaid;
            $course->save();
        }

        return $payment;
    }
}
