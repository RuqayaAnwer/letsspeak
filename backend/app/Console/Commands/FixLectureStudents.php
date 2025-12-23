<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Course;
use App\Models\Lecture;
use Illuminate\Support\Facades\DB;

class FixLectureStudents extends Command
{
    protected $signature = 'fix:lecture-students';
    protected $description = 'Create missing lecture_students records for dual courses';

    public function handle()
    {
        $this->info('Fixing lecture_students records...');
        
        // Get all courses with students
        $courses = Course::with('students')->get();
        
        $created = 0;
        
        foreach ($courses as $course) {
            $studentIds = $course->students->pluck('id')->toArray();
            
            if (empty($studentIds)) {
                continue;
            }
            
            $lectures = Lecture::where('course_id', $course->id)->get();
            
            foreach ($lectures as $lecture) {
                foreach ($studentIds as $studentId) {
                    $exists = DB::table('lecture_students')
                        ->where('lecture_id', $lecture->id)
                        ->where('student_id', $studentId)
                        ->exists();
                    
                    if (!$exists) {
                        $lecture->students()->attach($studentId, [
                            'attendance' => 'pending',
                        ]);
                        $created++;
                    }
                }
            }
        }
        
        $this->info("Created {$created} missing lecture_students records.");
        return Command::SUCCESS;
    }
}















