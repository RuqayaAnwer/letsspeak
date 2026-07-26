<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

$courses = Course::all();
$grouped = [];

foreach ($courses as $c) {
    // Normalize title: remove spaces, remove Arabic "كورس"
    $normalizedTitle = trim($c->title);
    $normalizedTitle = str_replace('كورس', '', $normalizedTitle);
    $normalizedTitle = preg_replace('/\s+/', '', $normalizedTitle);
    
    // Normalize date: just date part
    $datePart = $c->start_date ? substr($c->start_date, 0, 10) : '';
    
    // Key: Normalized Title + Trainer ID + Date Part
    $key = $normalizedTitle . '|' . $c->trainer_id . '|' . $datePart;
    
    if (!isset($grouped[$key])) {
        $grouped[$key] = [];
    }
    $grouped[$key][] = $c;
}

$totalDeleted = 0;
$totalLecturesDeleted = 0;
$totalPaymentsDeleted = 0;

DB::beginTransaction();

try {
    foreach ($grouped as $key => $courseGroup) {
        if (count($courseGroup) > 1) {
            // Keep the first course (lowest ID)
            usort($courseGroup, function($a, $b) {
                return $a->id <=> $b->id;
            });
            
            $original = $courseGroup[0];
            echo "Group: '$key' | Keeping ID: {$original->id} | Title: '{$original->title}'\n";
            
            // Delete the rest
            for ($i = 1; $i < count($courseGroup); $i++) {
                $dup = $courseGroup[$i];
                
                // Delete lectures
                $lecCount = Lecture::where('course_id', $dup->id)->delete();
                $totalLecturesDeleted += $lecCount;
                
                // Delete payments
                $payCount = Payment::where('course_id', $dup->id)->delete();
                $totalPaymentsDeleted += $payCount;
                
                // Delete student relations
                DB::table('course_students')->where('course_id', $dup->id)->delete();
                
                // Delete course
                $dup->delete();
                $totalDeleted++;
                
                echo " - Deleted duplicate ID: {$dup->id} | Title: '{$dup->title}' (Deleted $lecCount lectures, $payCount payments)\n";
            }
        }
    }
    
    DB::commit();
    echo "\nDatabase cleanup COMMITTED successfully.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n--- LOOSE CLEANUP SUMMARY ---\n";
echo "Total Duplicate Courses Deleted: $totalDeleted\n";
echo "Total Duplicate Lectures Deleted: $totalLecturesDeleted\n";
echo "Total Duplicate Payments Deleted: $totalPaymentsDeleted\n";
echo "=================================================\n";
