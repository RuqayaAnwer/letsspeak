<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class CleanDuplicateCourses extends Command
{
    protected $signature = 'courses:clean-duplicates {--commit : Run the deduplication and commit to the database}';

    protected $description = 'Safely merge duplicate courses under the same trainer without losing payments or attendance';

    public function handle()
    {
        $commit = $this->option('commit');
        $dryRun = !$commit;

        $this->info("==================================================");
        $this->info($dryRun ? "COURSE DEDUPLICATION DRY RUN:" : "RUNNING ACTIVE COURSE DEDUPLICATION:");
        $this->info("==================================================");

        // Find potential duplicate courses (same trainer, same title, same start date)
        // Group by title, trainer_id, start_date
        $groups = Course::select('title', 'trainer_id', 'start_date', DB::raw('COUNT(*) as count'))
            ->whereNotNull('trainer_id')
            ->groupBy('title', 'trainer_id', 'start_date')
            ->having('count', '>', 1)
            ->get();

        if ($groups->isEmpty()) {
            $this->info("No duplicate courses detected.");
            return Command::SUCCESS;
        }

        $this->info("Detected " . $groups->count() . " groups of duplicate courses.");
        $this->info("--------------------------------------------------");

        $totalMerged = 0;

        foreach ($groups as $g) {
            // Get all courses in this group
            $courses = Course::where('title', $g->title)
                ->where('trainer_id', $g->trainer_id)
                ->where('start_date', $g->start_date)
                ->orderBy('id', 'asc') // Keep the oldest (lowest ID)
                ->get();

            if ($courses->count() < 2) continue;

            $primary = $courses->first();
            $duplicates = $courses->slice(1);

            $trainerName = $primary->trainer && $primary->trainer->user ? $primary->trainer->user->name : 'N/A';
            $startDateStr = $g->start_date instanceof \Carbon\Carbon ? $g->start_date->format('Y-m-d') : substr($g->start_date, 0, 10);
            
            $this->comment("Group: '{$g->title}' for Trainer '{$trainerName}' (Start Date: {$startDateStr})");
            $this->line("  Primary Course to KEEP: ID {$primary->id} (Status: {$primary->status}, Payments count: " . $primary->payments()->count() . ")");

            foreach ($duplicates as $dup) {
                $this->line("  -> Will MERGE and DELETE: ID {$dup->id} (Status: {$dup->status}, Payments count: " . $dup->payments()->count() . ")");
            }

            if (!$dryRun) {
                try {
                    DB::transaction(function () use ($primary, $duplicates) {
                        foreach ($duplicates as $dup) {
                            $this->mergeCourses($dup, $primary);
                        }
                    });
                    $this->info("  [Success] Merged courses in this group.");
                } catch (\Exception $e) {
                    $this->error("  [Failed] Failed to merge courses: " . $e->getMessage());
                }
            }
            $totalMerged += $duplicates->count();
            $this->info("--------------------------------------------------");
        }

        if ($dryRun) {
            $this->warn("==================================================");
            $this->warn("DRY RUN SUMMARY: Found $totalMerged duplicate courses to merge.");
            $this->warn("To apply these changes, run the command with --commit:");
            $this->warn("  php artisan courses:clean-duplicates --commit");
            $this->warn("==================================================");
        } else {
            $this->info("==================================================");
            $this->info("COURSE DEDUPLICATION COMPLETED: Merged $totalMerged duplicate courses.");
            $this->info("==================================================");
        }

        return Command::SUCCESS;
    }

    private function mergeCourses($fromCourse, $toCourse)
    {
        $fromId = $fromCourse->id;
        $toId = $toCourse->id;

        // 1. Reassign Payments (prevent money/financial data loss)
        Payment::where('course_id', $fromId)->update(['course_id' => $toId]);

        // 2. Reassign/Merge Lectures (prevent attendance data loss)
        $fromLectures = Lecture::where('course_id', $fromId)->orderBy('lecture_number')->get();
        foreach ($fromLectures as $fl) {
            // Find corresponding lecture in target course
            $toLecture = Lecture::where('course_id', $toId)
                ->where('lecture_number', $fl->lecture_number)
                ->first();

            if ($toLecture) {
                // If target lecture is pending but duplicate has attendance, copy attendance
                if ($toLecture->attendance === 'pending' && $fl->attendance !== 'pending') {
                    $toLecture->attendance = $fl->attendance;
                    $toLecture->notes = trim($toLecture->notes . " | Attendance copied from merged duplicate course ID $fromId");
                    $toLecture->save();
                }
                $fl->delete();
            } else {
                // Reassign
                $fl->course_id = $toId;
                $fl->save();
            }
        }

        // 3. Delete student relations on duplicate
        DB::table('course_students')->where('course_id', $fromId)->delete();

        // 4. Delete the duplicate course record
        $fromCourse->delete();
    }
}
