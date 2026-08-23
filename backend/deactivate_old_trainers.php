<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Trainer;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

$courseThreshold = '2026-05-23'; // Last 3 months
$creationThreshold = Carbon::now()->subDays(30);

$trainers = Trainer::with('user')->get();

echo "Starting deactivation of old/inactive trainers...\n";
echo "Total trainers in DB: " . $trainers->count() . "\n";

$deactivatedCount = 0;

DB::beginTransaction();

try {
    foreach ($trainers as $trainer) {
        $trainerName = $trainer->user ? $trainer->user->name : ($trainer->name ?? 'Trainer ID ' . $trainer->id);

        // Skip if already inactive
        if ($trainer->status === 'inactive') {
            continue;
        }

        // Check if created recently (in last 30 days)
        if ($trainer->created_at && $trainer->created_at->gt($creationThreshold)) {
            echo "Trainer '{$trainerName}' was created recently ({$trainer->created_at->toDateString()}). Keeping ACTIVE.\n";
            continue;
        }

        // Check if they have courses in the last 3 months
        $hasRecentCourse = $trainer->courses()
            ->where('start_date', '>=', $courseThreshold)
            ->exists();

        if (!$hasRecentCourse) {
            // Deactivate
            $trainer->status = 'inactive';
            $trainer->save();

            if ($trainer->user) {
                $trainer->user->status = 'inactive';
                $trainer->user->save();
            }

            echo "Deactivated trainer: '{$trainerName}' (No recent courses since $courseThreshold)\n";
            $deactivatedCount++;
        }
    }

    DB::commit();
    echo "\nDeactivation complete. Deactivated $deactivatedCount trainers.\n";
    echo "Remaining active trainers: " . Trainer::where('status', 'active')->count() . "\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "Error during deactivation: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
