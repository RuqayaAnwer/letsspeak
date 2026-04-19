<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Course;
use App\Models\Trainer;
use App\Services\LecturePostponementService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

try {
    DB::beginTransaction();

    // Create a dummy course
    $course = Course::create([
        'title' => 'Test Cancellations Course',
        'trainer_id' => Trainer::first()->id,
        'course_package_id' => 1,
        'lectures_count' => 4,
        'start_date' => Carbon::today()->format('Y-m-d'),
        'status' => 'planned',
        'lecture_days' => ['mon', 'wed'],
        'lecture_time' => '10:00',
    ]);

    // Create 4 lectures
    $dates = [
        Carbon::parse('next monday')->format('Y-m-d'),
        Carbon::parse('next wednesday')->format('Y-m-d'),
        Carbon::parse('next monday')->addWeek()->format('Y-m-d'),
        Carbon::parse('next wednesday')->addWeek()->format('Y-m-d'),
    ];

    foreach ($dates as $i => $date) {
        $course->lectures()->create([
            'lecture_number' => $i + 1,
            'date' => $date,
            'time' => '10:00',
            'attendance' => 'pending'
        ]);
    }

    $service = app(LecturePostponementService::class);
    $lectureToPostpone = $course->lectures()->where('lecture_number', 1)->first();
    
    echo "--- 1. FIRST POSTPONEMENT ---\n";
    $newDate = $dates[1];
    $result = $service->postpone($lectureToPostpone, $newDate, '10:00', 'student', 'Test', null, true);
    
    if (!$result['success']) {
        echo "FAILED: " . print_r($result, true) . "\n";
    } else {
        echo "Success\n";
    }

    $lectureToPostpone->refresh();

    echo "\n--- 2. CANCEL POSTPONEMENT ---\n";
    $cancelResult = $service->cancelPostponement($lectureToPostpone);
    
    if (!$cancelResult['success']) {
        echo "FAILED TO CANCEL: " . print_r($cancelResult, true) . "\n";
    } else {
        echo "Success\n";
    }

    $lectureToPostpone->refresh();
    echo "\n--- LECTURE STATE AFTER CANCELLATION ---\n";
    echo "Attendance: " . $lectureToPostpone->attendance . "\n";
    echo "is_completed (attribute): " . ($lectureToPostpone->is_completed ? 'true' : 'false') . "\n";
    echo "isCompleted() method: " . ($lectureToPostpone->isCompleted() ? 'true' : 'false') . "\n";
    echo "isPostponed() method: " . ($lectureToPostpone->isPostponed() ? 'true' : 'false') . "\n";
    echo "canBePostponed() method: " . ($lectureToPostpone->canBePostponed() ? 'true' : 'false') . "\n";

    echo "\n--- 3. SECOND POSTPONEMENT ---\n";
    $result2 = $service->postpone($lectureToPostpone, $newDate, '10:00', 'student', 'Test', null, true);
    
    if (!$result2['success']) {
        echo "FAILED: " . print_r($result2, true) . "\n";
    } else {
        echo "Success\n";
    }

    DB::rollBack();
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    DB::rollBack();
}
