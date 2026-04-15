<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$columns = \Illuminate\Support\Facades\Schema::getColumnListing('courses');
print_r($columns);
