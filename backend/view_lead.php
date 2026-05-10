<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$lead = App\Models\Lead::where("name", "like", "%????????? ???? ????%")->first();
if ($lead) {
    echo "Lead: {$lead->name}\n";
    echo "Gov: " . json_encode($lead->governorate) . "\n";
    echo "Age: " . json_encode($lead->age) . "\n";
    echo "Telegram: " . json_encode($lead->telegram_id) . "\n";
    echo "Source: {$lead->source}\n";
    echo "Notes: {$lead->notes}\n";
} else {
    echo "Lead not found!\n";
}

