<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::orderBy('id', 'desc')->first();
if (!$course) { echo "No course found."; exit; }

$request = Request::create("/api/courses/{$course->id}/add-extra-lectures", 'POST', ['count' => 2, 'fee' => 1000]);
$request->setUserResolver(function () { return \App\Models\User::where('role', 'admin')->first(); });

// Fake auth
Auth::login(\App\Models\User::where('role', 'admin')->first());

$lastLecture = $course->lectures()->orderBy('date', 'desc')->orderBy('time', 'desc')->first();
echo "ACTUAL LAST LECTURE DATE via Query: " . ($lastLecture ? $lastLecture->date : 'NULL') . "\n";
echo "ALL DATES DESCENDING:\n";
foreach($course->lectures()->orderBy('date', 'desc')->get() as $l) {
    echo $l->date . "\n";
}

$controller = $app->make(\App\Http\Controllers\CourseController::class);
$controller->addExtraLectures($request, $course);

$course->refresh();
echo "Course ID: {$course->id}\n";
echo "Course Start Date: {$course->start_date}\n";
echo "Lectures:\n";
foreach($course->lectures()->orderBy('id')->get() as $l) {
    echo "ID: {$l->id} | Num: {$l->lecture_number} | Date: {$l->date} | Extra: " . ($l->is_extra ? 'Yes' : 'No') . "\n";
}
