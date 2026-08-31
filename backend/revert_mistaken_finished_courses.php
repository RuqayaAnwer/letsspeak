<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use Carbon\Carbon;

$today = Carbon::today()->toDateString();
echo "Reverting mistakenly finished courses...\n";

// Find finished courses updated today where generated lectures count is less than required lectures_count
$finishedCourses = Course::where('status', 'finished')
    ->whereDate('updated_at', $today)
    ->get();

$revertedCount = 0;
foreach ($finishedCourses as $course) {
    $lecturesCount = $course->lectures()->count();
    if ($lecturesCount < $course->lectures_count) {
        echo "Reverting Course ID: {$course->id} (Title: {$course->title}) - Lectures in DB: {$lecturesCount}/{$course->lectures_count}\n";
        $course->status = 'active';
        $course->finished_at = null;
        $course->save();
        $revertedCount++;
    }
}

echo "Total reverted courses: $revertedCount\n";
