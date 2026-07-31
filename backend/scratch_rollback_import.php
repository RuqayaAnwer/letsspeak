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

// Find all courses imported at 2026-07-23 13:42 and 13:43
$courses = Course::where(function($q) {
    $q->where('created_at', 'like', '2026-07-23 13:42%')
      ->orWhere('created_at', 'like', '2026-07-23 13:43%');
})->get();

$totalCourses = $courses->count();
echo "Found $totalCourses courses to delete.\n";

if ($totalCourses === 0) {
    echo "No courses found to delete.\n";
    exit;
}

$courseIds = $courses->pluck('id')->toArray();

DB::beginTransaction();

try {
    // Delete payments
    $paymentsDeleted = Payment::whereIn('course_id', $courseIds)->delete();
    echo "Deleted $paymentsDeleted payments.\n";

    // Delete lectures
    $lecturesDeleted = Lecture::whereIn('course_id', $courseIds)->delete();
    echo "Deleted $lecturesDeleted lectures.\n";

    // Delete student pivot entries
    $pivotDeleted = DB::table('course_students')->whereIn('course_id', $courseIds)->delete();
    echo "Deleted $pivotDeleted student course assignments.\n";

    // Delete courses
    $coursesDeleted = Course::whereIn('id', $courseIds)->delete();
    echo "Deleted $coursesDeleted courses.\n";

    DB::commit();
    echo "\n=== ROLLBACK SUCCESSFULLY COMPLETED ===\n";
    echo "The database has been reverted to the state before the Google Sheet import.\n";

} catch (Exception $e) {
    DB::rollBack();
    echo "Error occurred during rollback: " . $e->getMessage() . "\n";
}
