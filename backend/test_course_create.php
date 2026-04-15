<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$payload = [
    'trainer_id'=>1,
    'student_ids'=>[1],
    'course_package_id'=>1,
    'lectures_count'=>12,
    'start_date'=>'2026-04-16',
    'lecture_time'=>'10:00',
    'lecture_days'=>['mon','wed','fri'],
    'is_dual'=>false,
    'payment_method'=>'zain_cash',
    'is_custom'=>false,
    'paid_amount'=>0,
    'discount'=>0
];

$request = Illuminate\Http\Request::create('/api/courses', 'POST', $payload);
// Mock auth
$user = \App\Models\User::where('role', 'admin')->first();
if($user) {
    $request->setUserResolver(function () use ($user) {
        return $user;
    });
}
$response = $kernel->handle($request);
echo $response->getContent();
