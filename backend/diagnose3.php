<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = \App\Models\Course::all();
foreach ($courses as $c) {
    if ($c->lectures()->count() == 0) continue;
    $dates = [];
    foreach ($c->lectures()->orderBy('lecture_number')->get() as $l) {
        if ($l->date) {
            $d = $l->date->format('Y-m-d');
            if (isset($dates[$d])) {
                echo "Course " . $c->id . " Date " . $d . " has lectures: L" . $l->lecture_number . " (ID:" . $l->id . ") AND L" . $dates[$d]['number'] . " (ID:" . $dates[$d]['id'] . ")\n";
            }
            $dates[$d] = ['number' => $l->lecture_number, 'id' => $l->id];
        }
    }
}
