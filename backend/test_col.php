<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$schema = \Illuminate\Support\Facades\Schema::hasColumn('lectures', 'is_completed');
var_dump("hasColumn is_completed: " . ($schema ? 'yes' : 'no'));
