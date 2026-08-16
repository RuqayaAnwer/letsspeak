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

class AutoMergeTrainers extends Command
{
    protected $signature = 'trainers:auto-merge {--commit : Run the merge and commit to the database}';

    protected $description = 'Automatically detect and merge all duplicate trainer accounts in the database';

    // Same translation dictionary as in import_google_sheet_v2.php to find matches
    protected array $arabicEnglishMap = [
        'mohammed' => 'محمد احمد',
        'mohamed' => 'محمد احمد',
        'mohammad' => 'محمد احمد',
        'fatima' => 'فاطمه علي',
        'fatimah' => 'فاطمه علي',
        'ali' => 'علي حسن',
        'ahmed' => 'احمد محمد',
        'ahmad' => 'احمد محمد',
        'sara' => 'ساره علي',
        'sarah' => 'ساره علي',
        'farah' => 'فرح',
        'batool' => 'بتول',
        'batoul' => 'بتول',
        'wisam' => 'وسام',
        'raghad' => 'رغد',
        'israa' => 'اسراء',
        'zhoor' => 'زهور',
        'mustafa' => 'مصطفي',
        'hasan' => 'حسن',
        'baraa' => 'براء',
        'ibtisam' => 'ابتسام',
        'noran' => 'نوران',
        'mais' => 'ميس',
        'aisha' => 'عائشه',
        'baneen' => 'بنين',
        'manar' => 'منار',
        'hussein' => 'حسين',
        'haider' => 'حيدر',
        'areej' => 'اريج',
        'taha' => 'طه',
        'dalia' => 'داليا',
        'tabark' => 'تبارك',
        'noor' => 'نور',
        'rand' => 'رند',
        'anaam' => 'انعام',
        'ibtihal' => 'ابتهال',
        'ghadeer' => 'غدير',
        'yusur' => 'يسر',
        'aya' => 'آيه',
        'amina' => 'امينه',
        'dhay' => 'ضي ميثم',
        'dhay_short' => 'ضي',
        'ayat falah' => 'ايات فلاح',
        'ayat' => 'ايات فلاح'
    ];

