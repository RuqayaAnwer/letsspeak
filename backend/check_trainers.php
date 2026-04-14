<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = \App\Models\Course::with('trainer.user')->get();
foreach ($courses as $c) {
    if (!$c->trainer) {
        echo "Course {$c->id} has NO trainer record (trainer_id: {$c->trainer_id})\n";
    } elseif (!$c->trainer->user) {
        echo "Course {$c->id} has Trainer {$c->trainer->id} but NO user record\n";
    } elseif (trim($c->trainer->name) == '') {
        echo "Course {$c->id} has Trainer {$c->trainer->id} user but empty name\n";
    }
}
echo "Done\n";
