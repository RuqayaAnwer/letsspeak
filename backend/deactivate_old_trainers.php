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

Trainer::query()->update(['status' => 'active']);
User::where('role', 'trainer')->update(['status' => 'active']);
echo "All trainers and trainer users are now ACTIVE.\n";
