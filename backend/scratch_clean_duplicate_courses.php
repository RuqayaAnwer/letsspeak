<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

// We will find all duplicate courses where title, trainer_id, start_date and lecture_time are identical
$duplicateGroups = DB::table('courses')
    ->select('title', 'trainer_id', 'start_date', 'lecture_time', DB::raw('COUNT(*) as count'))
    ->groupBy('title', 'trainer_id', 'start_date', 'lecture_time')
    ->having('count', '>', 1)
    ->get();

echo "Found " . $duplicateGroups->count() . " groups of duplicate courses.\n\n";

$totalDeleted = 0;
$totalLecturesDeleted = 0;
$totalPaymentsDeleted = 0;

DB::beginTransaction();

try {
    foreach ($duplicateGroups as $group) {
        // Fetch all courses in this duplicate group sorted by ID ascending
        $courses = Course::where('title', $group->title)
            ->where('trainer_id', $group->trainer_id)
            ->where('start_date', $group->start_date)
            ->where('lecture_time', $group->lecture_time)
            ->orderBy('id', 'asc')
            ->get();
            
        // The first course in the group (lowest ID) is the original one. We keep it!
        $original = $courses->first();
        
        echo "Keeping original Course ID: {$original->id} | Title: {$original->title}\n";
        
        // The rest are duplicates. We delete them!
        $duplicates = $courses->slice(1);
        
        foreach ($duplicates as $dup) {
            // Delete associated lectures
            $lecturesCount = Lecture::where('course_id', $dup->id)->delete();
            $totalLecturesDeleted += $lecturesCount;
            
            // Delete associated payments
            $paymentsCount = Payment::where('course_id', $dup->id)->delete();
            $totalPaymentsDeleted += $paymentsCount;
            
            // Delete student pivot relations
            DB::table('course_students')->where('course_id', $dup->id)->delete();
            
            // Delete the course itself
            $dup->delete();
            $totalDeleted++;
            
            echo " - Deleted duplicate Course ID: {$dup->id} (Deleted $lecturesCount lectures and $paymentsCount payments)\n";
        }
    }
    
    DB::commit();
    echo "\nDatabase cleanup transaction COMMITTED successfully.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n--- CLEANUP SUMMARY ---\n";
echo "Total Duplicate Courses Deleted: $totalDeleted\n";
echo "Total Duplicate Lectures Deleted: $totalLecturesDeleted\n";
echo "Total Duplicate Payments Deleted: $totalPaymentsDeleted\n";
echo "=================================================\n";
