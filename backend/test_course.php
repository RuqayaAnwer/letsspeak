<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$req = Illuminate\Http\Request::create('/api/courses', 'POST', [
    'trainer_id' => 1,
    'is_custom' => true,
    'course_package_id' => null, 'custom_total_amount' => 150,
    'lectures_count' => 12,
    'start_date' => '2026-05-15',
    'lecture_time' => '15:00:00',
    'lecture_days' => ['sun', 'tue'],
    'is_dual' => false,
    'student_ids' => [1],
    'paid_amount' => 0,
    'remaining_amount' => 150,
    'previous_course_id' => 1
]);
try {
    app(App\Http\Controllers\CourseController::class)->store($req);
    echo "SUCCESS";
} catch (\Illuminate\Validation\ValidationException $e) {
    echo 'VALIDATION FAILED: ' . json_encode($e->errors(), JSON_UNESCAPED_UNICODE);
} catch (\Exception $e) {
    echo 'ERROR: ' . $e->getMessage();
}


