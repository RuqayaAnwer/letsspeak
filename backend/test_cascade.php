<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::first();
echo "Course ID: " . $course->id . "\n";
$lectures = $course->lectures()->orderBy('date')->orderBy('time')->orderBy('id')->get();
$lectureId = $lectures[0]->id;
$lecture = \App\Models\Lecture::find($lectureId);

// change date to match next lecture
if (count($lectures) > 1) {
    echo "Old Date 1: " . $lecture->date . "\n";
    $lecture->date = $lectures[1]->date;
    $lecture->save();
    echo "New Date 1: " . $lecture->date . "\n";
    echo "Date 2: " . $lectures[1]->date . "\n";
    
    $svc = app(\App\Services\LecturePostponementService::class);
    $svc->cascadeScheduleFrom($lecture);
    
    $lecturesAfter = $course->lectures()->orderBy('date')->orderBy('time')->orderBy('id')->get();
    echo "After Date 1: " . $lecturesAfter[0]->date . "\n";
    echo "After Date 2: " . $lecturesAfter[1]->date . "\n";
}
