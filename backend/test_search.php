<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = Illuminate\Http\Request::create('/api/leads', 'GET', ['search' => '1', 'status' => 'all']);
$controller = new App\Http\Controllers\Api\LeadController();
$response = $controller->index($request);
echo $response->getContent();
