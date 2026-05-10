<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Trainer;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\TrainerPayroll;
use Carbon\Carbon;

$month = 5;
$year = 2026;

$startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth()->format('Y-m-d');
$endDate = Carbon::createFromDate($year, $month, 1)->endOfMonth()->format('Y-m-d');

$trainers = Trainer::where('status', 'active')->get();

$allRenewalsData = Course::where('renewed_with_trainer', true)
    ->whereMonth('start_date', $month)
    ->whereYear('start_date', $year)
    ->get()
    ->groupBy('trainer_id')
    ->map(function ($courses) {
        return $courses->filter(function ($course) {
            $studentIds = $course->students->pluck('id')->toArray();
            if (empty($studentIds)) return false;
            
            $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                $query->whereIn('students.id', $studentIds);
            })
            ->where('id', '!=', $course->id)
            ->where('start_date', '<', $course->start_date)
            ->orderBy('start_date', 'desc')
            ->first();
            
            if ($previousCourse) {
                return $previousCourse->trainer_id === $course->trainer_id;
            }
            return false;
        })->count();
    })
    ->toArray();

arsort($allRenewalsData);
$top3TrainersIds = array_slice(array_keys($allRenewalsData), 0, 3);

$bonuses = [
    'renewal' => [
        'level_5' => [],
        'level_7' => [],
    ],
    'competition' => [],
    'volume' => [
        'level_60' => [],
        'level_80' => [],
    ],
    'manual' => []
];

foreach ($trainers as $trainer) {
    $trainerId = $trainer->id;
    $trainerName = $trainer->name;
    
    $renewalsCount = $allRenewalsData[$trainerId] ?? 0;
    
    // Competition
    if ($renewalsCount > 0 && in_array($trainerId, $top3TrainersIds)) {
        $bonuses['competition'][] = [
            'trainer_id' => $trainerId,
            'trainer_name' => $trainerName,
            'count' => $renewalsCount,
            'amount' => 20000
        ];
    }
    
    // Renewal
    if ($renewalsCount >= 7) {
        $bonuses['renewal']['level_7'][] = [
            'trainer_id' => $trainerId,
            'trainer_name' => $trainerName,
            'count' => $renewalsCount,
            'amount' => 100000
        ];
    } elseif ($renewalsCount >= 5) {
        $bonuses['renewal']['level_5'][] = [
            'trainer_id' => $trainerId,
            'trainer_name' => $trainerName,
            'count' => $renewalsCount,
            'amount' => 50000
        ];
    }
    
    // Volume
    $completedLectures = Lecture::whereHas('course', function ($query) use ($trainerId) {
            $query->where('trainer_id', $trainerId);
        })
        ->whereBetween('date', [$startDate, $endDate])
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
        
    if ($completedLectures >= 80) {
        $bonuses['volume']['level_80'][] = [
            'trainer_id' => $trainerId,
            'trainer_name' => $trainerName,
            'count' => $completedLectures,
            'amount' => 80000
        ];
    } elseif ($completedLectures >= 60) {
        $bonuses['volume']['level_60'][] = [
            'trainer_id' => $trainerId,
            'trainer_name' => $trainerName,
            'count' => $completedLectures,
            'amount' => 30000
        ];
    }
    
    // Manual
    $payroll = TrainerPayroll::where('trainer_id', $trainerId)
        ->where('month', $month)
        ->where('year', $year)
        ->first();
        
    if ($payroll && $payroll->bonus_deduction > 0) {
        $bonuses['manual'][] = [
            'trainer_id' => $trainerId,
            'trainer_name' => $trainerName,
            'amount' => $payroll->bonus_deduction,
            'notes' => $payroll->bonus_deduction_notes
        ];
    }
}

echo json_encode($bonuses, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
