<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$columns = Illuminate\Support\Facades\Schema::getColumns('trainer_payroll');
foreach ($columns as $c) {
    if (empty($c['nullable']) && $c['default'] === null && $c['name'] !== 'id') {
        echo "Strict Column: " . $c['name'] . "\n";
    }
}
