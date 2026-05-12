<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $lead = \App\Models\Lead::latest()->first();
    if ($lead) {
        $controller = new \App\Http\Controllers\Api\LeadController();
        $response = $controller->convertToStudent($lead);
        echo $response->getContent();
    } else {
        echo "No leads found.";
    }
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
