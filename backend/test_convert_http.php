<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$lead = \App\Models\Lead::latest()->first();
if ($lead) {
    $request = Illuminate\Http\Request::create('/api/leads/' . $lead->id . '/convert', 'POST');
    $controller = new App\Http\Controllers\Api\LeadController();
    try {
        $response = $controller->convertToStudent($lead);
        echo "Status: " . $response->status() . "\n";
        echo $response->getContent();
    } catch (\Exception $e) {
        echo "Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString();
    }
}