    public function handle()
    {
        $commit = $this->option('commit');
        $dryRun = !$commit;

        $this->info("==================================================");
        $this->info($dryRun ? "AUTO-MERGE DRY RUN (Previewing matches):" : "RUNNING ACTIVE AUTO-MERGE:");
        $this->info("==================================================");

        // Fetch all trainers with their users
        $trainers = Trainer::with('user')->get();

        if ($trainers->isEmpty()) {
            $this->warn("No trainers found in the database.");
            return Command::SUCCESS;
        }

        // 1. Group trainers into sets of duplicates using Union-Find
        $parent = [];
        foreach ($trainers as $t) {
            $parent[$t->id] = $t->id;
        }

        $find = function ($id) use (&$parent, &$find) {
            if ($parent[$id] === $id) {
                return $id;
            }
            return $parent[$id] = $find($parent[$id]);
        };

        $union = function ($id1, $id2) use (&$parent, $find) {
            $root1 = $find($id1);
            $root2 = $find($id2);
            if ($root1 !== $root2) {
                $parent[$root2] = $root1;
            }
        };

        // Compare all pairs to find duplicates
        for ($i = 0; $i < $trainers->count(); $i++) {
            for ($j = $i + 1; $j < $trainers->count(); $j++) {
                $t1 = $trainers[$i];
                $t2 = $trainers[$j];

                if (!$t1->user || !$t2->user) continue;

                if ($this->areDuplicates($t1, $t2)) {
                    $union($t1->id, $t2->id);
                }
            }
        }

        // 2. Gather groups of duplicates
        $groups = [];
        foreach ($trainers as $t) {
            $root = $find($t->id);
            $groups[$root][] = $t;
        }

        // Filter groups that have actual duplicates (size > 1)
        $duplicateGroups = array_filter($groups, function ($g) {
            return count($g) > 1;
        });

        if (empty($duplicateGroups)) {
            $this->info("No duplicate trainers detected.");
            return Command::SUCCESS;
        }

        $this->info("Detected " . count($duplicateGroups) . " groups of duplicate trainers.");
        $this->info("--------------------------------------------------");

        $totalMerged = 0;

        foreach ($duplicateGroups as $rootId => $group) {
            // Rank the group to choose the primary account (the one to keep)
            // Criteria:
            // 1. Has active courses (+1000)
            // 2. Has total courses (+100)
            // 3. Lowest ID (created first manually) (+10)
            // 4. English name preferred if manual (+5)
            
            // We always prefer keeping the account with the lowest ID (the oldest manually created account)
            // so that trainer login credentials and history are preserved.
            usort($group, function ($a, $b) {
                return $a->id - $b->id;
            });

            $primary = $group[0];
            $duplicates = array_slice($group, 1);

            $primaryName = $primary->user ? $primary->user->name : 'N/A';
            $primaryEmail = $primary->user ? $primary->user->email : 'N/A';
            $primaryCourses = Course::where('trainer_id', $primary->id)->count();

            $this->comment("Group Primary to KEEP: '{$primaryName}' (ID: {$primary->id}, Email: {$primaryEmail}, Courses: {$primaryCourses})");

            foreach ($duplicates as $dup) {
                $dupName = $dup->user ? $dup->user->name : 'N/A';
                $dupEmail = $dup->user ? $dup->user->email : 'N/A';
                $dupCourses = Course::where('trainer_id', $dup->id)->count();

                $this->line("  -> Will MERGE and DELETE: '{$dupName}' (ID: {$dup->id}, Email: {$dupEmail}, Courses: {$dupCourses})");
            }

            if (!$dryRun) {
                // Execute merge in transaction
                try {
                    DB::transaction(function () use ($primary, $duplicates) {
                        foreach ($duplicates as $dup) {
                            $this->executeMerge($dup, $primary);
                        }
                    });
                    $this->info("  [Success] Merged group successfully.");
                } catch (\Exception $e) {
                    $this->error("  [Failed] Failed to merge group: " . $e->getMessage());
                }
            }
            $totalMerged += count($duplicates);
            $this->info("--------------------------------------------------");
        }

        if ($dryRun) {
            $this->warn("==================================================");
            $this->warn("DRY RUN SUMMARY: Found $totalMerged duplicate accounts to merge.");
            $this->warn("To apply these changes, run the command with --commit:");
            $this->warn("  php artisan trainers:auto-merge --commit");
            $this->warn("==================================================");
        } else {
            $this->info("==================================================");
            $this->info("AUTO-MERGE COMPLETED: Successfully merged $totalMerged duplicate accounts.");
            $this->info("==================================================");
        }

        return Command::SUCCESS;
    }

    /**
     * Check if two trainer records are potential duplicates
     */
    private function areDuplicates($t1, $t2): bool
    {
        $n1 = $this->normalizeName($t1->user->name);
        $n2 = $this->normalizeName($t2->user->name);

        // 1. Exact normalized name match
        if ($n1 === $n2) {
            return true;
        }

        // 2. Email prefixes matching (ignoring dots and domains)
        $email1 = strstr($t1->user->email, '@', true) ?: '';
        $email2 = strstr($t2->user->email, '@', true) ?: '';
        $cleanEmail1 = str_replace('.', '', strtolower($email1));
        $cleanEmail2 = str_replace('.', '', strtolower($email2));

        if (!empty($cleanEmail1) && $cleanEmail1 === $cleanEmail2) {
            return true;
        }

        // 3. Cross-language translations mapping (using our dictionary)
        foreach ($this->arabicEnglishMap as $en => $ar) {
            // Strip any suffix like _alias or _short to support multiple mappings (e.g., dhay_short)
            $cleanEnKey = explode('_', $en)[0];
            $cleanEn = $this->normalizeName($cleanEnKey);
            $cleanAr = $this->normalizeName($ar);

            if (($n1 === $cleanEn && $n2 === $cleanAr) || ($n1 === $cleanAr && $n2 === $cleanEn)) {
                return true;
            }
        }



        return false;
    }

