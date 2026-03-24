<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::with('payments')->orderBy('id', 'desc')->first();

echo "Course ID: {$course->id}\n";
echo "Total Amount: {$course->total_amount}\n";
echo "Amount Paid (cached/calculated): {$course->amount_paid}\n";
echo "Payment Method (Course): {$course->payment_method}\n";
echo "Is Paid: " . ($course->total_amount == $course->amount_paid ? "Yes" : "No") . "\n";
echo "Extra Lectures Count: {$course->extra_lectures_count}\n";
echo "Extra Lectures Fee: {$course->extra_lectures_fee}\n";

echo "------- PAYMENTS -------\n";
foreach($course->payments as $payment) {
    echo "Payment ID: {$payment->id} | Amount: {$payment->amount} | Method: {$payment->payment_method} | Notes: {$payment->notes}\n";
}
