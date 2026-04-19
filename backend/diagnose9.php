<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Lecture;
$lectures = Lecture::select('id', 'lecture_number', 'attendance', 'date', 'makeup_for')->take(50)->get();
foreach ($lectures as $l) {
    echo "ID: {$l->id} (Num {$l->lecture_number}) - Att: {$l->attendance} - MakeupFor: {$l->makeup_for} - IsComp: " . ($l->isCompleted() ? '1' : '0') . "\n";
}
