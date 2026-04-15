<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$request = Illuminate\Http\Request::create('/api/trainers/available-monthly', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode([
    'week_days' => [0, 2],
    'dates' => ['2026-05-03', '2026-05-05'],
    'time' => '10:00',
    'min_days_count' => 1
]));
$controller = app(App\Http\Controllers\TrainerController::class);
try {
    $response = $controller->availableMonthly($request);
    echo $response->getContent();
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
