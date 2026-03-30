<?php
require __DIR__.'/backend/vendor/autoload.php';
$app = require_once __DIR__.'/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = App\Models\Course::with('students')->get();
$courseCount = 0;
foreach($courses as $course) {
    if ($course->students->count() > 0) {
        $studentIds = $course->students->pluck('id')->toArray();
        echo "Course ID {$course->id} has students: " . json_encode($studentIds) . "\n";
        $courseCount++;
    }
}
echo "Total mapped courses: $courseCount\n";
