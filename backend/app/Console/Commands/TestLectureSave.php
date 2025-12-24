<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Lecture;

class TestLectureSave extends Command
{
    protected $signature = 'test:lecture-save {lecture_id} {student_id} {activity}';
    protected $description = 'Test saving activity to lecture_students pivot';

    public function handle()
    {
        $lectureId = $this->argument('lecture_id');
        $studentId = $this->argument('student_id');
        $activity = $this->argument('activity');
        
        $lecture = Lecture::find($lectureId);
        
        if (!$lecture) {
            $this->error("Lecture not found");
            return 1;
        }
        
        $this->info("Testing lecture #{$lectureId} with student #{$studentId}");
        
        $pivotExists = $lecture->students()->where('student_id', $studentId)->exists();
        $this->info("Pivot exists: " . ($pivotExists ? 'yes' : 'no'));
        
        if ($pivotExists) {
            $lecture->students()->updateExistingPivot($studentId, ['activity' => $activity]);
            $this->info("Updated pivot with activity: {$activity}");
        } else {
            $lecture->students()->attach($studentId, ['attendance' => 'pending', 'activity' => $activity]);
            $this->info("Attached student with activity: {$activity}");
        }
        
        $fresh = $lecture->fresh()->students()->where('student_id', $studentId)->first();
        $this->info("Saved activity: " . ($fresh?->pivot->activity ?? 'null'));
        
        return 0;
    }
}
















