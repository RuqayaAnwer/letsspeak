<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = \Illuminate\Http\Request::create('/api/lectures/703', 'PUT', ['date' => '2026-03-04']);
$request->setUserResolver(function() {
    return \App\Models\User::where('role', 'admin')->first(); // simulate the exact user
});


$course = \App\Models\Course::with('lectures')->has('lectures', '>', 3)->first();
$lectures = $course->lectures()->orderBy('date')->get();

$lecture = $lectures[1]; // target 2nd lecture
echo "Selected Course: " . $course->id . "\n";
echo "Selected Lecture: " . $lecture->id . "\n";
echo "Current Date: " . $lecture->date->format('Y-m-d') . "\n";

$targetDate = $lectures[2]->date->format('Y-m-d'); // user said they picked the date of the next lecture!
echo "Target Date (Next lecture's date): " . $targetDate . "\n";

$request = \Illuminate\Http\Request::create('/api/lectures/' . $lecture->id, 'PUT', ['date' => $targetDate]);
$request->setUserResolver(function() {
    return \App\Models\User::where('role', 'admin')->first();
});

// Call the update method directly
$controller = app(\App\Http\Controllers\LectureController::class);
$response = $controller->update($request, $lecture);

echo "Response status: " . $response->getStatusCode() . "\n";
$responseContent = json_decode($response->getContent(), true);
if (isset($responseContent['date'])) {
    echo "Updated Date in response: " . $responseContent['date'] . "\n";
} else {
    echo "Message: " . ($responseContent['message'] ?? 'None') . "\n";
}

$lecturesAfter = $course->lectures()->orderBy('date')->get();
echo "\\nDates BEFORE request:\\n"; foreach ($lectures as $l) { echo " - ID: " . $l->id . " Date: " . $l->date->format('Y-m-d') . "\n"; } echo "\\nDates after request:\\n";
foreach ($lecturesAfter as $l) {
    echo " - ID: " . $l->id . " Date: " . $l->date->format('Y-m-d') . "\n";
}
