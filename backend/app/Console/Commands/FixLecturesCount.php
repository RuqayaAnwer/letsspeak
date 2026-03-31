<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Course;
use Illuminate\Support\Facades\DB;

class FixLecturesCount extends Command
{
    protected $signature = 'database:fix-lectures-count';
    protected $description = 'Fix lectures_count for existing courses that were artificially inflated by postponements';

    public function handle()
    {
        $this->info("Starting lectures_count fix...");

        // We will just recount all lectures that are NOT makeups, NOT explicit extras.
        // Wait, NO. lectures_count is supposed to represent original package count + ANY explicitly purchased extra lectures.
        // Or simply: base package count + sum(extra_lectures count).
        // Since extra lectures logic uses `extra_lectures_count` (if it exists) or adds to `lectures_count`.
        
        $courses = Course::with('coursePackage', 'lectures')->get();
        $fixedCount = 0;

        foreach ($courses as $course) {
            $originalCount = $course->lectures_count;
            
            // Calculate what lectures_count SHOULD be.
            // It should be the total number of physical lectures in this course MINUS the number of makeup lectures.
            // Because each makeup lecture was artificially adding +1 to lectures_count.
            
            $numOfMakeups = $course->lectures()->where('is_makeup', true)->count();
            $totalPhysicalLectures = $course->lectures()->count();
            
            // The true intended lectures_count based on physical structures:
            // Since every makeup inflated it by 1, the true count is Total - Makeups.
            // But wait, what if lectures_count was manually set or something?
            // Actually, if we just set it to (Total Physical rows - makeups), that exactly reverses the bug!
            $expectedCount = max(0, $totalPhysicalLectures - $numOfMakeups);
            
            if ($originalCount != $expectedCount) {
                $this->info("Course ID {$course->id}: lectures_count $originalCount -> $expectedCount");
                $course->lectures_count = $expectedCount;
                $course->save();
                $fixedCount++;
            }
        }

        $this->info("Fixed $fixedCount courses.");
    }
}
