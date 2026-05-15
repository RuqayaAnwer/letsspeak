<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = \App\Models\Course::withCount('lectures')->withCount(['lectures as completed_lectures' => function ($query) {
    $query->whereIn('attendance', ['present', 'partially', 'absent']);
}])->where('status', 'active')->get();

foreach ($courses as $course) {
    $total = $course->lectures_count;
    if ($total == 0) continue;
    $percentage = round(($course->completed_lectures / $total) * 100);
    if ($percentage > 70 && $percentage < 100) {
        echo "Course ID: " . $course->id . " | Total: $total | Completed: " . $course->completed_lectures . " | Percentage: $percentage%\n";
        
        // Count postponed
        $postponed = \App\Models\Lecture::where('course_id', $course->id)->where('attendance', 'postponed')->count();
        echo "  - Postponed: $postponed\n";
    }
}
