<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Course;
use App\Models\Lecture;
use App\Services\LecturePostponementService;
use Carbon\Carbon;

try {
    // 1. Get a course with lectures
    $course = Course::with(['lectures' => function($q) { $q->orderBy('lecture_number'); }])->first();
    if (!$course) {
        echo "No courses found.\n";
        exit;
    }
    
    echo "--- INITIAL SCHEDULE ---\n";
    foreach ($course->lectures as $l) {
        echo "Lecture {$l->lecture_number} (ID {$l->id}) - Date: {$l->date} - Status: {$l->attendance}\n";
    }

    $service = app(LecturePostponementService::class);
    $lectureToPostpone = $course->lectures()->where('attendance', 'pending')->first();
    
    // Choose a date 1 week in advance
    $newDate = Carbon::parse($lectureToPostpone->date)->addDays(7)->format('Y-m-d');

    echo "\n--- POSTPONING LECTURE 1 -> {$newDate} ---\n";
    $result = $service->postpone($lectureToPostpone, $newDate, '10:00', 'student', 'Test Postpone', null, true);
    
    if (!$result['success']) {
        echo "FAILED TO POSTPONE: " . $result['message'] . "\n";
    } else {
        echo "Success: " . $result['message'] . "\n";
    }

    $course->refresh();
    $lectures = $course->lectures()->orderBy('lecture_number')->get();
    echo "\n--- SCHEDULE AFTER POSTPONEMENT ---\n";
    foreach ($lectures as $l) {
        echo "Lecture {$l->lecture_number} (ID {$l->id}) - Date: {$l->date} - Status: {$l->attendance} - is_makeup: {$l->is_makeup}\n";
    }

} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
