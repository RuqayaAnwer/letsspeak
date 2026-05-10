<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

try {
    $request = Illuminate\Http\Request::create('/api/students', 'GET');
    $user = App\Models\User::find(1);
    $request->setUserResolver(function () use ($user) {
        return $user;
    });
    Auth::login($user);
    
    $response = $kernel->handle($request);
    echo "Status: " . $response->getStatusCode() . "\n";
    echo $response->getContent();
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage();
} catch (\Error $e) {
    echo "Error: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
