<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$columns = Illuminate\Support\Facades\Schema::getColumns('lectures');
foreach ($columns as $c) {
    echo $c['name'] . " (" . $c['type_name'] . ")\n";
}

