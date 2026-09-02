<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Trainer;
use App\Models\Student;
use App\Models\Lead;
use App\Models\Course;
use App\Models\CoursePackage;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

// Set time limit to unlimited
set_time_limit(0);

// Parse CLI options
$isLive = in_array('--live', $argv);

echo "==================================================\n";
echo "LetSpeak Excel Importer (Safe Mode)\n";
echo "Mode: " . ($isLive ? "LIVE IMPORT (Changes will be saved)" : "DRY RUN (No database changes will be saved)") . "\n";
echo "==================================================\n\n";

$googleSheetUrl = 'https://docs.google.com/spreadsheets/d/18C1TCt-pqU2By1QtCv3pcnQfb0K81XWsgYTIYdvl0o8/export?format=csv&gid=412213874';

function normalizeTrainerName($name) {
    $name = trim($name);
    
    $map = [
        // English -> Arabic (DB is Arabic)
        'mohammed' => 'محمد أحمد',
        'mohamed' => 'محمد أحمد',
        'mohammad' => 'محمد أحمد',
        'fatima' => 'فاطمة علي',
        'fatimah' => 'فاطمة علي',
        'ali' => 'علي حسن',
        'ahmed' => 'أحمد محمد',
        'ahmad' => 'أحمد محمد',
        'sara' => 'سارة علي',
        'sarah' => 'سارة علي',
        
        // Arabic -> English (DB is English)
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
        'amaam' => 'Anaam',
        'إنعام' => 'Anaam',
        'ابتهال' => 'Ibtihal',
        'غدير' => 'Ghadeer',
        'يسر' => 'Yusur Ahmed',
        'آية' => 'Aya Yasir',
        'اية' => 'Aya Yasir',
        'أمينة' => 'Amina Rabah',
        'امينة' => 'Amina Rabah',
        'ضي ميثم' => 'Dhay',
        'ضي' => 'Dhay',
        'ايات فلاح' => 'Ayat Falah',
        'ايات' => 'Ayat Falah',
    ];
    
    $clean = mb_strtolower($name);
    $clean = str_replace(['أ', 'إ', 'آ'], 'ا', $clean);
    $clean = str_replace('ة', 'ه', $clean);
    
    foreach ($map as $key => $target) {
        $cleanKey = mb_strtolower($key);
        $cleanKey = str_replace(['أ', 'إ', 'آ'], 'ا', $cleanKey);
        $cleanKey = str_replace('ة', 'ه', $cleanKey);
        
        if ($clean === $cleanKey) {
            return $target;
        }
    }
    
    return $name;
}

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
        $parts = explode(' ', $str);
        $datePart = $parts[0];
        
        $d = null;
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

function cleanAmount($str) {
    $str = trim($str);
    $str = str_replace('الف', '', $str);
    $str = str_replace(' ', '', $str);
    $str = str_replace(',', '', $str);
    $str = str_replace('،', '', $str);
    preg_match('/[0-9]+/', $str, $matches);
    if (empty($matches[0])) return 0;
    $num = intval($matches[0]);
    if ($num > 0 && $num < 1000) {
        $num *= 1000;
    }
    return $num;
}

