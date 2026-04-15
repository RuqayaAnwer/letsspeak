<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$lecture = \App\Models\Lecture::first();
echo "Lecture date format: " . $lecture->date . "\n";
$newDate = "2026-03-03";
var_dump($lecture->date !== $newDate);
