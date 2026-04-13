<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$request = Illuminate\Http\Request::create('/api/trainers', 'POST', [
    'name' => 'Test PHP',
    'phone' => '12345678',
    'job_title' => '',
    'base_salary' => ''
]);

$controller = app(App\Http\Controllers\TrainerController::class);
try {
    $response = $controller->store($request);
    echo $response->getContent();
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
