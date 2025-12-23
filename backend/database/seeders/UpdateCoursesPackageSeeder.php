<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\CoursePackage;
use Illuminate\Database\Seeder;

class UpdateCoursesPackageSeeder extends Seeder
{
    public function run(): void
    {
        $packages = CoursePackage::all();
        
        if ($packages->isEmpty()) {
            $this->command->info('No packages found. Please run CoursePackageSeeder first.');
            return;
        }

        $courses = Course::all();
        
        foreach ($courses as $i => $course) {
            // Assign package in rotation (بمزاجي, التوازن, السرعة)
            $package = $packages[$i % $packages->count()];
            $course->course_package_id = $package->id;
            $course->lectures_count = $package->lectures_count;
            $course->save();
        }

        $this->command->info("Updated {$courses->count()} courses with package assignments.");
    }
}




