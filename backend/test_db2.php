<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$result = DB::select("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'");
echo json_encode($result);
