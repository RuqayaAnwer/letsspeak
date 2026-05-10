<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

echo "Starting to process courses...\n";

// Get all students who have more than one course
$students = Student::whereHas('courses', function($q) {
}, '>', 1)->with(['courses' => function($q) {
    $q->orderBy('start_date', 'asc');
}])->get();

$updatedCount = 0;

foreach ($students as $student) {
    // Some courses might be dual, some single, but we track by student.
    // However, the renewal iteration is stored on the COURSE level.
    // Since dual courses share the same course_id, we just need to ensure the course's renewal_iteration is updated correctly.
    
    // We order by start_date asc, so the first one is iteration 1, second is iteration 2, etc.
    // However, what if a student has multiple courses?
    
    // Let's do it by student, but group by trainer?
    // Wait, in CourseController@store, the logic was:
    /*
        $lastCourse = Course::whereHas('students', function ($query) use ($studentIds) {
            $query->whereIn('students.id', $studentIds);
        })
        ->where('start_date', '<', $request->start_date)
        ->orderBy('start_date', 'desc')
        ->first();
        if ($lastCourse) {
            $renewalIteration = $lastCourse->renewal_iteration + 1;
        }
    */
    // This logic means if ANY of the students had a previous course (regardless of trainer), the iteration increments.
    
    $iteration = 1;
    foreach ($student->courses as $course) {
        // If the course already has a higher iteration from another student (e.g. dual course), keep the highest.
        $currentIteration = $course->renewal_iteration;
        if ($iteration > $currentIteration) {
            $course->renewal_iteration = $iteration;
            $course->save();
            $updatedCount++;
        } else {
            // If the course already had a higher iteration set by another student in a dual setup, we should adopt that higher iteration for our counter
            $iteration = $currentIteration;
        }
        $iteration++;
    }
}

echo "Completed. Updated {$updatedCount} courses.\n";