function determineLecturesAndSplits($pkg, $amountPaid, $isDual, $isKids) {
    $pkg = mb_strtolower($pkg);
    
    // Default values
    $baseLectures = 12;
    $singlePrice = 150000;
    $packageId = 1; // Speed Package (12 lectures in database)
    
    if (mb_strpos($pkg, 'بمزاجي') !== false) {
        $baseLectures = 8;
        $singlePrice = 100000;
        $packageId = null; // Custom course with 8 lectures
    } elseif (mb_strpos($pkg, 'توازن') !== false || mb_strpos($pkg, 'التوازن') !== false) {
        $baseLectures = 12;
        $singlePrice = 150000;
        $packageId = 1;
    } elseif (mb_strpos($pkg, 'سرعة') !== false || mb_strpos($pkg, 'السرعة') !== false || mb_strpos($pkg, 'speed') !== false) {
        $baseLectures = 12;
        $singlePrice = 120000;
        $packageId = 1;
    } elseif (mb_strpos($pkg, 'kids') !== false || mb_strpos($pkg, 'أطفال') !== false || $isKids) {
        if (mb_strpos($pkg, 'سرعة') !== false || mb_strpos($pkg, 'السرعة') !== false || mb_strpos($pkg, 'speed') !== false || (abs($amountPaid - 300000) < 20000)) {
            $baseLectures = 20;
            $singlePrice = 300000;
            $packageId = null;
        } else {
            $baseLectures = 12;
            $singlePrice = 180000;
            $packageId = 1;
        }
    } elseif (mb_strpos($pkg, 'group') !== false) {
        $baseLectures = 12;
        $singlePrice = 75000;
        $packageId = 1;
    } elseif (mb_strpos($pkg, 'dual') !== false || $isDual) {
        $baseLectures = 12;
        $singlePrice = 150000;
        $packageId = 1;
    }
    
    $rounds = 1;
    if ($amountPaid > 0 && $singlePrice > 0) {
        $ratio = $amountPaid / $singlePrice;
        if ($ratio >= 2.5) {
            $rounds = 3;
        } elseif ($ratio >= 1.5) {
            $rounds = 2;
        }
    }
    
    return [
        'base_lectures' => $baseLectures,
        'single_price' => $singlePrice,
        'package_id' => $packageId,
        'rounds' => $rounds
    ];
}

function checkDuplicateCourse($studentIds, $startDate, $simulatedCourses) {
    $startDateCarbon = Carbon::parse($startDate);
    $minDate = $startDateCarbon->copy()->subDays(10)->toDateString();
    $maxDate = $startDateCarbon->copy()->addDays(10)->toDateString();
    
    foreach ($simulatedCourses as $sc) {
        $commonStudents = array_intersect($studentIds, $sc['student_ids']);
        if (!empty($commonStudents)) {
            $scDate = Carbon::parse($sc['start_date']);
            if ($scDate->between($minDate, $maxDate)) {
                return true;
            }
        }
    }
    
    $existingCourses = Course::whereBetween('start_date', [$minDate, $maxDate])
        ->whereHas('students', function ($query) use ($studentIds) {
            $query->whereIn('students.id', $studentIds);
        })
        ->exists();
        
    return $existingCourses;
}

function generateLectureSchedule(Course $course, $isLive) {
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
    
    $today = Carbon::today();

    while ($lecturesCreated < $course->lectures_count) {
        if (in_array($currentDate->dayOfWeek, $lectureDays)) {
            $lectureDate = $currentDate->format('Y-m-d');
            $attendance = 'pending';
            $trainerPaymentStatus = 'unpaid';
            $isCompleted = false;

            if ($course->status === 'finished') {
                $attendance = 'present';
                $trainerPaymentStatus = 'paid';
                $isCompleted = true;
            } else {
                if ($currentDate->lt($today)) {
                    $attendance = 'present';
                }
            }
            
            if ($isLive) {
                Lecture::create([
                    'course_id' => $course->id,
                    'lecture_number' => $lecturesCreated + 1,
                    'date' => $lectureDate,
                    'attendance' => $attendance,
                    'trainer_payment_status' => $trainerPaymentStatus,
                ]);
            }
            $lecturesCreated++;
        }
        $currentDate->addDay();
    }
    
    return $currentDate->subDay()->format('Y-m-d');
}

// Download sheet CSV data or use local cached copy
$csvPath = 'C:/Users/MSI/.gemini/antigravity-ide/brain/d5623d00-be66-4c8b-b1ce-6cf132b711be/.system_generated/steps/1118/content.md';
if (!file_exists($csvPath)) {
    echo "Downloading sheet data...\n";
    $csvContent = file_get_contents($googleSheetUrl);
    if ($csvContent === false) {
        die("Error: Unable to fetch Google Sheet data.\n");
    }
    file_put_contents('temp_import.csv', $csvContent);
    $csvPath = 'temp_import.csv';
}

// ----------------------------------------------------
// FIRST PASS: Classify Active vs. Old Trainers
// ----------------------------------------------------
echo "Analyzing sheet data to classify trainers...\n";
$handle = fopen($csvPath, 'r');
if (!$handle) die("Unable to open CSV file.\n");

$headers = null;
while (($row = fgetcsv($handle)) !== FALSE) {
    if (isset($row[1]) && trim($row[1]) === 'اسم المتدرب') {
        $headers = $row;
        break;
    }
}
if (!$headers) {
    die("Header row not found in CSV!\n");
}

