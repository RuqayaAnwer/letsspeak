<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Lead;
use App\Models\Student;

$leads = Lead::all();
$converted = 0;
$skipped = 0;

foreach ($leads as $lead) {
    $phone = trim($lead->phone);
    $name = trim($lead->name);

    if (empty($phone) || empty($name)) {
        $skipped++;
        continue;
    }

    // Check if student already exists (by name and phone)
    $exists = Student::where('phone', $phone)
        ->where('name', $name)
        ->exists();

    if (!$exists) {
        Student::create([
            'name' => $name,
            'phone' => $phone,
            'level' => $lead->level ?? 'L1',
            'lead_id' => $lead->id,
            'notes' => $lead->notes,
        ]);
        $converted++;
    } else {
        $skipped++;
    }
}

echo "Conversion complete: Converted $converted historical leads to students. Skipped $skipped (already exists or invalid).\n";
