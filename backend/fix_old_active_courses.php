<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

$thresholdDate = Carbon::now()->subMonths(4)->toDateString();

$oldActiveCourses = Course::where('status', 'active')
    ->where('start_date', '<', $thresholdDate)
    ->get();

echo "Found " . $oldActiveCourses->count() . " active courses older than 4 months (started before $thresholdDate).\n";

if ($oldActiveCourses->count() > 0) {
    DB::beginTransaction();
    try {
        foreach ($oldActiveCourses as $course) {
            $course->status = 'finished';
            $course->finished_at = Carbon::now();
            $course->save();
            echo "Updated Course ID: {$course->id} (Start: {$course->start_date->toDateString()}) to finished.\n";
        }
        DB::commit();
        echo "Successfully updated all old active courses in the database.\n";
    } catch (\Exception $e) {
        DB::rollBack();
        echo "Error updating old active courses: " . $e->getMessage() . "\n";
    }
} else {
    echo "No historical active courses need updating.\n";
}
