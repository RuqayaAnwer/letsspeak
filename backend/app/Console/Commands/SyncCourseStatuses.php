<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\Student;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SyncCourseStatuses extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'courses:sync-statuses {--live : Apply changes to the database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize course statuses and lecture completions with Excel/Google Sheet and intelligent business rules';

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
        $this->info("Let's Speak - Smart Course Status & Lecture Sync");
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

        $sheetMap = []; // Key: normalized_student_name . '_' . start_date => status
        $sheetRowsCount = 0;

        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 11) continue;
            $sheetRowsCount++;

            $timestamp = trim($row[0]);
            $studentName = trim($row[1]);
            $partnerName = trim($row[2]);
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

            // Index by student name and partner name
            $normStudent = $this->normalizeName($studentName);
            if ($startDate) {
                $sheetMap[$normStudent . '|' . $startDate] = [
                    'status' => $targetStatus,
                    'raw_status' => $rawStatus,
                    'start_date' => $startDate,
                ];
            }
            if (!empty($partnerName)) {
                $normPartner = $this->normalizeName($partnerName);
                if ($startDate) {
                    $sheetMap[$normPartner . '|' . $startDate] = [
                        'status' => $targetStatus,
                        'raw_status' => $rawStatus,
                        'start_date' => $startDate,
                    ];
                }
            }
        }

        fclose($handle);
        unlink($tempFile);

        $this->info("Indexed {$sheetRowsCount} rows from Google Sheet.\n");

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
        $courses = Course::with(['students', 'lectures'])->get();
        $this->info("Total Courses in Database: " . $courses->count() . "\n");

        $stats = [
            'total' => $courses->count(),
            'matched_sheet' => 0,
            'fallback_date' => 0,
            'superceded_renewal' => 0,
            'completed_lectures' => 0,
            'to_active' => 0,
            'to_finished' => 0,
            'to_paused' => 0,
            'to_cancelled' => 0,
            'lectures_updated' => 0,
        ];

        if ($isLive) {
            DB::beginTransaction();
        }

        try {
            foreach ($courses as $course) {
                $courseStartDate = $course->start_date ? $course->start_date->format('Y-m-d') : null;
                $targetStatus = null;
                $matchedSource = null;

                // 1. Try to find in sheetMap by students
                foreach ($course->students as $student) {
                    $normName = $this->normalizeName($student->name);
                    
                    // Exact date match
                    if ($courseStartDate && isset($sheetMap[$normName . '|' . $courseStartDate])) {
                        $targetStatus = $sheetMap[$normName . '|' . $courseStartDate]['status'];
                        $matchedSource = "Sheet match ({$student->name}, date: {$courseStartDate}, raw: '{$sheetMap[$normName . '|' . $courseStartDate]['raw_status']}')";
                        break;
                    }

                    // Window match (+/- 7 days)
                    if ($courseStartDate) {
                        $cDate = Carbon::parse($courseStartDate);
                        for ($d = -7; $d <= 7; $d++) {
                            $checkDate = $cDate->copy()->addDays($d)->format('Y-m-d');
                            if (isset($sheetMap[$normName . '|' . $checkDate])) {
                                $targetStatus = $sheetMap[$normName . '|' . $checkDate]['status'];
                                $matchedSource = "Sheet window match ({$student->name}, date: {$checkDate}, raw: '{$sheetMap[$normName . '|' . $checkDate]['raw_status']}')";
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

                $this->line("Course ID #{$course->id} [{$course->title}]: Current Status '{$course->status}' -> Target Status '{$targetStatus}' ({$matchedSource})");

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

            if ($isLive) {
                DB::commit();
                $this->info("\n✓ Database Transaction Committed Successfully!");
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
