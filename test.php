<?php
require __DIR__.'/backend/vendor/autoload.php';
$app = require_once __DIR__.'/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = App\Models\Course::with(['students'])->latest()->first();
echo json_encode($course, JSON_PRETTY_PRINT);
