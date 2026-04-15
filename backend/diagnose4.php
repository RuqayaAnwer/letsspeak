<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::find(9);
foreach ($course->lectures()->orderBy('lecture_number')->get() as $l) {
    echo "ID: " . $l->id . " Num: " . $l->lecture_number . " Date: " . ($l->date ? $l->date->format('Y-m-d') : 'null') . " Att: " . $l->attendance . "\n";
}
