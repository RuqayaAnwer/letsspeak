<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$req = \Illuminate\Http\Request::create('/api/webhooks/leads', 'POST', [
    'api_token' => 'letspeak_secure_link_12345',
    'phone_whatsapp' => '07701234567',
    'name' => 'John Doe',
    'gender' => 'ذكر'
]);
$controller = app()->make('\App\Http\Controllers\Api\PublicWebhooksController');
try {
    $res = $controller->storeLead($req);
    echo "SUCCESS:\n";
    echo $res->getContent();
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n" . $e->getFile() . " on line " . $e->getLine();
}
