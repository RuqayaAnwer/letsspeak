<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = \App\Models\Course::orderBy('id', 'desc')->take(3)->get();
foreach ($courses as $course) {
    echo "Course: " . $course->id . "\n";
    $lectures = $course->lectures()->orderBy('lecture_number')->get();
    foreach ($lectures as $l) {
        $dateStr = $l->date ? $l->date->format('Y-m-d') : 'null';
        echo "L" . $l->lecture_number . " (ID:" . $l->id . ") Date: " . $dateStr . " Att: " . $l->attendance . " Comp: " . ($l->is_completed ? '1' : '0') . "\n";
    }
}
