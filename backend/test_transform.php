<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $courses = App\Models\Course::with(['lectures'])->get();
    foreach ($courses as $course) {
        $previousTrainerName = '-';
        $studentId = $course->student_id;
        
        if (!$studentId && $course->students->count() > 0) {
            $studentId = $course->students->first()->id;
        }
        
        if ($studentId) {
            $previousCourse = \App\Models\Course::where(function ($q) use ($studentId) {
                    $q->where('student_id', $studentId)
                      ->orWhereHas('students', function ($sq) use ($studentId) {
                          $sq->where('students.id', $studentId);
                      });
                })
                ->where('id', '<', $course->id)
                ->orderBy('id', 'desc')
                ->with('trainer.user')
                ->first();
            
            if ($previousCourse && $previousCourse->trainer) {
                $previousTrainerName = $previousCourse->trainer->user->name ?? $previousCourse->trainer->name;
            }
        }
        $course->previous_trainer_name = $previousTrainerName;
    }
    echo "Success for all " . $courses->count() . " courses!\n";
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
