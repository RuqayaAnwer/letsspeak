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
        'title' => 'Test Postpone Course',
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

    echo "--- INITIAL SCHEDULE ---\n";
    foreach ($course->lectures()->orderBy('lecture_number')->get() as $l) {
        echo "L{$l->lecture_number} - {$l->date}\n";
    }

    $service = app(LecturePostponementService::class);
    $lectureToPostpone = $course->lectures()->where('lecture_number', 1)->first();
    
    // Postpone the first lecture to the second lecture's date
    $newDate = $dates[1];

    echo "\n--- POSTPONING L1 -> {$newDate} ---\n";
    // Using $force = true to override trainer conflicts
    $result = $service->postpone($lectureToPostpone, $newDate, '10:00', 'student', 'Test', null, true);
    
    if (!$result['success']) {
        echo "FAILED: " . print_r($result, true) . "\n";
    } else {
        echo "Success\n";
    }

    echo "\n--- SCHEDULE AFTER ONE POSTPONEMENT ---\n";
    foreach ($course->lectures()->orderBy('date')->get() as $l) {
        echo "L{$l->lecture_number} (Makup? {$l->is_makeup}) - {$l->date} - {$l->attendance}\n";
    }

    // Now postpone the SECOND lecture (which is now L2 on the NEXT date)
    $lectureToPostpone2 = $course->lectures()->where('lecture_number', 2)->first();
    $newDate2 = $course->lectures()->where('lecture_number', 3)->first()->date;
    echo "\n--- POSTPONING L2 -> {$newDate2} ---\n";
    $result2 = $service->postpone($lectureToPostpone2, $newDate2, '10:00', 'student', 'Test2', null, true);
    
    echo "\n--- SCHEDULE AFTER TWO POSTPONEMENTS ---\n";
    foreach ($course->lectures()->orderBy('date')->get() as $l) {
        echo "L{$l->lecture_number} (Makup? {$l->is_makeup}) - {$l->date} - {$l->attendance}\n";
    }

    DB::rollBack();
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    DB::rollBack();
}
