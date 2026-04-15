<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::create([
    'title' => 'Test Cascade Reorder',
    'status' => 'pending',
    'lecture_days' => ['sun', 'tue'],
    'lecture_time' => '10:00:00',
    'start_date' => '2026-05-03', // Sunday
    'sessions_count' => 5,
    'lectures_count' => 5,
    'trainer_id' => 1
]);

for ($i=1; $i<=5; $i++) {
    \App\Models\Lecture::create([
        'course_id' => $course->id,
        'lecture_number' => $i,
        'date' => $i == 1 ? '2026-05-03' : ($i == 2 ? '2026-05-05' : ($i == 3 ? '2026-05-10' : ($i == 4 ? '2026-05-12' : '2026-05-17'))),
        'time' => $i == 3 ? '08:00:00' : '10:00:00', // L3 has an earlier time!
        'attendance' => 'pending',
        'is_completed' => false
    ]);
}

$lectures = $course->lectures()->get(); // relation includes ->orderBy('date')->orderBy('time')
$lec2 = $lectures->where('lecture_number', 2)->first();

echo "MOVING L2 TO DATE: 2026-05-10 (L3's date)\n";
$request = \Illuminate\Http\Request::create('/api/lectures/' . $lec2->id, 'PUT', ['date' => '2026-05-10']);
$request->setUserResolver(function() { return \App\Models\User::where('role', 'admin')->first(); });
$controller = app(\App\Http\Controllers\LectureController::class);
$controller->update($request, $lec2);

$lecturesAfter = $course->lectures()->get();
echo "\n--- AFTER (with existing bug) ---\n";
foreach($lecturesAfter as $l) {
    echo "L" . $l->lecture_number . " Date: " . $l->date->format('Y-m-d') . " Time: " . $l->time . "\n";
}

// Cleanup
foreach ($course->lectures as $l) $l->delete();
$course->delete();
