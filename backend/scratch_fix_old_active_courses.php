<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Lecture;
use Carbon\Carbon;

$thresholdDate = Carbon::now()->subMonths(3)->toDateString();

$oldActive = Course::where('status', 'active')
    ->where('start_date', '<', $thresholdDate)
    ->get();

echo "Analyzing and correcting " . $oldActive->count() . " old active courses (started before $thresholdDate):\n\n";

$toFinished = 0;
$toCancelled = 0;

DB::beginTransaction();

try {
    foreach ($oldActive as $course) {
        $paid = floatval($course->amount_paid);
        $total = floatval($course->total_amount);
        
        $oldStatus = $course->status;
        
        // If fully paid or nearly fully paid (difference less than 1000 dinars)
        if ($paid >= $total || abs($paid - $total) < 1000) {
            $course->status = 'finished';
            $course->save();
            $toFinished++;
            
            // Mark all lectures as attended
            Lecture::where('course_id', $course->id)->update([
                'attendance' => 'present'
            ]);
            
            echo "Course ID: {$course->id} | Title: {$course->title} | Paid: $paid / Total: $total => Updated to FINISHED\n";
        } else {
            $course->status = 'cancelled';
            $course->save();
            $toCancelled++;
            
            echo "Course ID: {$course->id} | Title: {$course->title} | Paid: $paid / Total: $total => Updated to CANCELLED\n";
        }
    }
    
    DB::commit();
    echo "\nDatabase transaction COMMITTED successfully.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\nSummary of corrections:\n";
echo "Total processed: " . $oldActive->count() . "\n";
echo "Updated to Finished (Paid): $toFinished\n";
echo "Updated to Cancelled (Unpaid/Incomplete): $toCancelled\n";
echo "=================================================\n";
