<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Trainer;
use App\Models\ActivityLog;

$deletedTrainers = Trainer::whereNull('user_id')->get();
if ($deletedTrainers->isEmpty()) {
    echo "No orphaned trainers found.\n";
} else {
    foreach ($deletedTrainers as $trainer) {
        echo "Found orphaned trainer ID: {$trainer->id}\n";
        // Search activity logs for any mention of this trainer
        $logs = ActivityLog::where('description', 'LIKE', '%مدرب%')
            ->orWhere('description', 'LIKE', '%Trainer%')
            ->get();
        // Since we dropped 'name' from trainers, there is no place to save it on Trainer.
        // Wait, what columns are currently on Trainer?
    }
}
