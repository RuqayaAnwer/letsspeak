<?php

use App\Models\Course;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

echo "Starting duplicate courses cleanup script...\n";

// Get all courses with their students
$courses = Course::with('students')->get();

$grouped = [];
foreach ($courses as $c) {
    $studentIds = $c->students->pluck('id')->toArray();
    sort($studentIds);
    $studentKey = implode(',', $studentIds);
    // Group by trainer and student list
    $key = $c->trainer_id . '_' . $studentKey;
    $grouped[$key][] = $c;
}

$deletedCoursesCount = 0;
$deletedLecturesCount = 0;
$deletedPaymentsCount = 0;

DB::beginTransaction();

try {
    foreach ($grouped as $key => $list) {
        if (count($list) <= 1) {
            continue;
        }

        // Sort by id ascending so the first one created is first
        usort($list, fn($a, $b) => $a->id <=> $b->id);

        for ($i = 0; $i < count($list); $i++) {
            for ($j = $i + 1; $j < count($list); $j++) {
                $c1 = $list[$i];
                $c2 = $list[$j];

                if (!$c1->exists || !$c2->exists) {
                    continue;
                }

                // Check if they are duplicates: same start_date (within 7 days)
                $date1 = new DateTime($c1->start_date);
                $date2 = new DateTime($c2->start_date);
                $diffDays = abs($date1->diff($date2)->days);

                if ($diffDays <= 7) {
                    // Determine which one to keep and which to delete
                    $keep = $c1;
                    $delete = $c2;

                    // If one was imported on 2026-07-23 and the other was created earlier manually
                    $c1Imported = strpos($c1->created_at, '2026-07-23') !== false;
                    $c2Imported = strpos($c2->created_at, '2026-07-23') !== false;

                    if ($c1Imported && !$c2Imported) {
                        $keep = $c2;
                        $delete = $c1;
                    }

                    echo "Duplicate found: Course ID {$delete->id} (Created: {$delete->created_at}) is duplicate of Course ID {$keep->id} (Created: {$keep->created_at})\n";
                    echo " - Student(s): " . implode(', ', $delete->students->pluck('name')->toArray()) . "\n";
                    echo " - Start Dates: {$keep->start_date} vs {$delete->start_date}\n";

                    // Delete lectures of duplicate
                    $lecturesDeleted = Lecture::where('course_id', $delete->id)->delete();
                    $deletedLecturesCount += $lecturesDeleted;

                    // Delete payments of duplicate
                    $paymentsDeleted = Payment::where('course_id', $delete->id)->delete();
                    $deletedPaymentsCount += $paymentsDeleted;

                    // Delete course pivot relations
                    DB::table('course_students')->where('course_id', $delete->id)->delete();

                    // Delete course
                    $delete->delete();
                    $deletedCoursesCount++;

                    // Mark as deleted in our list
                    $delete->exists = false;
                }
            }
        }
    }

    DB::commit();
    echo "\n=== CLEANUP COMPLETED ===\n";
    echo "Total Duplicate Courses Deleted: $deletedCoursesCount\n";
    echo "Total Duplicate Lectures Deleted: $deletedLecturesCount\n";
    echo "Total Duplicate Payments Deleted: $deletedPaymentsCount\n";

} catch (Exception $e) {
    DB::rollBack();
    echo "Error occurred: " . $e->getMessage() . "\n";
}
