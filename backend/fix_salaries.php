<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$users = \App\Models\User::whereNotNull('base_salary')->get();
$fixed = 0;
foreach($users as $user) {
    $salary = (float) str_replace([',', ' '], '', $user->base_salary);
    if ($salary > 0 && $salary < 1000) {
        $user->base_salary = (string) ($salary * 1000);
        $user->save();
        $fixed++;
        echo "Fixed user {$user->id} salary from {$salary} to {$user->base_salary}\n";
    }
}
echo "Total fixed: $fixed\n";
