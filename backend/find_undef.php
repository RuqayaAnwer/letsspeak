<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$trainers = \App\Models\Trainer::with('user')->get();
foreach ($trainers as $t) {
    if (strtolower($t->name) === 'undefined' || ($t->user && strtolower($t->user->name) === 'undefined')) {
        echo "ID: {$t->id}, Trainer Name: {$t->name}, User Name: " . ($t->user ? $t->user->name : 'N/A') . "\n";
    }
}
echo "Done checking.\n";
