<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use Illuminate\Support\Facades\DB;

echo "Starting to freeze student levels for existing courses...\n";

$courses = Course::with('students')->get();
$updatedCount = 0;

foreach ($courses as $course) {
    // For dual courses
    foreach ($course->students as $student) {
        if ($student->pivot && is_null($student->pivot->student_level)) {
            DB::table('course_students')
                ->where('course_id', $course->id)
                ->where('student_id', $student->id)
                ->update(['student_level' => $student->level]);
            $updatedCount++;
        }
    }
    
    // For single courses fallback on courses table
    if (is_null($course->student_level)) {
        if ($course->students->count() > 0) {
            $course->student_level = $course->students->first()->level;
            $course->save();
        } elseif ($course->student_id) {
            $student = App\Models\Student::find($course->student_id);
            if ($student) {
                $course->student_level = $student->level;
                $course->save();
            }
        }
    }
}

echo "Completed. Updated $updatedCount pivot records.\n";
