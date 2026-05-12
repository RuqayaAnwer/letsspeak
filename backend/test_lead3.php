<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$leads = \App\Models\Lead::whereNotNull('assigned_level')->orWhereNotNull('current_level')->take(5)->get();
$data = [];
foreach ($leads as $l) {
    $data[] = [
        'id' => $l->id,
        'package_selected' => $l->package_selected,
        'current_level' => $l->current_level,
        'assigned_level' => $l->assigned_level
    ];
}
echo json_encode($data);