    /**
     * Normalize name for comparison
     */
    private function normalizeName($name): string
    {
        $name = trim($name);
        $name = mb_strtolower($name);
        $name = str_replace(['أ', 'إ', 'آ'], 'ا', $name);
        $name = str_replace('ة', 'ه', $name);
        $name = str_replace('ى', 'ي', $name);
        $name = str_replace([' ', '-', '_'], '', $name);
        return $name;
    }

    /**
     * Rank trainer accounts to pick the best one to keep
     */
    private function getRankScore($trainer): int
    {
        $score = 0;

        // Has active courses
        $activeCourses = Course::where('trainer_id', $trainer->id)->where('status', 'active')->count();
        if ($activeCourses > 0) {
            $score += 1000;
        }

        // Has any courses
        $totalCourses = Course::where('trainer_id', $trainer->id)->count();
        if ($totalCourses > 0) {
            $score += 100;
        }

        // Check if name is English (English names manually entered preferred)
        $name = $trainer->user ? $trainer->user->name : '';
        if (preg_match('/^[a-zA-Z\s\.]+$/', $name)) {
            $score += 10;
        }

        return $score;
    }

    /**
     * Execute database changes to merge one trainer into another
     */
    private function executeMerge($fromTrainer, $toTrainer)
    {
        $fromId = $fromTrainer->id;
        $toId = $toTrainer->id;

        // 1. Reassign courses
        Course::where('trainer_id', $fromId)->update(['trainer_id' => $toId]);

        // 2. Reassign lectures
        Lecture::where('trainer_id', $fromId)->update(['trainer_id' => $toId]);

        // 3. Merge Payrolls
        $payrolls = TrainerPayroll::where('trainer_id', $fromId)->get();
        foreach ($payrolls as $p) {
            $existingPayroll = TrainerPayroll::where('trainer_id', $toId)
                ->where('month', $p->month)
                ->where('year', $p->year)
                ->first();

            if ($existingPayroll) {
                $existingPayroll->completed_lectures += $p->completed_lectures;
                $existingPayroll->base_pay += $p->base_pay;
                $existingPayroll->renewals_count += $p->renewals_count;
                $existingPayroll->bonus_deduction += $p->bonus_deduction;
                $existingPayroll->notes = trim($existingPayroll->notes . " | Merged payroll from duplicate Trainer ID $fromId (originally paid: " . $p->total_pay . " IQD)");
                $existingPayroll->recalculate();
                $existingPayroll->save();
                $p->delete();
            } else {
                $p->trainer_id = $toId;
                $p->user_id = $toTrainer->user_id;
                $p->recalculate();
                $p->save();
            }
        }

        // 4. Merge Unavailabilities
        $fromUnavailability = TrainerUnavailability::where('trainer_id', $fromId)->first();
        if ($fromUnavailability) {
            $toUnavailability = TrainerUnavailability::where('trainer_id', $toId)->first();
            if ($toUnavailability) {
                $mergedDays = array_unique(array_merge($toUnavailability->unavailable_days ?? [], $fromUnavailability->unavailable_days ?? []));
                $toUnavailability->unavailable_days = $mergedDays;
                $toUnavailability->notes = trim($toUnavailability->notes . " | Merged from duplicate: " . $fromUnavailability->notes);
                $toUnavailability->save();
                $fromUnavailability->delete();
            } else {
                $fromUnavailability->trainer_id = $toId;
                $fromUnavailability->save();
            }
        }

        // 5. Delete Trainer profile and User
        $fromTrainerUserId = $fromTrainer->user_id;
        $fromTrainer->delete();
        if ($fromTrainerUserId) {
            User::where('id', $fromTrainerUserId)->delete();
        }
    }
}
