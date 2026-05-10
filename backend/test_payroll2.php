<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

try {
    $req = Illuminate\Http\Request::create('/api/trainer-payroll/mark-paid', 'POST', [
        'trainer_id' => 1,
        'month' => 4,
        'year' => 2026
    ]);
    
    // Proper way to authenticate
    $user = \App\Models\User::where('role', 'admin')->first();
    auth()->login($user);
    $req->setUserResolver(function() use ($user) { return $user; });
    
    $res = $kernel->handle($req);
    echo "Status: " . $res->getStatusCode() . "\n";
    echo $res->getContent();
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage();
} catch (\Error $e) {
    echo "Error: " . $e->getMessage();
}
