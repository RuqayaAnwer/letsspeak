<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

echo "Columns in lectures table:\n";
print_r(Illuminate\Support\Facades\Schema::getColumnListing('lectures'));

echo "\nColumns in trainer_payrolls table:\n";
print_r(Illuminate\Support\Facades\Schema::getColumnListing('trainer_payrolls'));
