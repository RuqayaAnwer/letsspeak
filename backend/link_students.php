<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$students = App\Models\Student::whereNull("lead_id")->get();
$linked = 0;
foreach($students as $student) {
    // try to find by phone
    $lead = App\Models\Lead::where("phone_whatsapp", $student->phone)->first();
    if(!$lead) {
        // try to find by name
        $lead = App\Models\Lead::where("name", $student->name)->first();
    }
    
    if($lead) {
        $student->lead_id = $lead->id;
        $student->save();
        $linked++;
        echo "Linked: {$student->name} -> Lead ID: {$lead->id}\n";
    } else {
        echo "NOT FOUND: {$student->name}\n";
    }
}
echo "Total linked: $linked\n";

