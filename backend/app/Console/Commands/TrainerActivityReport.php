<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Trainer;
use App\Models\Course;
use App\Models\Lecture;
use Carbon\Carbon;

class TrainerActivityReport extends Command
{
    protected $signature = 'trainers:activity-report';

    protected $description = 'Generate an activity report for trainers (Active, recently inactive, and inactive for more than a month)';

    public function handle()
    {
        $this->info("==================================================");
        $this->info("TRAINER ACTIVITY REPORT");
        $this->info("==================================================");

        $trainers = Trainer::with('user')->get();

        if ($trainers->isEmpty()) {
            $this->warn("No trainers found in the database.");
            return Command::SUCCESS;
        }

        $headers = ['المعرف (ID)', 'اسم المدرب', 'البريد الإلكتروني', 'الكورسات النشطة', 'آخر تاريخ نشاط', 'الحالة'];
        $rows = [];

        $activeCount = 0;
        $recentInactiveCount = 0;
        $longInactiveCount = 0;
        $neverActiveCount = 0;

        $thirtyDaysAgo = Carbon::now()->subDays(30)->toDateString();

        foreach ($trainers as $t) {
            $name = $t->user ? $t->user->name : ($t->name ?: 'N/A');
            $email = $t->user ? $t->user->email : 'N/A';

            // 1. Count currently active courses
            $activeCoursesCount = Course::where('trainer_id', $t->id)->where('status', 'active')->count();

            // 2. Determine last activity date (maximum of lectures date or course start date)
            $lastLectureDate = Lecture::where('trainer_id', $t->id)->max('date');
            $lastCourseDate = Course::where('trainer_id', $t->id)->max('start_date');
            
            // Format course start date safely if it exists
            if ($lastCourseDate instanceof Carbon) {
                $lastCourseDate = $lastCourseDate->toDateString();
            } else if ($lastCourseDate) {
                $lastCourseDate = substr($lastCourseDate, 0, 10);
            }

            $lastActiveDate = null;
            if ($lastLectureDate && $lastCourseDate) {
                $lastActiveDate = max($lastLectureDate, $lastCourseDate);
            } else {
                $lastActiveDate = $lastLectureDate ?: ($lastCourseDate ?: null);
            }

            // 3. Classify trainer
            if ($activeCoursesCount > 0) {
                $status = 'نشط مستمر';
                $activeCount++;
            } else {
                if (!$lastActiveDate) {
                    $status = 'لم يبدأ أي كورس';
                    $neverActiveCount++;
                } else if ($lastActiveDate >= $thirtyDaysAgo) {
                    $status = 'متوقف حديثاً (< 30 يوم)';
                    $recentInactiveCount++;
                } else {
                    $status = 'غير نشط منذ شهر فأكثر';
                    $longInactiveCount++;
                }
            }

            $rows[] = [
                $t->id,
                $name,
                $email,
                $activeCoursesCount,
                $lastActiveDate ?: 'بدون نشاط سابق',
                $status
            ];
        }

        // Sort rows: Active first, then recently inactive, then long inactive, then never active
        usort($rows, function ($a, $b) {
            $statusWeight = [
                'نشط مستمر' => 1,
                'متوقف حديثاً (< 30 يوم)' => 2,
                'غير نشط منذ شهر فأكثر' => 3,
                'لم يبدأ أي كورس' => 4,
            ];
            
            $wA = $statusWeight[$a[5]] ?? 5;
            $wB = $statusWeight[$b[5]] ?? 5;

            if ($wA === $wB) {
                return strcasecmp($a[1], $b[1]); // Alphabetical sorting by name if statuses match
            }
            return $wA - $wB;
        });

        $this->table($headers, $rows);

        $this->info("\n==================================================");
        $this->info("ملخص التقرير (Summary):");
        $this->info("==================================================");
        $this->line("🟢 مدربون نشطون حالياً (Active): " . $activeCount);
        $this->line("🟡 متوقفون حديثاً (Recently Inactive < 30 days): " . $recentInactiveCount);
        $this->line("🔴 غير نشطين منذ شهر فأكثر (Inactive > 30 days): " . $longInactiveCount);
        $this->line("⚪ لم يبدأوا أي كورس (Never Active): " . $neverActiveCount);
        $this->info("==================================================");

        return Command::SUCCESS;
    }
}
