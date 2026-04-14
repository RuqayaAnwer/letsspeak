<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$users = \App\Models\User::where('name', 'undefined')->get();
if ($users->isEmpty()) {
    echo "No users named undefined.\n";
}
foreach ($users as $u) {
    echo "User ID: {$u->id}, Name: {$u->name}\n";
    // Fix it
    $u->name = "مستخدم " . $u->id;
    $u->save();
}

$trainers = \App\Models\Trainer::where('name', 'undefined')->get();
if ($trainers->isEmpty()) {
    echo "No trainers named undefined.\n";
}
foreach ($trainers as $t) {
    echo "Trainer ID: {$t->id}, Name: {$t->name}\n";
    // Fix it
    $t->name = null;
    $t->save();
}
