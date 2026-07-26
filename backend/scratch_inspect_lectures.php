<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Inspect lectures table columns
$columns = Schema::getColumnListing('lectures');
echo "Columns in 'lectures' table:\n" . implode(', ', $columns) . "\n\n";

// Get sample lectures with raw dates
$samples = DB::table('lectures')
    ->select('id', 'course_id', 'date', 'attendance')
    ->take(15)
    ->get();

echo "Sample lectures:\n";
foreach ($samples as $s) {
    echo "- ID: {$s->id} | Course ID: {$s->course_id} | Raw Date: '{$s->date}' | Attendance: '{$s->attendance}'\n";
}

// Let's count lectures grouped by date year
$years = DB::table('lectures')
    ->select(DB::raw('SUBSTRING(date, 1, 4) as year_part'), DB::raw('COUNT(*) as count'))
    ->groupBy('year_part')
    ->get();

echo "\nLecture counts by year part:\n";
foreach ($years as $y) {
    echo "- Year Part: '" . ($y->year_part ?? 'NULL') . "' | Count: {$y->count}\n";
}
