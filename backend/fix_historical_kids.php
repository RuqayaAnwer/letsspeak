<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Student;
use App\Models\CoursePackage;

echo "Starting historical kids data migration (Robust Version)...\n";

$kidsPackageIds = CoursePackage::where('name', 'like', '%اطفال%')
    ->orWhere('name', 'like', '%kids%')
    ->pluck('id')
    ->toArray();

echo "Kids Package IDs: " . implode(', ', $kidsPackageIds) . "\n";

// Loop through all courses
$courses = Course::with(['students', 'coursePackage'])->get();
$updatedCoursesCount = 0;
$updatedStudentsCount = 0;
$processedStudentIds = [];

foreach ($courses as $course) {
    $isKids = false;

    // Check direct attribute
    if ($course->is_kids) {
        $isKids = true;
    }

    // Check package ID
    if ($course->course_package_id && in_array($course->course_package_id, $kidsPackageIds)) {
        $isKids = true;
    }

    // Check package name
    if ($course->coursePackage && (
        str_contains(strtolower($course->coursePackage->name), 'اطفال') ||
        str_contains(strtolower($course->coursePackage->name), 'kids')
    )) {
        $isKids = true;
    }

    // Check course notes
    if ($course->notes && (
        str_contains(strtolower($course->notes), 'اطفال') ||
        str_contains(strtolower($course->notes), 'kids') ||
        str_contains(strtolower($course->notes), 'طفل')
    )) {
        $isKids = true;
    }

    // Check subscription source
    if ($course->subscription_source && (
        str_contains(strtolower($course->subscription_source), 'اطفال') ||
        str_contains(strtolower($course->subscription_source), 'kids')
    )) {
        $isKids = true;
    }

    // Check if any student in this course has is_child or child indicators
    foreach ($course->students as $student) {
        $studentNotes = strtolower($student->notes ?? '');
        $studentLevel = strtolower($student->level ?? '');
        $pivotLevel = strtolower($student->pivot->student_level ?? '');
        $studentName = strtolower($student->name ?? '');

        if (
            $student->is_child ||
            ($student->age !== null && $student->age < 16) ||
            ($student->lead && $student->lead->age !== null && $student->lead->age < 16) ||
            str_contains($studentNotes, 'اطفال') ||
            str_contains($studentNotes, 'kids') ||
            str_contains($studentNotes, 'طفل') ||
            str_contains($studentNotes, 'استمارة الاطفال') ||
            str_contains($studentLevel, 'اطفال') ||
            str_contains($studentLevel, 'kids') ||
            str_contains($pivotLevel, 'اطفال') ||
            str_contains($pivotLevel, 'kids') ||
            str_contains($studentName, 'اطفال') ||
            str_contains($studentName, 'kids')
        ) {
            $isKids = true;
        }
    }

    // If it's a kids course, update the course and all its students
    if ($isKids) {
        $changed = false;
        if (!$course->is_kids) {
            $course->is_kids = true;
            $course->save();
            $updatedCoursesCount++;
            $changed = true;
            echo "Updated Course ID {$course->id} (Trainer ID: {$course->trainer_id}) to is_kids = true\n";
        }

        foreach ($course->students as $student) {
            if (!$student->is_child) {
                $student->is_child = true;
                if ($student->age === null && $student->lead && $student->lead->age) {
                    $student->age = $student->lead->age;
                }
                $student->save();
                $changed = true;

                if (!in_array($student->id, $processedStudentIds)) {
                    $processedStudentIds[] = $student->id;
                    $updatedStudentsCount++;
                    echo "Updated Student ID {$student->id} ({$student->name}) to is_child = true\n";
                }
            }
        }
    }
}

echo "Migration finished! Updated {$updatedCoursesCount} courses and {$updatedStudentsCount} students.\n";
