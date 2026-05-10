<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$users = \App\Models\User::whereNotNull('base_salary')->where('base_salary', '!=', '')->get();
foreach($users as $u) {
    echo $u->id . ' -> ' . $u->base_salary . "\n";
}
