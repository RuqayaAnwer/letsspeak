<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$student = App\Models\Student::whereNotNull("lead_id")->count();
$total = App\Models\Student::count();
echo "Students with lead_id: $student / $total\n";

// check if there is any lead_id column at all
$first = App\Models\Student::first();
echo "First student lead_id: " . ($first->lead_id ?? "NULL") . "\n";

