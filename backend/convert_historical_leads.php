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
    $phoneRaw = trim($lead->phone_whatsapp ?? '');
    
    // Split the raw phone by newlines to extract the first line (the phone number)
    $lines = explode("\n", $phoneRaw);
    $phone = trim($lines[0]);
    
    // Clean the phone: remove any non-digit/non-plus characters and truncate to 20 chars
    $phone = preg_replace('/[^\+0-9]/', '', $phone);
    $phone = substr($phone, 0, 20);
    
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
        // If there are extra lines (notes) in the phone_whatsapp column, extract them
        $extraNotes = '';
        if (count($lines) > 1) {
            array_shift($lines);
            $extraNotes = trim(implode("\n", $lines));
        }

        $leadNotes = trim($lead->notes ?? '');
        $studentNotes = $leadNotes;
        if (!empty($extraNotes)) {
            $studentNotes = trim($studentNotes . "\n\n[ملاحظات إضافية من الاستمارة]:\n" . $extraNotes);
        }

        Student::create([
            'name' => $name,
            'phone' => $phone,
            'level' => $lead->level ?? 'L1',
            'lead_id' => $lead->id,
            'notes' => $studentNotes,
        ]);
        $converted++;
    } else {
        $skipped++;
    }
}

echo "Conversion complete: Converted $converted historical leads to students. Skipped $skipped (already exists or invalid).\n";
