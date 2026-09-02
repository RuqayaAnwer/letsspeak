<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\Student;
use App\Models\Trainer;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SyncCourseStatuses extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'courses:sync-statuses {--live : Apply changes to the database} {--details : Show individual details for every course}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize course statuses, lecture completions, and trainer linkages with Excel/Google Sheet and intelligent business rules';

    /**
     * Google Sheet CSV URL
     */
    protected string $googleSheetUrl = 'https://docs.google.com/spreadsheets/d/18C1TCt-pqU2By1QtCv3pcnQfb0K81XWsgYTIYdvl0o8/export?format=csv&gid=412213874';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $isLive = $this->option('live');

        $this->info("==========================================================");
        $this->info("Let's Speak - Smart Course Status, Lecture & Trainer Sync");
        $this->info("Mode: " . ($isLive ? "LIVE (Changes will be written to DB)" : "DRY RUN (Preview only, no DB changes)"));
        $this->info("==========================================================\n");

        $this->info("Fetching sheet data from Google Sheets...");
        $csvContent = @file_get_contents($this->googleSheetUrl);
        if ($csvContent === false) {
            $this->error("Failed to fetch Google Sheet data from URL: " . $this->googleSheetUrl);
            return 1;
        }

        $tempFile = tempnam(sys_get_temp_dir(), 'sync_statuses_');
        file_put_contents($tempFile, $csvContent);

        $handle = fopen($tempFile, 'r');
        if ($handle === false) {
            $this->error("Failed to open temporary file.");
            return 1;
        }

        // Read header
        $headers = fgetcsv($handle);

        $sheetMap = []; // Key: normalized_student_name . '_' . start_date => status & trainer
        $sheetRowsCount = 0;

        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 11) continue;
            $sheetRowsCount++;

            $timestamp = trim($row[0]);
            $studentName = trim($row[1]);
            $partnerName = trim($row[2]);
            $rawTrainer = trim($row[4] ?? '');
            $startDateStr = trim($row[8]);
            $rawStatus = trim($row[10]);

            if (empty($studentName) || mb_strpos($studentName, 'حذف') !== false || mb_strpos($studentName, 'مكرر') !== false) {
                continue;
            }

            $startDate = $this->parseDate($startDateStr);
            if (!$startDate) {
                $startDate = $this->parseDate($timestamp);
            }

            $targetStatus = $this->determineStatus($rawStatus, $startDate);
            $normalizedTrainer = $this->normalizeTrainerName($rawTrainer);

            $rowData = [
                'status' => $targetStatus,
                'raw_status' => $rawStatus,
                'start_date' => $startDate,
                'raw_trainer' => $rawTrainer,
                'normalized_trainer' => $normalizedTrainer,
            ];

            // Index by student name and partner name
            $normStudent = $this->normalizeName($studentName);
            if ($startDate) {
                $sheetMap[$normStudent . '|' . $startDate] = $rowData;
            }
            if (!empty($partnerName)) {
                $normPartner = $this->normalizeName($partnerName);
                if ($startDate) {
                    $sheetMap[$normPartner . '|' . $startDate] = $rowData;
                }
            }
        }

        fclose($handle);
        unlink($tempFile);

        $this->info("Indexed {$sheetRowsCount} rows from Google Sheet.\n");

        // Pre-fetch all trainers and trainer users
        $allTrainers = Trainer::with('user')->get();
        $allTrainerUsers = User::where('role', 'trainer')->with('trainer')->get();

        // Pre-fetch all students with all their courses to check renewals & subsequent courses
        $allStudents = Student::with(['courses' => function ($q) {
            $q->orderBy('start_date', 'asc');
        }])->get();

        // Build student max start_dates map to detect subsequent renewal courses
        $studentCoursesTimeline = [];
        foreach ($allStudents as $st) {
            $studentCoursesTimeline[$st->id] = $st->courses->sortBy('start_date')->values();
        }

        // Now inspect all courses in Database
        $courses = Course::with(['students', 'lectures', 'trainer.user'])->get();
        $this->info("Total Courses in Database: " . $courses->count() . "\n");

        $stats = [
            'total' => $courses->count(),
            'matched_sheet' => 0,
            'fallback_date' => 0,
            'superceded_renewal' => 0,
            'completed_lectures' => 0,
            'trainers_linked' => 0,
            'to_active' => 0,
            'to_finished' => 0,
            'to_paused' => 0,
            'to_cancelled' => 0,
            'lectures_updated' => 0,
        ];

        $progressBar = null;
        if (!$this->option('details')) {
            $progressBar = $this->output->createProgressBar($courses->count());
            $progressBar->start();
        }

        if ($isLive) {
            DB::beginTransaction();
        }

        try {
            foreach ($courses as $course) {
                $courseStartDate = $course->start_date ? $course->start_date->format('Y-m-d') : null;
                $targetStatus = null;
                $matchedSource = null;
                $matchedSheetRow = null;

                // 1. Try to find in sheetMap by students
                foreach ($course->students as $student) {
                    $normName = $this->normalizeName($student->name);
                    
                    // Exact date match
                    if ($courseStartDate && isset($sheetMap[$normName . '|' . $courseStartDate])) {
                        $matchedSheetRow = $sheetMap[$normName . '|' . $courseStartDate];
                        $targetStatus = $matchedSheetRow['status'];
                        $matchedSource = "Sheet match ({$student->name}, date: {$courseStartDate}, raw: '{$matchedSheetRow['raw_status']}')";
                        break;
                    }

                    // Window match (+/- 7 days)
                    if ($courseStartDate) {
                        $cDate = Carbon::parse($courseStartDate);
                        for ($d = -7; $d <= 7; $d++) {
                            $checkDate = $cDate->copy()->addDays($d)->format('Y-m-d');
                            if (isset($sheetMap[$normName . '|' . $checkDate])) {
                                $matchedSheetRow = $sheetMap[$normName . '|' . $checkDate];
                                $targetStatus = $matchedSheetRow['status'];
                                $matchedSource = "Sheet window match ({$student->name}, date: {$checkDate}, raw: '{$matchedSheetRow['raw_status']}')";
                                break 2;
                            }
                        }
                    }
                }

                if ($targetStatus) {
                    $stats['matched_sheet']++;
                } else {
                    $stats['fallback_date']++;
                    $targetStatus = $this->determineStatus($course->status, $courseStartDate);
                    $matchedSource = "Date-based rule (start: {$courseStartDate}, current: '{$course->status}')";
                }

                // Trainer Linking & Association fix
                $sheetTrainer = $matchedSheetRow['normalized_trainer'] ?? $matchedSheetRow['raw_trainer'] ?? $course->trainer_name;
                if (!empty($sheetTrainer) && mb_strpos($sheetTrainer, 'بانتظار') === false && mb_strpos($sheetTrainer, 'waiting') === false) {
                    $foundTrainer = $this->findTrainer($sheetTrainer, $allTrainers, $allTrainerUsers);
                    if ($foundTrainer) {
                        if ($course->trainer_id !== $foundTrainer->id) {
                            if ($isLive) {
                                $course->trainer_id = $foundTrainer->id;
                                $course->trainer_name = $foundTrainer->name ?: ($foundTrainer->user->name ?? $sheetTrainer);
                                $course->save();
                            }
                            $stats['trainers_linked']++;
                        }
                        if ($isLive && $targetStatus === 'active') {
                            if ($foundTrainer->status !== 'active') {
                                $foundTrainer->status = 'active';
                                $foundTrainer->save();
                            }
                            if ($foundTrainer->user && $foundTrainer->user->status !== 'active') {
                                $foundTrainer->user->status = 'active';
                                $foundTrainer->user->save();
                            }
                        }
                    }
                }

                // 2. Intelligent Rule A: If student has a newer course that started after this course, this older course is finished!
                if ($targetStatus === 'active' && $courseStartDate) {
                    foreach ($course->students as $student) {
                        if (isset($studentCoursesTimeline[$student->id])) {
                            $newerCourses = $studentCoursesTimeline[$student->id]->filter(function ($c) use ($course, $courseStartDate) {
                                $cStart = $c->start_date ? $c->start_date->format('Y-m-d') : null;
                                return $c->id !== $course->id && $cStart && $cStart > $courseStartDate;
                            });

                            if ($newerCourses->count() > 0) {
                                $targetStatus = 'finished';
                                $matchedSource = "Auto-finished (Student {$student->name} has newer subsequent course starting {$newerCourses->first()->start_date->format('Y-m-d')})";
                                $stats['superceded_renewal']++;
                                break;
                            }
                        }
                    }
                }

                // 3. Intelligent Rule B: If all lectures are already present/completed, course is finished!
                if ($targetStatus === 'active') {
                    $completedLecCount = $course->lectures->whereIn('attendance', ['present', 'partially', 'absent'])->count();
                    if ($course->lectures_count > 0 && $completedLecCount >= $course->lectures_count) {
                        $targetStatus = 'finished';
                        $matchedSource = "Auto-finished (All {$completedLecCount}/{$course->lectures_count} lectures completed)";
                        $stats['completed_lectures']++;
                    }
                }

                // 4. Intelligent Rule C: If course start date is > 100 days in the past, course is finished
                if ($targetStatus === 'active' && $courseStartDate) {
                    $hundredDaysAgo = Carbon::now()->subDays(100)->toDateString();
                    if ($courseStartDate < $hundredDaysAgo) {
                        $targetStatus = 'finished';
                        $matchedSource = "Auto-finished (Course started {$courseStartDate} > 100 days ago)";
                    }
                }

                // Count target status transitions
                if ($targetStatus === 'finished') $stats['to_finished']++;
                elseif ($targetStatus === 'active') $stats['to_active']++;
                elseif ($targetStatus === 'paused') $stats['to_paused']++;
                elseif ($targetStatus === 'cancelled') $stats['to_cancelled']++;

                if ($this->option('details')) {
                    $this->line("Course ID #{$course->id} [{$course->title}]: Current Status '{$course->status}' -> Target Status '{$targetStatus}' ({$matchedSource})");
                } else {
                    $progressBar->advance();
                }

                if ($isLive) {
                    if ($targetStatus === 'finished') {
                        $finishedDate = $course->finished_at ? $course->finished_at->format('Y-m-d H:i:s') : (($courseStartDate ?: now()->toDateString()) . ' 23:59:59');
                        $course->status = 'finished';
                        $course->finished_at = $finishedDate;
                        $course->trainer_payment_status = 'paid';
                        $course->save();

                        // Mark all lectures as completed and paid to trainer
                        $updatedLec = $course->lectures()->update([
                            'attendance' => 'present',
                            'trainer_payment_status' => 'paid',
                        ]);
                        $stats['lectures_updated'] += $updatedLec;
                    } elseif ($targetStatus === 'active') {
                        $course->status = 'active';
                        $course->finished_at = null;
                        $course->save();

                        // Ensure trainer is active
                        if ($course->trainer) {
                            if ($course->trainer->status !== 'active') {
                                $course->trainer->status = 'active';
                                $course->trainer->save();
                            }
                            if ($course->trainer->user && $course->trainer->user->status !== 'active') {
                                $course->trainer->user->status = 'active';
                                $course->trainer->user->save();
                            }
                        }

                        // For active courses, ensure future lectures are not erroneously marked as paid/present if not attended
                        $today = now()->toDateString();
                        foreach ($course->lectures as $lec) {
                            $lecDate = $lec->date ? $lec->date->format('Y-m-d') : null;
                            if ($lecDate && $lecDate >= $today && $lec->attendance === 'present' && $lec->trainer_payment_status === 'paid' && !$lec->notes) {
                                $lec->attendance = 'pending';
                                $lec->trainer_payment_status = 'unpaid';
                                $lec->save();
                            }
                        }
                    } elseif ($targetStatus === 'paused') {
                        $course->status = 'paused';
                        $course->finished_at = null;
                        $course->save();
                    } elseif ($targetStatus === 'cancelled') {
                        $course->status = 'cancelled';
                        $course->save();
                    }
                }
            }

            if ($progressBar) {
                $progressBar->finish();
                $this->newLine(2);
            }

            if ($isLive) {
                // Bulk activate all trainers and users who have active courses
                $activeTrainerIds = Course::where('status', 'active')->whereNotNull('trainer_id')->pluck('trainer_id')->unique();
                Trainer::whereIn('id', $activeTrainerIds)->update(['status' => 'active']);
                $activeUserIds = Trainer::whereIn('id', $activeTrainerIds)->whereNotNull('user_id')->pluck('user_id')->unique();
                User::whereIn('id', $activeUserIds)->update(['status' => 'active']);

                DB::commit();
                $this->info("✓ Database Transaction Committed Successfully!");
            }
        } catch (\Exception $e) {
            if ($isLive) {
                DB::rollBack();
            }
            $this->error("Error syncing courses: " . $e->getMessage());
            return 1;
        }

        $this->info("\n=================== SYNC SUMMARY ===================");
        $this->info("Total Courses Checked:             {$stats['total']}");
        $this->info("Matched from Sheet:                {$stats['matched_sheet']}");
        $this->info("Fallback to Date Rules:            {$stats['fallback_date']}");
        $this->info("Older Courses Ended by Renewal:    {$stats['superceded_renewal']}");
        $this->info("Ended by Complete Lectures:        {$stats['completed_lectures']}");
        $this->info("Trainers Re-linked/Fixed:          {$stats['trainers_linked']}");
        $this->info("Resulting Active Courses:          {$stats['to_active']}");
        $this->info("Resulting Finished Courses:        {$stats['to_finished']}");
        $this->info("Resulting Paused Courses:          {$stats['to_paused']}");
        $this->info("Resulting Cancelled Courses:       {$stats['to_cancelled']}");
        if ($isLive) {
            $this->info("Lectures Updated:                  {$stats['lectures_updated']}");
        }
        $this->info("====================================================");

        return 0;
    }

    /**
     * Find trainer by name in existing trainers & users
     */
    protected function findTrainer(string $name, $allTrainers, $allTrainerUsers): ?Trainer
    {
        $cleanSearch = $this->normalizeName($name);

        // 1. Direct trainer name match
        foreach ($allTrainers as $t) {
            if ($this->normalizeName($t->name) === $cleanSearch) {
                return $t;
            }
            if ($t->user && $this->normalizeName($t->user->name) === $cleanSearch) {
                return $t;
            }
        }

        // 2. Trainer user match
        foreach ($allTrainerUsers as $u) {
            if ($this->normalizeName($u->name) === $cleanSearch) {
                if ($u->trainer) {
                    return $u->trainer;
                }
            }
        }

        return null;
    }

    /**
     * Normalize trainer names mapping Arabic <-> English
     */
    protected function normalizeTrainerName(string $name): string
    {
        $name = trim($name);
        $map = [
            'آمنة رباح محمود' => 'Amina Rabah',
            'امنة رباح محمود' => 'Amina Rabah',
            'آمنة رباح' => 'Amina Rabah',
            'امنة رباح' => 'Amina Rabah',
            'آمنة' => 'Amina Rabah',
            'امنة' => 'Amina Rabah',
            'أمينة' => 'Amina Rabah',
            'امينة' => 'Amina Rabah',
            'amina' => 'Amina Rabah',
            'amina rabah' => 'Amina Rabah',
            'فرح' => 'Farah',
            'بتول' => 'Batool',
            'وسام' => 'Wisam',
            'رغد' => 'Raghad',
            'اسراء' => 'Israa',
            'إسراء' => 'Israa',
            'زهور' => 'Zhoor',
            'مصطفى' => 'Mustafa',
            'حسن' => 'Hasan',
            'براء' => 'Baraa',
            'ابتسام' => 'Ibtisam',
            'نوران' => 'Noran',
            'ميس' => 'Mais',
            'عائشة' => 'Aisha',
            'بنين' => 'Baneen H',
            'منار' => 'Manar Drgham',
            'حسين' => 'Hussein',
            'حيدر' => 'Haider',
            'أريج' => 'Areej',
            'طه' => 'Taha',
            'داليا' => 'Dalia',
            'تبارك' => 'Tabark',
            'نور' => 'Noor',
            'رند' => 'Rand',
            'انعام' => 'Anaam',
            'أنعام' => 'Anaam',
            'ابتهال' => 'Ibtihal',
            'غدير' => 'Ghadeer',
            'يسر' => 'Yusur Ahmed',
            'آية' => 'Aya Yasir',
            'اية' => 'Aya Yasir',
            'ضي ميثم' => 'Dhay',
            'ضي' => 'Dhay',
            'ايات فلاح' => 'Ayat Falah',
            'ايات' => 'Ayat Falah',
        ];

        $clean = mb_strtolower($name);
        $clean = str_replace(['أ', 'إ', 'آ'], 'ا', $clean);
        $clean = str_replace('ة', 'ه', $clean);
        $clean = str_replace('ى', 'ي', $clean);

        foreach ($map as $k => $target) {
            $ck = mb_strtolower($k);
            $ck = str_replace(['أ', 'إ', 'آ'], 'ا', $ck);
            $ck = str_replace('ة', 'ه', $ck);
            $ck = str_replace('ى', 'ي', $ck);
            if ($clean === $ck) {
                return $target;
            }
        }

        return $name;
    }

    /**
     * Determine status according to business rules
     */
    protected function determineStatus(?string $rawStatus, ?string $startDate): string
    {
        $rawStatus = trim($rawStatus ?? '');
        $rawStatusLower = strtolower($rawStatus);

        if (strpos($rawStatusLower, 'finish') !== false 
            || strpos($rawStatus, 'تم') !== false 
            || strpos($rawStatus, 'مكتمل') !== false 
            || strpos($rawStatus, 'منتهي') !== false
        ) {
            return 'finished';
        }

        if (strpos($rawStatusLower, 'pause') !== false 
            || strpos($rawStatus, 'مأجل') !== false 
            || strpos($rawStatus, 'مؤجل') !== false 
            || strpos($rawStatus, 'متوقف') !== false
        ) {
            return 'paused';
        }

        if (strpos($rawStatusLower, 'cancel') !== false 
            || strpos($rawStatus, 'ملغي') !== false 
            || strpos($rawStatus, 'ملغى') !== false
        ) {
            return 'cancelled';
        }

        if (strpos($rawStatusLower, 'active') !== false 
            || strpos($rawStatus, 'نشط') !== false 
            || strpos($rawStatus, 'جاري') !== false 
            || strpos($rawStatus, 'مستمر') !== false
        ) {
            return 'active';
        }

        // Unrecorded / 'Paid' historical status -> Rely on start date
        if ($startDate) {
            $thresholdDate = Carbon::now()->subDays(100)->toDateString();
            if ($startDate < $thresholdDate) {
                return 'finished';
            }
            return 'active';
        }

        return 'active';
    }

    /**
     * Parse date string safely
     */
    protected function parseDate(?string $str): ?string
    {
        if (empty($str)) return null;
        $str = trim($str);
        try {
            $parts = explode(' ', $str);
            $datePart = $parts[0];
            
            $formats = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'Y/m/d', 'm/d/Y', 'd/m/y', 'y/m/d', 'm/d/y'];
            foreach ($formats as $f) {
                try {
                    $parsed = Carbon::createFromFormat($f, $datePart);
                    if ($parsed) {
                        $year = $parsed->year;
                        if ($year < 100) $parsed->year = $year + 2000;
                        return $parsed->format('Y-m-d');
                    }
                } catch (\Exception $e) {}
            }
            
            $d = Carbon::parse($datePart);
            if ($d) {
                $year = $d->year;
                if ($year < 100) $d->year = $year + 2000;
                return $d->format('Y-m-d');
            }
        } catch (\Exception $e) {}
        return null;
    }

    /**
     * Normalize Arabic/English name for matching
     */
    protected function normalizeName(?string $name): string
    {
        $name = trim($name ?? '');
        $clean = mb_strtolower($name);
        $clean = str_replace(['أ', 'إ', 'آ'], 'ا', $clean);
        $clean = str_replace('ة', 'ه', $clean);
        $clean = str_replace('ى', 'ي', $clean);
        $clean = str_replace([' ', '-', '_'], '', $clean);
        return $clean;
    }
}
