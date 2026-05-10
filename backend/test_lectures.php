<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$completedLectures = \App\Models\Lecture::where(function ($query) {
      $query->whereIn('attendance', ['present', 'partially', 'absent'])
            ->orWhere('is_completed', true);
  })->get();

foreach ($completedLectures as $l) {
    echo "Lecture {$l->id} (Month: " . \Carbon\Carbon::parse($l->date)->month . ") (Course ID: {$l->course_id}) Status: {$l->trainer_payment_status}\n";
    $course = \App\Models\Course::find($l->course_id);
    if ($course) {
        echo "  Trainer ID: {$course->trainer_id}\n";
    }
}
