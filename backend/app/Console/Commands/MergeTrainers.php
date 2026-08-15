<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Trainer;
use App\Models\User;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\TrainerPayroll;
use App\Models\TrainerUnavailability;
use Illuminate\Support\Facades\DB;

class MergeTrainers extends Command
{
    protected $signature = 'trainers:merge {from_id : The ID of the duplicate trainer to merge from (will be deleted)} {to_id : The ID of the target trainer to merge into (will be kept)} {--dry-run : Preview the changes without modifying the database}';

    protected $description = 'Safely merge a duplicate trainer account into a primary trainer account';

    public function handle()
    {
        $fromId = $this->argument('from_id');
        $toId = $this->argument('to_id');
        $dryRun = $this->option('dry-run');

        if ($fromId == $toId) {
            $this->error("Cannot merge a trainer into themselves!");
            return Command::FAILURE;
        }

        // 1. Fetch both trainers
        $fromTrainer = Trainer::with('user')->find($fromId);
        $toTrainer = Trainer::with('user')->find($toId);

        if (!$fromTrainer) {
            $this->error("Source trainer (ID: $fromId) not found.");
            return Command::FAILURE;
        }

        if (!$toTrainer) {
            $this->error("Target trainer (ID: $toId) not found.");
            return Command::FAILURE;
        }

        $fromName = $fromTrainer->user ? $fromTrainer->user->name : 'N/A';
        $fromEmail = $fromTrainer->user ? $fromTrainer->user->email : 'N/A';
        $toName = $toTrainer->user ? $toTrainer->user->name : 'N/A';
        $toEmail = $toTrainer->user ? $toTrainer->user->email : 'N/A';

        $this->info("==================================================");
        $this->info($dryRun ? "DRY RUN - PREVIEWING MERGE PLAN:" : "MERGING TRAINERS:");
        $this->info("==================================================");
        $this->warn("MERGE FROM (Duplicate - Will be deleted):");
        $this->line("- Trainer ID: $fromId");
        $this->line("- Name: '$fromName'");
        $this->line("- Email: '$fromEmail'");
        $this->warn("MERGE INTO (Target - Will be kept):");
        $this->line("- Trainer ID: $toId");
        $this->line("- Name: '$toName'");
        $this->line("- Email: '$toEmail'");
        $this->info("==================================================");

        if (!$dryRun && !$this->confirm("Are you sure you want to proceed with this merge? This action CANNOT be undone!")) {
            $this->info("Merge cancelled.");
            return Command::SUCCESS;
        }

        try {
            DB::beginTransaction();

            // A. Update Courses
            $courseCount = Course::where('trainer_id', $fromId)->count();
            if ($courseCount > 0) {
                Course::where('trainer_id', $fromId)->update(['trainer_id' => $toId]);
                $this->info("Transferred $courseCount courses.");
            } else {
                $this->line("No courses to transfer.");
            }

            // B. Update Lectures
            $lectureCount = Lecture::where('trainer_id', $fromId)->count();
            if ($lectureCount > 0) {
                Lecture::where('trainer_id', $fromId)->update(['trainer_id' => $toId]);
                $this->info("Transferred $lectureCount lectures.");
            } else {
                $this->line("No lectures to transfer.");
            }

            // C. Merge Payroll records
            $payrolls = TrainerPayroll::where('trainer_id', $fromId)->get();
            $payrollMergedCount = 0;
            $payrollUpdatedCount = 0;

            foreach ($payrolls as $p) {
                // Check if target trainer already has a payroll record for the same month/year
                $existingPayroll = TrainerPayroll::where('trainer_id', $toId)
                    ->where('month', $p->month)
                    ->where('year', $p->year)
                    ->first();

                if ($existingPayroll) {
                    // Merge values
                    $existingPayroll->completed_lectures += $p->completed_lectures;
                    $existingPayroll->base_pay += $p->base_pay;
                    $existingPayroll->renewals_count += $p->renewals_count;
                    $existingPayroll->bonus_deduction += $p->bonus_deduction;
                    
                    $existingPayroll->notes = trim($existingPayroll->notes . " | Merged from duplicate Trainer ID $fromId (originally paid: " . $p->total_pay . " IQD)");
                    
                    $existingPayroll->recalculate();
                    $existingPayroll->save();

                    // Delete the duplicate's payroll record
                    $p->delete();
                    $payrollMergedCount++;
                } else {
                    // No existing record, simply update trainer_id and user_id to target
                    $p->trainer_id = $toId;
                    $p->user_id = $toTrainer->user_id;
                    $p->recalculate();
                    $p->save();
                    $payrollUpdatedCount++;
                }
            }

            if ($payrollMergedCount > 0 || $payrollUpdatedCount > 0) {
                $this->info("Payrolls: Merged $payrollMergedCount existing periods, updated $payrollUpdatedCount periods.");
            } else {
                $this->line("No payroll records to merge.");
            }

            // D. Unavailability records
            $fromUnavailability = TrainerUnavailability::where('trainer_id', $fromId)->first();
            if ($fromUnavailability) {
                $toUnavailability = TrainerUnavailability::where('trainer_id', $toId)->first();
                if ($toUnavailability) {
                    // Combine days if needed or just delete the duplicate's record
                    $mergedDays = array_unique(array_merge($toUnavailability->unavailable_days ?? [], $fromUnavailability->unavailable_days ?? []));
                    $toUnavailability->unavailable_days = $mergedDays;
                    $toUnavailability->notes = trim($toUnavailability->notes . " | Merged unavailability notes from duplicate: " . $fromUnavailability->notes);
                    $toUnavailability->save();

                    $fromUnavailability->delete();
                    $this->info("Merged unavailability records.");
                } else {
                    // Reassign
                    $fromUnavailability->trainer_id = $toId;
                    $fromUnavailability->save();
                    $this->info("Transferred unavailability record.");
                }
            }

            // E. Delete the duplicate Trainer and User records
            $fromTrainerUserId = $fromTrainer->user_id;
            
            // Delete Trainer profile
            $fromTrainer->delete();
            $this->info("Deleted Trainer Profile ID: $fromId.");

            // Delete User profile
            if ($fromTrainerUserId) {
                User::where('id', $fromTrainerUserId)->delete();
                $this->info("Deleted User Account ID: $fromTrainerUserId.");
            }

            if ($dryRun) {
                DB::rollBack();
                $this->warn("==================================================");
                $this->warn("DRY RUN ENABLED - Transaction rolled back safely.");
                $this->warn("==================================================");
            } else {
                DB::commit();
                $this->info("==================================================");
                $this->info("SUCCESS - Database transaction committed.");
                $this->info("==================================================");
            }

            return Command::SUCCESS;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("Merge failed due to an error: " . $e->getMessage());
            $this->line($e->getTraceAsString());
            return Command::FAILURE;
        }
    }
}
