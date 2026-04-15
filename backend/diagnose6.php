<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = \App\Models\Course::orderBy('id', 'desc')->take(3)->get();
foreach ($courses as $c) {
    echo "Course: " . $c->id . " Days: " . json_encode($c->lecture_days) . "\n";
}
