<?php

namespace App\Console\Commands;

use App\Models\Course;
use Illuminate\Console\Command;

class SyncCourseAmounts extends Command
{
    protected $signature = 'courses:sync-amounts';
    protected $description = 'Set amount_paid and total_amount for all courses from payments and package.';

    public function handle()
    {
        $courses = Course::with('coursePackage')->get();
        foreach ($courses as $course) {
            $paid = $course->payments()->sum('amount');
            $course->amount_paid = $paid;
            if ($course->total_amount === null && $course->coursePackage) {
                $course->total_amount = (float) $course->coursePackage->price;
            }
            $course->save();
        }
        $this->info('Synced ' . $courses->count() . ' courses.');
        return 0;
    }
}
