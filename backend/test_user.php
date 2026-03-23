<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = \App\Models\User::first();
echo "First user: " . $user->name . " | Role: " . $user->role . " | Job Title: " . $user->job_title . "\n";

// Update the user to test the update logic
$user->job_title = "خدمة عملاء تقني / مدرب";
$user->base_salary = 400000;
$user->save();

echo "After save: " . $user->job_title . "\n";