$sheetTrainersMaxDate = [];
while (($row = fgetcsv($handle)) !== FALSE) {
    if (count($row) < 15) continue;
    $studentName = trim($row[1]);
    $trainerName = normalizeTrainerName($row[4]);
    $startDateStr = trim($row[8]);
    
    if (empty($studentName) 
        || mb_strpos($studentName, 'حذف') !== false 
        || mb_strpos($studentName, 'مكرر') !== false
        || empty($trainerName)
        || mb_strpos($trainerName, 'بانتظار') !== false
        || mb_strpos($trainerName, 'waiting') !== false
    ) {
        continue;
    }
    
    $startDate = parseDate($startDateStr);
    if (!$startDate) {
        $startDate = parseDate(trim($row[0])); // timestamp fallback
    }
    
    if (!$startDate) continue;
    
    if (!isset($sheetTrainersMaxDate[$trainerName])) {
        $sheetTrainersMaxDate[$trainerName] = $startDate;
    } else {
        if ($startDate > $sheetTrainersMaxDate[$trainerName]) {
            $sheetTrainersMaxDate[$trainerName] = $startDate;
        }
    }
}
fclose($handle);

// Classify
$activeTrainersThreshold = '2026-05-23'; // 3 months before today
$activeTrainers = [];
$oldTrainers = [];
foreach ($sheetTrainersMaxDate as $name => $latestDate) {
    if ($latestDate >= $activeTrainersThreshold) {
        $activeTrainers[$name] = $latestDate;
    } else {
        $oldTrainers[$name] = $latestDate;
    }
}

echo "Trainers Classification Summary:\n";
echo "Total Unique Trainers: " . count($sheetTrainersMaxDate) . "\n";
echo "Active Trainers: " . count($activeTrainers) . "\n";
echo "Old/Inactive Trainers (Will NOT have profiles created): " . count($oldTrainers) . "\n\n";

// ----------------------------------------------------
// SECOND PASS: Import Courses & Students
// ----------------------------------------------------
echo "Starting import process...\n";
$handle = fopen($csvPath, 'r');
while (($row = fgetcsv($handle)) !== FALSE) {
    if (isset($row[1]) && trim($row[1]) === 'اسم المتدرب') {
        break;
    }
}

$rowCount = 0;
$importedCount = 0;
$skippedCount = 0;
$duplicateCount = 0;

$dryRunTrainers = [];
$dryRunStudents = [];
$newTrainersCount = 0;
$newStudentsCount = 0;
$simulatedCourses = [];

// Start Transaction
DB::beginTransaction();

