<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Student;
use App\Models\Lead;

echo "Starting smart fuzzy linking...\n";

$studentsToLink = Student::whereNull("lead_id")->get();
$allLeads = Lead::all();

$linked = 0;

foreach ($studentsToLink as $student) {
    $foundLead = null;
    $sPhone = preg_replace("/[^0-9]/", "", $student->phone);
    $sName = trim(strtolower($student->name));

    foreach ($allLeads as $lead) {
        // Try phone match
        $lPhone = preg_replace("/[^0-9]/", "", $lead->phone_whatsapp);
        
        // If both have at least 7 digits, compare the last 7 digits
        if (strlen($sPhone) >= 7 && strlen($lPhone) >= 7) {
            if (substr($sPhone, -7) === substr($lPhone, -7)) {
                $foundLead = $lead;
                break;
            }
        }
        
        // Try name match (if one contains the other)
        $lName = trim(strtolower($lead->name));
        if ($sName && $lName && (str_contains($sName, $lName) || str_contains($lName, $sName))) {
            // Additional check: maybe require lengths to be somewhat similar to avoid short names matching everything
            if (strlen($sName) > 4 && strlen($lName) > 4) {
                $foundLead = $lead;
                break;
            }
        }
    }

    if ($foundLead) {
        $student->lead_id = $foundLead->id;
        $student->save();
        $linked++;
        echo "Linked student {$student->name} to lead {$foundLead->name}\n";
    }
}

echo "Successfully linked $linked students out of " . count($studentsToLink) . ".\n";

