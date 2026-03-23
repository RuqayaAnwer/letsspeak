<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class WipeDummyData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'wipe:dummy';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Wipe completely specific dummy users and their related data';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Starting clean up of dummy data...");
        Schema::disableForeignKeyConstraints();

        $namesToDelete = ['sdfg', 'محمد علي', 'sara'];

        foreach ($namesToDelete as $name) {
            // Delete associated Trainers and courses
            $trainers = \App\Models\Trainer::where('name', 'like', "%{$name}%")->get();
            foreach($trainers as $trainer) {
                $courses = \App\Models\Course::where('trainer_id', $trainer->id)->get();
                foreach($courses as $course) {
                    \App\Models\Lecture::where('course_id', $course->id)->delete();
                    \App\Models\Payment::where('course_id', $course->id)->delete();
                    $course->delete();
                }
                DB::table('trainer_unavailability')->where('trainer_id', $trainer->id)->delete();
                DB::table('trainer_payroll')->where('trainer_id', $trainer->id)->delete();
                $trainerName = $trainer->name;
                $trainer->delete();
                $this->info("Deleted Trainer & all linked courses/payments: {$trainerName}");
            }
            
            // Delete associated Users
            $users = \App\Models\User::where('name', 'like', "%{$name}%")->get();
            foreach($users as $user) {
                DB::table('trainer_payroll')->where('user_id', $user->id)->delete();
                DB::table('activity_logs')->where('user_id', $user->id)->delete();
                $userName = $user->name;
                $user->delete();
                $this->info("Deleted User: {$userName}");
            }
        }

        Schema::enableForeignKeyConstraints();
        $this->info("Wipe Complete! All specified dummy users and their data have been obliterated.");
    }
}
