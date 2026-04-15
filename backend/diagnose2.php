<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = \App\Models\Course::all();
$hasDuplicates = false;
foreach ($courses as $c) {
    if ($c->lectures()->count() == 0) continue;
    $dates = [];
    foreach ($c->lectures as $l) {
        if ($l->date) {
            $d = $l->date->format('Y-m-d');
            if (isset($dates[$d])) {
                echo "DUPLICATE: Course " . $c->id . " Date: " . $d . " Lectures: " . $dates[$d] . " and " . $l->id . "\n";
                $hasDuplicates = true;
            }
            $dates[$d] = $l->id;
        }
    }
}
if (!$hasDuplicates) {
    echo "NO DUPLICATES FOUND IN THE ENTIRE DATABASE!\n";
}
