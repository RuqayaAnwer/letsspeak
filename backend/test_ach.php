<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $trainer = App\Models\Trainer::with('user')->find(4);
    $req = Illuminate\Http\Request::create('/api/trainer/achievements', 'GET');
    $req->merge(['period' => 'current']);
    $req->setUserResolver(function() use ($trainer) { return $trainer->user; });
    
    $res = app()->handle($req);
    echo $res->getContent();
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
