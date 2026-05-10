<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = \App\Models\User::whereNotNull('base_salary')->where('base_salary', '!=', '')->first();
if ($user) {
    echo "User Base Salary: '" . $user->base_salary . "'\n";
    echo "Type: " . gettype($user->base_salary) . "\n";

    $administrativeSalary = (float) ($user->base_salary ?? 0);
    echo "Admin Salary (float): " . $administrativeSalary . "\n";

    $basePay = 4000;
    $totalEarnings = $basePay + $administrativeSalary;
    echo "Total Earnings: " . $totalEarnings . "\n";
} else {
    echo "No users with base salary.\n";
}
