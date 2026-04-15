<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$min = \App\Models\Lecture::min('lecture_number');
echo "Global MIN lecture_number: " . $min . "\n";

$zeroLectures = \App\Models\Lecture::where('lecture_number', 0)->count();
echo "Total lectures with number 0: " . $zeroLectures . "\n";
