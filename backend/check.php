<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$count = App\Models\Lead::where("status", "new")->whereNotNull("trainer_name")->count();
echo "Leads with trainer: $count\n";

