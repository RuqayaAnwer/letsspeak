<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::find(9);
foreach ($course->lectures()->orderBy('lecture_number')->get() as $l) {
    echo "ID: " . $l->id . " Date: " . $l->created_at . "\n";
}
