<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Trainer;
use App\Models\Student;
use App\Models\Course;
use App\Models\CoursePackage;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

// Set time limit to unlimited
set_time_limit(0);

// --- CONFIGURATION ---
$googleSheetUrl = 'https://docs.google.com/spreadsheets/d/1db0NYPAOunswRyxOMfprGcU-zCfUfMBsxZfKbMcpLAY/export?format=csv&gid=556864345';
$dryRun = false; // Set to false to perform the actual live import
// ---------------------

echo "==================================================\n";
echo "LetSpeak Google Sheet Importer\n";
echo "Mode: " . ($dryRun ? "DRY RUN (No database changes will be saved)" : "LIVE IMPORT (Changes will be saved)") . "\n";
echo "==================================================\n\n";

// Helper parsers
function parseArabicDays($str) {
    if (empty($str)) {
        return [];
    }
    if (mb_strlen($str) > 60) {
        return [];
    }

    $days = [];
    $str = mb_strtolower($str);

    $map = [
        'sun' => ['أحد', 'احد', 'الأحد', 'الاحد'],
        'mon' => ['اثنين', 'أثنين', 'ألاثنين', 'الأثنين', 'الاثنين', 'إثنين', 'ثنين'],
        'tue' => ['ثلاثاء', 'الثلاثاء'],
        'wed' => ['اربعاء', 'أربعاء', 'الأربعاء', 'الاربعاء'],
        'thu' => ['خميس', 'الخميس'],
        'fri' => ['جمعة', 'الجمعة', 'جمعه'],
        'sat' => ['سبت', 'السبت']
    ];

    foreach ($map as $key => $keywords) {
        foreach ($keywords as $kw) {
            if (mb_strpos($str, $kw) !== false) {
                $days[] = $key;
                break;
            }
        }
    }
    return $days;
}

function parseDate($str) {
    if (empty($str)) return null;
    $str = trim($str);
    try {
        // Strip time if present
        $parts = explode(' ', $str);
        $datePart = $parts[0];
        
        $d = null;
        // Try common formats (both 4-digit and 2-digit years)
        $formats = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'Y/m/d', 'm/d/Y', 'd/m/y', 'y/m/d', 'm/d/y'];
        foreach ($formats as $f) {
            try {
                $parsed = Carbon::createFromFormat($f, $datePart);
                if ($parsed) {
                    $d = $parsed;
                    break;
                }
            } catch (\Exception $e) {}
        }
        
        if (!$d) {
            $d = Carbon::parse($datePart);
        }
        
        if ($d) {
            $year = $d->year;
            if ($year < 100) {
                $d->year = $year + 2000;
            }
            return $d->format('Y-m-d');
        }
    } catch (\Exception $e) {}
    return null;
}

function parseTime($str) {
    if (empty($str)) {
        return '12:00:00';
    }
    $str = trim($str);
    if (preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $str)) {
        $parts = explode(':', $str);
        $hours = str_pad($parts[0], 2, '0', STR_PAD_LEFT);
        $minutes = str_pad($parts[1], 2, '0', STR_PAD_LEFT);
        $seconds = isset($parts[2]) ? str_pad($parts[2], 2, '0', STR_PAD_LEFT) : '00';
        return "$hours:$minutes:$seconds";
    }
    return '12:00:00';
}

function parseCurrency($str) {
    if (empty($str)) return 0.0;
    $str = trim($str);
    $str = str_replace('،', '', $str);
    preg_match('/[0-9]+(\.[0-9]+)?/', $str, $matches);
    if (empty($matches[0])) {
        return 0.0;
    }
    $num = floatval($matches[0]);
    if ($num > 0 && $num < 1000) {
        $num *= 1000;
    }
    return $num;
}

