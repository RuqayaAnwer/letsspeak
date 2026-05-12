<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$leads = \App\Models\Lead::whereNotNull('assigned_level')->orWhereNotNull('current_level')->take(5)->get();
echo json_encode($leads);
