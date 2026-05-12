<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = Illuminate\Http\Request::create('/api/leads', 'GET', ['page' => '1', 'status' => 'all', 'search' => '']);
$controller = new App\Http\Controllers\Api\LeadController();
try {
    $response = $controller->index($request);
    echo "Status: " . $response->status() . "\n";
    echo $response->getContent();
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
