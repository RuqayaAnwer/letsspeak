<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Lecture;
use Carbon\Carbon;

$courses = Course::all();
$coursesUpdated = 0;
$lecturesUpdated = 0;

DB::beginTransaction();

try {
    foreach ($courses as $course) {
        $startDate = $course->start_date; // This is cast to Carbon in Course model casts
        if ($startDate && $startDate->year < 100) {
            $oldDateStr = $startDate->toDateString();
            $newYear = $startDate->year + 2000;
            $startDate->year = $newYear;
            
            $course->start_date = $startDate;
            
            // Also check actual_start_date
            if ($course->actual_start_date && $course->actual_start_date->year < 100) {
                $actDate = $course->actual_start_date;
                $actDate->year = $actDate->year + 2000;
                $course->actual_start_date = $actDate;
            }
            
            $course->save();
            $coursesUpdated++;
            
            echo "Course ID: {$course->id} | Title: {$course->title} | Updated start_date from '$oldDateStr' to '{$startDate->toDateString()}'\n";
            
            // Fix related lectures
            $lectures = Lecture::where('course_id', $course->id)->get();
            foreach ($lectures as $lec) {
                if ($lec->date) {
                    $lecDate = Carbon::parse($lec->date);
                    if ($lecDate->year < 100) {
                        $oldLecDate = $lecDate->toDateString();
                        $lecDate->year = $lecDate->year + 2000;
                        $lec->date = $lecDate->toDateString();
                        $lec->save();
                        $lecturesUpdated++;
                    }
                }
            }
        }
    }
    
    DB::commit();
    echo "\nDatabase transaction COMMITTED successfully.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n--- DATE CORRECTION SUMMARY ---\n";
echo "Total Courses Updated: $coursesUpdated\n";
echo "Total Lectures Updated: $lecturesUpdated\n";
echo "================================\n";
