<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$l = \App\Models\Lecture::first();
var_dump($l->getAttributes()['is_completed'] ?? 'NOT IN DB');
