<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$total = App\Models\Lead::count();
$withAge = App\Models\Lead::whereNotNull("age")->count();
$withGov = App\Models\Lead::whereNotNull("governorate")->count();
$withTg = App\Models\Lead::whereNotNull("telegram_id")->count();

echo json_encode([
    "total" => $total,
    "with_age" => $withAge,
    "with_gov" => $withGov,
    "with_tg" => $withTg
]);