function generateLectureSchedule(Course $course) {
    $dayMap = [
        'sun' => Carbon::SUNDAY,
        'mon' => Carbon::MONDAY,
        'tue' => Carbon::TUESDAY,
        'wed' => Carbon::WEDNESDAY,
        'thu' => Carbon::THURSDAY,
        'fri' => Carbon::FRIDAY,
        'sat' => Carbon::SATURDAY,
    ];

    $days = $course->lecture_days;
    if (empty($days)) {
        $days = ['sun', 'tue', 'thu'];
    }

    $lectureDays = array_map(fn($day) => $dayMap[$day] ?? Carbon::SUNDAY, $days);
    $startDate = Carbon::parse($course->start_date);
    $currentDate = $startDate->copy();
    $lecturesCreated = 0;

    $attendanceStatus = ($course->status === 'finished') ? 'present' : 'pending';

    while ($lecturesCreated < $course->lectures_count) {
        if (in_array($currentDate->dayOfWeek, $lectureDays)) {
            Lecture::create([
                'course_id' => $course->id,
                'lecture_number' => $lecturesCreated + 1,
                'date' => $currentDate->format('Y-m-d'),
                'attendance' => $attendanceStatus,
            ]);
            $lecturesCreated++;
        }
        $currentDate->addDay();
    }
}

// Download/Fetch CSV
echo "Fetching CSV data from Google Sheet...\n";
$csvContent = file_get_contents($googleSheetUrl);
if ($csvContent === false) {
    die("Error: Unable to fetch Google Sheet data.\n");
}

$tempFile = tempnam(sys_get_temp_dir(), 'import_sheet_');
file_put_contents($tempFile, $csvContent);

$handle = fopen($tempFile, 'r');
if ($handle === false) {
    die("Error: Unable to open temporary CSV file.\n");
}

// Skip any initial header rows
$headers = [];
for ($i = 0; $i < 9; $i++) {
    $headers = fgetcsv($handle);
}

echo "Detected Headers: " . implode(', ', array_slice($headers, 0, 17)) . "\n\n";

$rowCount = 0;
$importedCount = 0;
$skippedCount = 0;

// Memory caches for dry-running to avoid double counts
$dryRunTrainers = [];  // [name => trainerId]
$dryRunStudents = [];  // [name => studentId]
$newTrainersCount = 0;
$newStudentsCount = 0;

$coursesCreated = [];

// Start Transaction
DB::beginTransaction();

