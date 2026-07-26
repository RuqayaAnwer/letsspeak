<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$uniqueYears = DB::table('courses')
    ->select(DB::raw('DISTINCT strftime("%Y", start_date) as year'))
    ->get();

echo "Unique start_date years in courses table:\n";
foreach ($uniqueYears as $y) {
    echo "- Year: '" . ($y->year ?? 'NULL') . "'\n";
}

$sampleCourses = DB::table('courses')
    ->select('id', 'title', 'start_date')
    ->take(10)
    ->get();

echo "\nSample courses:\n";
foreach ($sampleCourses as $c) {
    echo "- ID: {$c->id} | Title: '{$c->title}' | Raw start_date: '{$c->start_date}'\n";
}
