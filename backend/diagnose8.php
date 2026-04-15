<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::find(12);
if ($course) {
    foreach($course->lectures()->orderBy('id')->get() as $l) {
        echo $l->lecture_number . ' - ';
    }
}