try {
    while (($row = fgetcsv($handle)) !== FALSE) {
        $rowCount++;
        
        if (count($row) < 17) {
            $skippedCount++;
            continue;
        }

        $timestamp = trim($row[0]);
        $studentName = trim($row[1]);
        $partnerName = trim($row[2]);
        $timeStr = trim($row[3]);
        $trainerName = trim($row[4]);
        $level = trim($row[5]);
        $paymentMethod = trim($row[6]);
        $notes = trim($row[7]);
        $startDateStr = trim($row[8]);
        $daysStr = trim($row[9]);
        $statusStr = trim($row[10]);
        $prevTrainer = trim($row[11]);
        $amountUpdates = trim($row[12]);
        $amountPaidStr = trim($row[13]);
        $courseType = trim($row[14]);
        $subSource = trim($row[15]);

        if (empty($studentName) || strpos($studentName, 'حذف') !== false || strpos($studentName, 'مكرر') !== false) {
            $skippedCount++;
            continue;
        }

        // 1. Process Trainer
        $trainerId = 1;
        if (!empty($trainerName)) {
            // Check memory cache first using array_key_exists to prevent NULL bugs
            if (array_key_exists($trainerName, $dryRunTrainers)) {
                $trainerId = $dryRunTrainers[$trainerName];
            } else {
                $trainerUser = User::where('role', 'trainer')
                    ->where('name', 'like', $trainerName)
                    ->first();
                
                if (!$trainerUser) {
                    $email = strtolower(str_replace(' ', '', $trainerName)) . '@letspeak.com';
                    $trainerUser = User::where('email', $email)->first();
                    
                    if (!$trainerUser) {
                        if (!$dryRun) {
                            $trainerUser = User::create([
                                'name' => $trainerName,
                                'email' => $email,
                                'password' => bcrypt('password'),
                                'role' => 'trainer',
                                'status' => 'active',
                            ]);
                        } else {
                            $trainerUser = new User();
                            $trainerUser->id = 9999 + $newTrainersCount;
                            $trainerUser->name = $trainerName;
                            $trainerUser->email = $email;
                            $trainerUser->role = 'trainer';
                        }
                        $newTrainersCount++;
                    }
                }

                if ($trainerUser) {
                    $trainer = Trainer::where('user_id', $trainerUser->id)->first();
                    if (!$trainer) {
                        if (!$dryRun) {
                            $trainer = Trainer::create([
                                'user_id' => $trainerUser->id,
                                'min_level' => 'L1',
                                'max_level' => 'L6',
                                'status' => 'active',
                            ]);
                        } else {
                            $trainer = new Trainer();
                            $trainer->id = $trainerUser->id; // mock trainer ID
                            $trainer->user_id = $trainerUser->id;
                        }
                    }
                    $trainerId = $trainer->id;
                    $dryRunTrainers[$trainerName] = $trainerId;
                }
            }
        }

        // 2. Process Students
        $studentIds = [];
        $studentNamesToProcess = [$studentName];
        if (!empty($partnerName)) {
            $studentNamesToProcess[] = $partnerName;
        }

        foreach ($studentNamesToProcess as $sName) {
            if (array_key_exists($sName, $dryRunStudents)) {
                $studentIds[] = $dryRunStudents[$sName];
            } else {
                $student = Student::where('name', 'like', $sName)->first();
                if (!$student) {
                    if (!$dryRun) {
                        $student = Student::create([
                            'name' => $sName,
                            'level' => !empty($level) ? $level : 'L1',
                            'status' => 'active',
                            'phone' => '',
                        ]);
                    } else {
                        $student = new Student();
                        $student->id = 8888 + $newStudentsCount;
                        $student->name = $sName;
                        $student->level = !empty($level) ? $level : 'L1';
                    }
                    $newStudentsCount++;
                }
                $studentIds[] = $student->id;
                $dryRunStudents[$sName] = $student->id;
            }
        }

        // 3. Process Dates & Time
        $startDate = parseDate($startDateStr);
        if (!$startDate) {
            $startDate = parseDate($timestamp);
        }
        if (!$startDate) {
            $startDate = now()->toDateString();
        }

        $lectureTime = parseTime($timeStr);
        $lectureDays = parseArabicDays($daysStr);
        if (empty($lectureDays)) {
            $lectureDays = ['sun', 'tue', 'thu'];
        }

        // 4. Map Status
        $status = 'active';
        $statusStrLower = strtolower($statusStr);
        if (strpos($statusStr, 'تم') !== false 
            || strpos($statusStr, 'مكتمل') !== false 
            || strpos($statusStr, 'مدفوع') !== false 
            || $statusStrLower === 'paid' 
            || $statusStrLower === 'finished'
        ) {
            $status = 'finished';
        } elseif (strpos($statusStr, 'مأجل') !== false 
            || strpos($statusStr, 'مؤجل') !== false 
            || $statusStrLower === 'paused'
        ) {
            $status = 'paused';
        } elseif (strpos($statusStr, 'ملغي') !== false 
            || strpos($statusStr, 'ملغى') !== false 
            || $statusStrLower === 'cancelled'
        ) {
            $status = 'cancelled';
        }

        // 5. Parse Amounts
        $totalAmount = parseCurrency($amountUpdates);
        $amountPaid = parseCurrency($amountPaidStr);

        if ($totalAmount === 0.0) {
            if ($amountPaid > 0) {
                $totalAmount = $amountPaid;
            } else {
                $totalAmount = 230000.00; // default
            }
        }

        // 6. Map Package
        $packageId = null;
        if (abs($totalAmount - 120000) < 1000) {
            $packageId = 1;
        } elseif (abs($totalAmount - 230000) < 1000) {
            $packageId = 2;
        } elseif (abs($totalAmount - 330000) < 1000) {
            $packageId = 3;
        }

        $isDual = count($studentIds) > 1;
        $isKids = (strpos(strtolower($courseType), 'أطفال') !== false || strpos(strtolower($courseType), 'kids') !== false);

        $courseTitle = "كورس " . implode(' & ', $studentNamesToProcess);

        // 7. Create Course
        $courseData = [
            'trainer_id' => $trainerId,
            'course_package_id' => $packageId,
            'title' => $courseTitle,
            'lectures_count' => 24,
            'start_date' => $startDate,
            'lecture_time' => $lectureTime,
            'lecture_days' => $lectureDays,
            'status' => $status,
            'payment_method' => !empty($paymentMethod) ? $paymentMethod : 'cash',
            'subscription_source' => !empty($subSource) ? $subSource : 'direct',
            'total_amount' => $totalAmount,
            'amount_paid' => $amountPaid,
            'notes' => (!empty($notes) ? $notes : '') . (!empty($prevTrainer) ? " | كان مع المدرب: $prevTrainer" : ""),
            'is_dual' => $isDual,
            'is_kids' => $isKids,
        ];

        if (!$dryRun) {
            // Check if course already exists to prevent duplication
            $existingCourse = Course::where('title', $courseTitle)
                ->where('start_date', 'like', $startDate . '%')
                ->where('trainer_id', $trainerId)
                ->first();

            if ($existingCourse) {
                $skippedCount++;
                continue;
            }

            $course = Course::create($courseData);
            
            foreach ($studentIds as $index => $sId) {
                $course->students()->attach($sId, [
                    'is_primary' => $index === 0,
                    'student_level' => !empty($level) ? $level : 'L1',
                ]);
            }
            
            generateLectureSchedule($course);
            
            if ($amountPaid > 0) {
                Payment::create([
                    'course_id' => $course->id,
                    'student_id' => $studentIds[0],
                    'amount' => $amountPaid,
                    'payment_method' => !empty($paymentMethod) ? $paymentMethod : 'cash',
                    'status' => 'completed',
                    'payment_date' => $startDate,
                    'notes' => 'دفعة مستوردة من شيت الإكسل',
                ]);
            }
        }

        $coursesCreated[] = [
            'title' => $courseTitle,
            'trainer' => $trainerName,
            'start_date' => $startDate,
            'status' => $status,
            'total' => $totalAmount,
            'paid' => $amountPaid,
        ];

        $importedCount++;
    }

    if (!$dryRun) {
        DB::commit();
        echo "Database transaction COMMITTED successfully.\n";
    } else {
        DB::rollBack();
        echo "Database transaction ROLLED BACK successfully (Dry Run Mode).\n";
    }

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR during import: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}

unlink($tempFile);

echo "\n--- IMPORT SUMMARY ---\n";
echo "Total Rows Parsed: {$rowCount}\n";
echo "Successfully Mapped: {$importedCount}\n";
echo "Skipped Rows: {$skippedCount}\n";
echo "New Trainers Created: {$newTrainersCount} (" . implode(', ', array_keys($dryRunTrainers)) . ")\n";
echo "New Students Created: {$newStudentsCount}\n";
echo "Total Courses Created: " . count($coursesCreated) . "\n";
echo "==================================================\n";

if ($importedCount > 0) {
    echo "\nSample of mapped courses:\n";
    $sample = array_slice($coursesCreated, 0, 10);
    foreach ($sample as $c) {
        echo "- {$c['title']} | Trainer: {$c['trainer']} | Start: {$c['start_date']} | Status: {$c['status']} | Total: {$c['total']} | Paid: {$c['paid']}\n";
    }
}
?>
