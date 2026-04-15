<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::orderBy('id', 'desc')->first();
echo "TESTING ON COURSE: $course->id\n";
echo "Lecture Days: " . json_encode($course->lecture_days) . "\n";

$lectures = $course->lectures()->orderBy('lecture_number')->get();
$lec3 = $lectures[2]; // 3rd lecture
$lec4 = $lectures[3]; // 4th lecture

echo "BEFORE:\n";
echo "L3 Date: " . ($lec3->date ? $lec3->date->format('Y-m-d') : 'null') . "\n";
echo "L4 Date: " . ($lec4->date ? $lec4->date->format('Y-m-d') : 'null') . "\n";

// Mimic the PUT request to edit L3's date to L4's date
$targetDate = $lec4->date->format('Y-m-d');
echo "MOVING L3 TO DATE: $targetDate\n";

$request = \Illuminate\Http\Request::create('/api/lectures/' . $lec3->id, 'PUT', ['date' => $targetDate]);
$request->setUserResolver(function() { return \App\Models\User::where('role', 'admin')->first(); });

$controller = app(\App\Http\Controllers\LectureController::class);
$controller->update($request, $lec3);

$lecturesAfter = $course->lectures()->orderBy('lecture_number')->get();
echo "AFTER:\n";
foreach ($lecturesAfter as $l) {
    echo "L" . $l->lecture_number . " (" . $l->id . ") Date: " . ($l->date ? $l->date->format('Y-m-d') : 'null') . "\n";
}
