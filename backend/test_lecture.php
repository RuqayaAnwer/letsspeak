<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$lecture = \App\Models\Lecture::find(1986);
if ($lecture) {
    echo json_encode([
        'date' => $lecture->date,
        'today' => \Carbon\Carbon::today(),
        'canModify' => $lecture->canBeModifiedArray()
    ]);
} else {
    echo "Lecture not found";
}
