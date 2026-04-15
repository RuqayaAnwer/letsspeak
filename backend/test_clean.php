<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Create a mock course, 3 lectures
$course = \App\Models\Course::create([
    'title' => 'Test Cascade Course',
    'trainer_id' => 1, 'status' => 'pending',
    'lecture_days' => ['sun', 'tue'],
    'lecture_time' => '10:00:00',
    'start_date' => '2026-05-03', // Sunday
    'sessions_count' => 5, 'lectures_count' => 5
]);

for ($i=1; $i<=5; $i++) {
    \App\Models\Lecture::create([
        'course_id' => $course->id,
        'lecture_number' => $i,
        'date' => $i == 1 ? '2026-05-03' : ($i == 2 ? '2026-05-05' : ($i == 3 ? '2026-05-10' : ($i == 4 ? '2026-05-12' : '2026-05-17'))),
        'attendance' => 'pending',
        'is_completed' => false
    ]);
}

$lectures = $course->lectures()->orderBy('lecture_number')->get();
echo "--- BEFORE ---\n";
foreach($lectures as $l) {
    echo "L" . $l->lecture_number . " (ID:" . $l->id . ") Date: " . $l->date->format('Y-m-d') . "\n";
}

// User action: Change L2 (2026-05-05) to L3's date (2026-05-10)
$lecToEdit = $lectures[1]; // L2
$targetDate = '2026-05-10';
echo "\n--- ACTION ---\n";
echo "Moving L" . $lecToEdit->lecture_number . " to " . $targetDate . "\n";

$request = \Illuminate\Http\Request::create('/api/lectures/' . $lecToEdit->id, 'PUT', ['date' => $targetDate]);
$request->setUserResolver(function() { return \App\Models\User::where('role', 'admin')->first(); });

$controller = app(\App\Http\Controllers\LectureController::class);
$controller->update($request, $lecToEdit);

$lecturesAfter = $course->lectures()->orderBy('lecture_number')->get();
echo "\n--- AFTER ---\n";
foreach($lecturesAfter as $l) {
    echo "L" . $l->lecture_number . " (ID:" . $l->id . ") Date: " . $l->date->format('Y-m-d') . "\n";
}

// Cleanup
foreach ($course->lectures as $l) $l->delete();
$course->delete();


