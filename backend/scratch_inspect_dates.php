<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use Carbon\Carbon;

$courses = Course::select('id', 'title', 'start_date')->get();

$years = [];
foreach ($courses as $c) {
    if ($c->start_date) {
        $year = Carbon::parse($c->start_date)->year;
        $years[$year] = ($years[$year] ?? 0) + 1;
    } else {
        $years['NULL'] = ($years['NULL'] ?? 0) + 1;
    }
}

echo "Unique start_date years in courses table:\n";
foreach ($years as $yr => $count) {
    echo "- Year: '$yr' | Count: $count\n";
}

echo "\nSample courses:\n";
foreach ($courses->take(15) as $c) {
    echo "- ID: {$c->id} | Title: '{$c->title}' | Raw start_date: '{$c->getRawOriginal('start_date')}'\n";
}
