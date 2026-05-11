<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = Illuminate\Http\Request::create('/api/courses', 'POST', [
    'trainer_id' => 1,
    'student_ids' => [1],
    'lectures_count' => 10,
    'start_date' => '2026-06-01',
    'lecture_time' => '10:00',
    'lecture_days' => ['sun'],
    'course_package_id' => 1,
    'previous_course_id' => 1,
    'student_levels' => [1 => 'L5']
]);

try {
    $controller = app()->make(App\Http\Controllers\CourseController::class);
    $response = $controller->store($request);
    echo $response->getContent();
} catch (\Throwable $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n" . $e->getTraceAsString();
}
