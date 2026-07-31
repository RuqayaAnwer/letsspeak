<?php

use App\Models\Course;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

echo "Starting rollback script for Google Sheet import on 2026-07-23...\n";

echo "Auto-detecting Google Sheet import minutes (database-agnostic)...\n";

// Load all courses with only id and created_at to group in PHP memory
$allCourses = Course::select('id', 'created_at')->get();
$grouped = [];
foreach ($allCourses as $c) {
    if ($c->created_at) {
        $minute = $c->created_at->format('Y-m-d H:i');
        $grouped[$minute][] = $c->id;
    }
}

$courseIdsToDelete = [];
echo "Detected bulk creation minutes (>100 courses/min):\n";
foreach ($grouped as $minute => $ids) {
    $count = count($ids);
    if ($count > 100) {
        echo "- Minute: $minute | Courses Count: $count\n";
        $courseIdsToDelete = array_merge($courseIdsToDelete, $ids);
    }
}

$totalCourses = count($courseIdsToDelete);
echo "Total courses to delete: $totalCourses\n";

if ($totalCourses === 0) {
    echo "No bulk imported courses detected to delete.\n";
    exit;
}

DB::beginTransaction();

try {
    // Delete payments
    $paymentsDeleted = Payment::whereIn('course_id', $courseIdsToDelete)->delete();
    echo "Deleted $paymentsDeleted payments.\n";

    // Delete lectures
    $lecturesDeleted = Lecture::whereIn('course_id', $courseIdsToDelete)->delete();
    echo "Deleted $lecturesDeleted lectures.\n";

    // Delete student pivot entries
    $pivotDeleted = DB::table('course_students')->whereIn('course_id', $courseIdsToDelete)->delete();
    echo "Deleted $pivotDeleted student course assignments.\n";

    // Delete courses
    $coursesDeleted = Course::whereIn('id', $courseIdsToDelete)->delete();
    echo "Deleted $coursesDeleted courses.\n";

    DB::commit();
    echo "\n=== ROLLBACK SUCCESSFULLY COMPLETED ===\n";
    echo "The database has been reverted to the state before the Google Sheet import.\n";

} catch (Exception $e) {
    DB::rollBack();
    echo "Error occurred during rollback: " . $e->getMessage() . "\n";
}
