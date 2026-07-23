<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = Illuminate\Http\Request::create('/api/courses', 'GET', ['per_page' => 15]);
// Bind request to app instance to simulate auth user check
$user = App\Models\User::first(); // get a mock user
$request->setUserResolver(fn() => $user);

$response = Route::dispatch($request);
echo "Status: " . $response->getStatusCode() . "\n";
echo "Content length: " . strlen($response->getContent()) . "\n";
echo "Content: " . substr($response->getContent(), 0, 1000) . "\n";
?>
