<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Lecture;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\LectureController;
use Illuminate\Http\Request;

try {
    DB::beginTransaction();
    // Use the lecture from previous test
    $lecture = Lecture::where('lecture_number', 1)->first();
    echo "ID: {$lecture->id}, Attendance: {$lecture->attendance}\n";

    $controller = app(LectureController::class);

    // 1. Postpone
    $request1 = Request::create('/api/lectures/' . $lecture->id . '/postpone', 'POST', [
        'new_date' => '2026-04-20',
        'postponed_by' => 'student',
        'force' => true
    ]);
    $response1 = $controller->postpone($request1, $lecture);
    echo "POSTPONE 1: " . $response1->getStatusCode() . "\n";
    $lecture->refresh();

    // 2. Cancel Postpone
    $request2 = Request::create('/api/lectures/' . $lecture->id . '/cancel-postponement', 'POST');
    $response2 = $controller->cancelPostponement($lecture);
    echo "CANCEL: " . $response2->getStatusCode() . "\n";
    $lecture->refresh();
    echo "AFTER CANCEL - Attendance: {$lecture->attendance}\n";

    // 3. Postpone again
    $lectureFresh = Lecture::find($lecture->id); // Simulate fresh fetch
    $request3 = Request::create('/api/lectures/' . $lectureFresh->id . '/postpone', 'POST', [
        'new_date' => '2026-04-20',
        'postponed_by' => 'student',
        'force' => true
    ]);
    
    // Simulate Laravel Route Model Binding
    $response3 = $controller->postpone($request3, $lectureFresh);
    echo "POSTPONE 2: " . $response3->getStatusCode() . "\n";
    echo "RESPONSE: " . $response3->getContent() . "\n";

    DB::rollBack();
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    DB::rollBack();
}
