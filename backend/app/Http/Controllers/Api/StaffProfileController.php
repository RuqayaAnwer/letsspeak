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
        $trainerId = null;

        if ($type === 'trainer') {
            $trainer = Trainer::with(['user:id,name,email,job_title,role,created_at,base_salary', 'courses.student', 'courses.package'])->find($id);

            if (!$trainer) {
                return response()->json(['success' => false, 'message' => 'Trainer not found'], 404);
            }

            $userId = $trainer->user_id;
            $trainerId = $trainer->id;

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
                    'title' => collect([
                        $course->coursePackage ? $course->coursePackage->name : 'كورس مخصص',
                        $course->is_dual ? '(ثنائي)' : '(فردي)'
                    ])->filter()->join(' '),
                    'student' => $course->student,
                    'package' => $course->package,
                    'status' => $course->status,
                    'start_date' => $course->start_date,
                    'actual_start_date' => $course->actual_start_date,
                    'finished_at' => $course->finished_at,
                    'completed_lectures' => $course->lectures()->whereIn('attendance', ['present', 'partially', 'absent'])->count(),
                    'total_lectures' => $course->lectures_count,
                    'progress' => $course->progress,
                    'is_kids' => $course->is_kids,
                ];
            });

            // Get Payrolls
            $payrollQuery = TrainerPayroll::where('trainer_id', $trainer->id);
            if ($userId) {
                // Fetch payrolls matching either trainer_id or user_id for safety
                $payrollQuery->orWhere('user_id', $userId);
            }
            $payrolls = $payrollQuery->with('user')->orderBy('year', 'desc')->orderBy('month', 'desc')->get();
            $payrolls = $this->populatePayrollDetails($payrolls, $trainerId, $userId);

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
                        'title' => collect([
                            $course->coursePackage ? $course->coursePackage->name : 'كورس مخصص',
                            $course->is_dual ? '(ثنائي)' : '(فردي)'
                        ])->filter()->join(' '),
                        'student' => $course->student,
                        'package' => $course->package,
                        'status' => $course->status,
                        'start_date' => $course->start_date,
                        'actual_start_date' => $course->actual_start_date,
                        'finished_at' => $course->finished_at,
                        'completed_lectures' => $course->lectures()->whereIn('attendance', ['present', 'partially', 'absent'])->count(),
                        'total_lectures' => $course->lectures_count,
                        'progress' => $course->progress,
                        'is_kids' => $course->is_kids,
                    ];
                });
            }

            // Get Payrolls
            $payrollQuery = TrainerPayroll::where('user_id', $targetUser->id);
            if ($trainerId) {
                $payrollQuery->orWhere('trainer_id', $trainerId);
            }
            $payrolls = $payrollQuery->with('user')->orderBy('year', 'desc')->orderBy('month', 'desc')->get();
            $payrolls = $this->populatePayrollDetails($payrolls, $trainerId, $targetUser->id);

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
                    'courses_this_month' => $trainerId ? \App\Models\Course::where('trainer_id', $trainerId)->whereMonth('start_date', \Carbon\Carbon::now()->month)->whereYear('start_date', \Carbon\Carbon::now()->year)->count() : 0,
                    'completed_lectures_total' => $trainerId ? \App\Models\Lecture::forTrainer($trainerId)->whereIn('attendance', ['present', 'partially', 'absent'])->count() : 0,
                    'completed_kids_lectures_total' => $trainerId ? \App\Models\Lecture::forTrainer($trainerId)->whereIn('attendance', ['present', 'partially', 'absent'])->whereHas('course', function ($q) { $q->where('is_kids', true); })->count() : 0,
                ]
            ]
        ]);
    }

    /**
     * Populate payroll details with dynamic metrics.
     */
    private function populatePayrollDetails($payrolls, $trainerId, $userId)
    {
        $lectureRate = 4000;
        $volumeBonus60 = 30000;
        $volumeBonus80 = 80000;
        $competitionBonus = 20000;

        return $payrolls->map(function ($payroll) use ($trainerId, $userId, $lectureRate, $volumeBonus60, $volumeBonus80, $competitionBonus) {
            // If already paid, use stored database values
            if ($payroll->status === 'paid') {
                return $payroll;
            }

            $month = $payroll->month;
            $year = $payroll->year;
            $tId = $payroll->trainer_id ?: $trainerId;
            $uId = $payroll->user_id ?: $userId;

            $startDate = \Carbon\Carbon::create($year, $month, 1)->startOfMonth()->format('Y-m-d');
            $endDate = \Carbon\Carbon::create($year, $month, 1)->endOfMonth()->format('Y-m-d');

            // 1. Calculate completed lectures and base pay
            $completedLecturesRates = \App\Models\Lecture::select(
                'courses.is_kids',
                'course_packages.name as package_name',
                \Illuminate\Support\Facades\DB::raw('count(*) as count')
            )
                ->join('courses', 'lectures.course_id', '=', 'courses.id')
                ->leftJoin('course_packages', 'courses.course_package_id', '=', 'course_packages.id')
                ->whereBetween('lectures.date', [$startDate, $endDate])
                ->where(function ($query) use ($tId) {
                    $query->where('lectures.trainer_id', $tId)
                          ->orWhere(function ($sub) use ($tId) {
                              $sub->whereNull('lectures.trainer_id')
                                  ->where('courses.trainer_id', $tId);
                          });
                })
                ->whereIn('lectures.attendance', ['present', 'partially', 'absent'])
                ->groupBy('courses.is_kids', 'course_packages.name')
                ->get();

            $completedLectures = 0;
            $trainerBasePay = 0;
            foreach ($completedLecturesRates as $rateRow) {
                $pkgName = $rateRow->package_name ?? '';
                $isKids = $rateRow->is_kids || (mb_strpos($pkgName, 'اطفال') !== false || mb_strpos(mb_strtolower($pkgName, 'UTF-8'), 'kids') !== false);
                $rate = $isKids ? 6000 : 4000;
                
                $trainerBasePay += ($rateRow->count * $rate);
                $completedLectures += $rateRow->count;
            }

            // 2. Count renewals
            $renewalsCount = 0;
            if ($tId) {
                $renewalsCount = \App\Models\Course::where('trainer_id', $tId)
                    ->where('renewed_with_trainer', true)
                    ->whereMonth('start_date', $month)
                    ->whereYear('start_date', $year)
                    ->get()
                    ->filter(function ($course) use ($tId) {
                        $studentIds = $course->students->pluck('id')->toArray();
                        if (empty($studentIds)) {
                            return false;
                        }
                        
                        $previousCourse = \App\Models\Course::whereHas('students', function ($query) use ($studentIds) {
                            $query->whereIn('students.id', $studentIds);
                        })
                        ->where('id', '!=', $course->id)
                        ->where('start_date', '<', $course->start_date)
                        ->orderBy('start_date', 'desc')
                        ->first();
                        
                        return $previousCourse && $previousCourse->trainer_id === $tId;
                    })
                    ->count();
            }

            $renewalTotal = 0;
            if ($renewalsCount >= 7) {
                $renewalTotal = 100000;
            } elseif ($renewalsCount >= 5) {
                $renewalTotal = 50000;
            }

            // 3. Calculate volume bonus
            $volumeBonus = 0;
            if ($completedLectures >= 80) {
                $volumeBonus = $volumeBonus80;
            } elseif ($completedLectures >= 60) {
                $volumeBonus = $volumeBonus60;
            }

            // 4. Calculate competition bonus
            $trainerCompetitionBonus = 0;
            if ($tId && $renewalsCount > 0) {
                $allRenewalsData = \App\Models\Course::where('renewed_with_trainer', true)
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
                
                if (in_array($tId, $top3TrainerIds)) {
                    $trainerCompetitionBonus = $competitionBonus;
                }
            }

            // 5. User admin salary
            $employeeBaseSalary = 0;
            if ($payroll->user && $payroll->user->base_salary) {
                $cleanBaseSalary = str_replace([',', ' '], '', $payroll->user->base_salary);
                $employeeBaseSalary = (float) $cleanBaseSalary;
                if ($employeeBaseSalary > 0 && $employeeBaseSalary < 1000) {
                    $employeeBaseSalary *= 1000;
                }
            }

            // Set the fields on the model
            $payroll->completed_lectures = $completedLectures;
            $payroll->base_pay = $trainerBasePay;
            $payroll->renewals_count = $renewalsCount;
            
            // Handle active/enabled bonuses
            $payroll->renewal_total = $renewalTotal;
            $payroll->volume_bonus = $volumeBonus;
            $payroll->competition_bonus = $trainerCompetitionBonus;

            // Calculate total pay using same logic as model
            $total = $trainerBasePay;
            
            $includeRenewal = $payroll->include_renewal_bonus !== null ? (bool) $payroll->include_renewal_bonus : ($renewalsCount > 0);
            $includeVolume = $payroll->include_volume_bonus !== null ? (bool) $payroll->include_volume_bonus : ($volumeBonus > 0);
            $includeCompetition = (bool) $payroll->include_competition_bonus;

            if ($includeRenewal && $renewalTotal > 0) {
                $total += $renewalTotal;
            }
            if ($payroll->selected_volume_bonus !== null && $payroll->selected_volume_bonus > 0) {
                $total += (float) $payroll->selected_volume_bonus;
            } elseif ($includeVolume && $volumeBonus > 0) {
                $total += $volumeBonus;
            }
            if ($includeCompetition && $trainerCompetitionBonus > 0) {
                $total += $trainerCompetitionBonus;
            }

            $total += ($payroll->bonus_deduction ?? 0);
            $total += $employeeBaseSalary;

            $payroll->total_pay = $total;

            return $payroll;
        });
    }
}
