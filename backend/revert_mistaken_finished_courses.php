<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;

echo "Reverting ALL courses auto-closed by the script...\n";

// Find finished courses where finished_at is set to end of day time
$finishedCourses = Course::where('status', 'finished')
    ->where('finished_at', 'like', '%23:59:59%')
    ->get();

$revertedCount = 0;
foreach ($finishedCourses as $course) {
    echo "Reverting Course ID: {$course->id} (Title: {$course->title})\n";
    $course->status = 'active';
    $course->finished_at = null;
    $course->save();
    $revertedCount++;
}

echo "Total reverted courses: $revertedCount\n";