try {
    while (($row = fgetcsv($handle)) !== FALSE) {
        $rowCount++;
        if (count($row) < 15) {
            $skippedCount++;
            continue;
        }

        $timestamp = trim($row[0]);
        $studentName = trim($row[1]);
        $partnerName = trim($row[2]);
        $timeStr = trim($row[3]);
        $trainerName = normalizeTrainerName($row[4]);
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
        $subSource = trim($row[15] ?? '');

        if (empty($studentName) 
            || mb_strpos($studentName, 'حذف') !== false 
            || mb_strpos($studentName, 'مكرر') !== false
            || empty($trainerName)
            || mb_strpos($trainerName, 'بانتظار') !== false
            || mb_strpos($trainerName, 'waiting') !== false
        ) {
            $skippedCount++;
            continue;
        }

        $startDate = parseDate($startDateStr);
        if (!$startDate) {
            $startDate = parseDate($timestamp);
        }
        if (!$startDate) {
            $startDate = now()->toDateString();
        }

        // Trainer classification
        $isTrainerActive = isset($activeTrainers[$trainerName]);

        $trainerId = null;
        if ($isTrainerActive) {
            // Find existing trainer or create active trainer
            if (array_key_exists($trainerName, $dryRunTrainers)) {
                $trainerId = $dryRunTrainers[$trainerName];
            } else {
                $trainerUser = User::where('role', 'trainer')->get()->first(function ($u) use ($trainerName) {
                    $n1 = mb_strtolower(trim($u->name));
                    $n1 = str_replace(['أ', 'إ', 'آ'], 'ا', $n1);
                    $n1 = str_replace('ة', 'ه', $n1);
                    $n1 = str_replace('ى', 'ي', $n1);
                    $n1 = str_replace([' ', '-', '_'], '', $n1);

                    $n2 = mb_strtolower(trim($trainerName));
                    $n2 = str_replace(['أ', 'إ', 'آ'], 'ا', $n2);
                    $n2 = str_replace('ة', 'ه', $n2);
                    $n2 = str_replace('ى', 'ي', $n2);
                    $n2 = str_replace([' ', '-', '_'], '', $n2);

                    return $n1 === $n2;
                });

                if (!$trainerUser) {
                    $email = strtolower(str_replace([' ', '-'], '', $trainerName)) . '_' . time() . '@letspeak.online';
                    if ($isLive) {
                        $trainerUser = User::create([
                            'name' => $trainerName,
                            'email' => $email,
                            'password' => bcrypt('12345678'),
                            'role' => 'trainer',
                            'status' => 'active',
                        ]);
                    } else {
                        $trainerUser = new User();
                        $trainerUser->id = 9999 + $newTrainersCount;
                        $trainerUser->name = $trainerName;
                        $trainerUser->email = $email;
                    }
                    $newTrainersCount++;
                }

                if ($trainerUser) {
                    $trainer = Trainer::where('user_id', $trainerUser->id)->first();
                    if (!$trainer) {
                        if ($isLive) {
                            $trainer = Trainer::create([
                                'user_id' => $trainerUser->id,
                                'min_level' => 'L1',
                                'max_level' => 'L6',
                                'status' => 'active',
                            ]);
                        } else {
                            $trainer = new Trainer();
                            $trainer->id = $trainerUser->id;
                            $trainer->user_id = $trainerUser->id;
                        }
                    }
                    $trainerId = $trainer->id;
                    $dryRunTrainers[$trainerName] = $trainerId;
                }
            }
        }

        // Process Students
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
                    if ($isLive) {
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
                
                if ($isLive) {
                    $lead = Lead::where('name', 'like', $sName)->first();
                    if ($lead && $lead->status !== 'confirmed') {
                        $lead->status = 'confirmed';
                        $lead->save();
                    }
                }
            }
        }

        // Duplicate Check
        $dup = checkDuplicateCourse($studentIds, $startDate, $simulatedCourses);
        if ($dup) {
            $duplicateCount++;
            continue;
        }

        // 5. Parse Status according to refined business rules
        $status = 'active';
        $statusStrLower = strtolower(trim($statusStr));
        
        if (strpos($statusStrLower, 'finish') !== false 
            || strpos($statusStr, 'تم') !== false 
            || strpos($statusStr, 'مكتمل') !== false 
            || strpos($statusStr, 'منتهي') !== false
        ) {
            $status = 'finished';
        } elseif (strpos($statusStrLower, 'pause') !== false 
            || strpos($statusStr, 'مأجل') !== false 
            || strpos($statusStr, 'مؤجل') !== false 
            || strpos($statusStr, 'متوقف') !== false
        ) {
            $status = 'paused';
        } elseif (strpos($statusStrLower, 'cancel') !== false 
            || strpos($statusStr, 'ملغي') !== false 
            || strpos($statusStr, 'ملغى') !== false
        ) {
            $status = 'cancelled';
        } elseif (strpos($statusStrLower, 'active') !== false 
            || strpos($statusStr, 'نشط') !== false 
            || strpos($statusStr, 'جاري') !== false 
            || strpos($statusStr, 'مستمر') !== false
        ) {
            $status = 'active';
        } else {
            // Unrecorded / 'Paid' historical status: Rely on start date
            $thresholdDate = Carbon::now()->subDays(60)->toDateString();
            if ($startDate < $thresholdDate) {
                $status = 'finished';
            } else {
                $status = 'active';
            }
        }

        // Parse Amounts & Package Splitting
        $totalAmount = cleanAmount($amountUpdates);
        $amountPaid = cleanAmount($amountPaidStr);

        $isDual = count($studentIds) > 1;
        $isKids = (strpos(strtolower($courseType), 'أطفال') !== false || strpos(strtolower($courseType), 'kids') !== false);

        $splitInfo = determineLecturesAndSplits($courseType, $amountPaid, $isDual, $isKids);
        $rounds = $splitInfo['rounds'];
        $baseLectures = $splitInfo['base_lectures'];
        $packageId = $splitInfo['package_id'];
        $singlePrice = $splitInfo['single_price'];

        $remainingPaid = $amountPaid;
        $remainingTotal = $totalAmount > 0 ? $totalAmount : ($singlePrice * $rounds);

        $currentRoundStartDate = $startDate;
        $lectureTime = parseTime($timeStr);
        $lectureDays = parseArabicDays($daysStr);
        if (empty($lectureDays)) {
            $lectureDays = ['sun', 'tue', 'thu'];
        }

        // Note decoration: add old trainer info if trainer is old and set to null
        $decoratedNotes = (!empty($notes) ? $notes : "");
        if (!empty($prevTrainer)) {
            $decoratedNotes .= (empty($decoratedNotes) ? "" : " | ") . "كان مع المدرب: $prevTrainer";
        }
        if (!$isTrainerActive) {
            $decoratedNotes .= (empty($decoratedNotes) ? "" : " | ") . "[المدرب التاريخي: $trainerName]";
        }

        // Generate Split Courses
        for ($r = 1; $r <= $rounds; $r++) {
            $roundTitle = "كورس " . implode(' & ', $studentNamesToProcess);
            if ($rounds > 1) {
                $roundTitle .= " (جزء $r)";
            }

            $roundTotal = min($remainingTotal, $singlePrice);
            $roundPaid = min($remainingPaid, $roundTotal);

            $remainingTotal -= $roundTotal;
            $remainingPaid -= $roundPaid;

            $courseData = [
                'trainer_id' => $trainerId,
                'course_package_id' => $packageId,
                'title' => $roundTitle,
                'lectures_count' => $baseLectures,
                'start_date' => $currentRoundStartDate,
                'lecture_time' => $lectureTime,
                'lecture_days' => $lectureDays,
                'status' => $status,
                'trainer_payment_status' => ($status === 'finished' ? 'paid' : 'unpaid'),
                'finished_at' => ($status === 'finished' ? ($currentRoundStartDate . ' 23:59:59') : null),
                'payment_method' => !empty($paymentMethod) ? $paymentMethod : 'cash',
                'subscription_source' => !empty($subSource) ? $subSource : 'direct',
                'total_amount' => $roundTotal,
                'amount_paid' => $roundPaid,
                'notes' => $decoratedNotes,
                'is_dual' => $isDual,
                'is_kids' => $isKids,
            ];

            if ($isLive) {
                $course = Course::create($courseData);
                
                foreach ($studentIds as $index => $sId) {
                    $course->students()->attach($sId, [
                        'is_primary' => $index === 0,
                        'student_level' => !empty($level) ? $level : 'L1',
                    ]);
                }
                
                $endDate = generateLectureSchedule($course, true);
                
                if ($roundPaid > 0) {
                    Payment::create([
                        'course_id' => $course->id,
                        'student_id' => $studentIds[0],
                        'amount' => $roundPaid,
                        'payment_method' => !empty($paymentMethod) ? $paymentMethod : 'cash',
                        'status' => 'completed',
                        'payment_date' => $currentRoundStartDate,
                        'notes' => 'دفعة مستوردة من شيت الإكسل',
                    ]);
                }
            } else {
                $courseMock = new Course($courseData);
                $endDate = generateLectureSchedule($courseMock, false);
            }

            $simulatedCourses[] = [
                'student_ids' => $studentIds,
                'start_date' => $courseData['start_date'],
            ];

            $currentRoundStartDate = Carbon::parse($endDate)->addDay()->format('Y-m-d');
            $importedCount++;
        }
    }

    if ($isLive) {
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

if (isset($tempFile) && file_exists($tempFile)) {
    @unlink($tempFile);
}

echo "\n--- IMPORT SUMMARY ---\n";
echo "Total Rows Parsed: {$rowCount}\n";
echo "Successfully Mapped Course Terms: {$importedCount}\n";
echo "Skipped Rows (Empty/Trash): {$skippedCount}\n";
echo "Skipped Duplicates: {$duplicateCount}\n";
echo "New Active Trainers Created: {$newTrainersCount}\n";
echo "New Students Created: {$newStudentsCount}\n";
echo "==================================================\n";
