<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $request = Illuminate\Http\Request::create('/api/students/undefined/notes', 'POST', [
        'note' => 'test note',
        'type' => 'strength'
    ]);
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
}
