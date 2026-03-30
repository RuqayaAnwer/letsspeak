<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$students = App\Models\Student::where('name', 'like', '%عبير%')->get();
if ($students->isEmpty()) { echo "Student not found\n"; exit; }
foreach ($students as $student) {
    echo "\n=== Student ID: " . $student->id . " Name: " . $student->name . " ===\n";
    echo json_encode($student->courses()->with('coursePackage', 'payments')->get()->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
