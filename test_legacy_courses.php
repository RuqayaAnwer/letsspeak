<?php
require __DIR__.'/backend/vendor/autoload.php';
$app = require_once __DIR__.'/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = App\Models\Course::with('students')->get();
$mappedCount = 0;
$legacyCount = 0;
$hasStudentIdColumn = \Schema::hasColumn('courses', 'student_id');

echo "Has student_id column: " . ($hasStudentIdColumn ? "Yes" : "No") . "\n";

foreach($courses as $course) {
    if ($course->students->count() > 0) {
        $mappedCount++;
    } else {
        if ($hasStudentIdColumn && !empty($course->student_id)) {
            echo "Legacy Course ID {$course->id} has raw student_id: {$course->student_id}\n";
            $legacyCount++;
        }
    }
}
echo "Total mapped via pivot: $mappedCount\n";
echo "Total legacy via column: $legacyCount\n";
