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
echo "LetSpeak Google Sheet Importer V2\n";
echo "Mode: " . ($isLive ? "LIVE IMPORT (Changes will be saved)" : "DRY RUN (No database changes will be saved)") . "\n";
echo "==================================================\n\n";

$googleSheetUrl = 'https://docs.google.com/spreadsheets/d/1db0NYPAOunswRyxOMfprGcU-zCfUfMBsxZfKbMcpLAY/export?format=csv&gid=556864345';

// Helper parsers
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
        // Kids Packages:
        // 1. Speed (السرعة): 20 lectures / 300,000 IQD
        // 2. Balance (التوازن): 12 lectures / 180,000 IQD
        if (mb_strpos($pkg, 'سرعة') !== false || mb_strpos($pkg, 'السرعة') !== false || mb_strpos($pkg, 'speed') !== false || (abs($amountPaid - 300000) < 20000)) {
            $baseLectures = 20;
            $singlePrice = 300000;
            $packageId = null; // Custom 20 lectures course
        } else {
            $baseLectures = 12;
            $singlePrice = 180000;
            $packageId = 1; // Speed Package (12 lectures in database)
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
    
    // Calculate split rounds
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
    
    // 1. Check in-memory simulated courses
    foreach ($simulatedCourses as $sc) {
        $commonStudents = array_intersect($studentIds, $sc['student_ids']);
        if (!empty($commonStudents)) {
            $scDate = Carbon::parse($sc['start_date']);
            if ($scDate->between($minDate, $maxDate)) {
                return true;
            }
        }
    }
    
    // 2. Check in database
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
            if ($course->status === 'finished') {
                $attendance = 'present';
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
                ]);
            }
            $lecturesCreated++;
        }
        $currentDate->addDay();
    }
    
    return $currentDate->subDay()->format('Y-m-d');
}

// Fetch CSV from sheet
echo "Fetching CSV data from Google Sheet...\n";
$csvContent = @file_get_contents($googleSheetUrl);
if ($csvContent === false) {
    die("Error: Unable to fetch Google Sheet data.\n");
}

$tempFile = tempnam(sys_get_temp_dir(), 'import_v2_');
file_put_contents($tempFile, $csvContent);

$handle = fopen($tempFile, 'r');
if ($handle === false) {
    die("Error: Unable to open temporary CSV file.\n");
}

// Read Header from Row 0
$headers = fgetcsv($handle);
echo "Headers parsed successfully.\n\n";

$rowCount = 0;
$importedCount = 0;
$skippedCount = 0;
$duplicateCount = 0;
$dateFilteredCount = 0;

// Caches to track simulation IDs for Dry Run
$dryRunTrainers = [];
$dryRunStudents = [];
$newTrainersCount = 0;
$newStudentsCount = 0;

$simulatedCourses = [];

// Start DB transaction
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

        // Skip rows with no student name, or marked deleted/duplicate in the sheet, OR if trainer is waiting/empty
        if (empty($studentName) 
            || mb_strpos($studentName, 'حذف') !== false 
            || mb_strpos($studentName, 'مكرر') !== false
            || mb_strpos($studentName, 'مكتمل و منتهي') !== false
            || empty($trainerName)
            || mb_strpos($trainerName, 'بانتظار') !== false
            || mb_strpos($trainerName, 'waiting') !== false
        ) {
            $skippedCount++;
            continue;
        }

        // 1. Check Date Range: Skip courses starting from 2026-08-01 onwards
        $startDate = parseDate($startDateStr);
        if (!$startDate) {
            $startDate = parseDate($timestamp);
        }
        if (!$startDate) {
            $startDate = now()->toDateString();
        }

        if ($startDate >= '2026-09-01') {
            $dateFilteredCount++;
            continue;
        }

        // 2. Process Trainer
        $trainerId = null;
        $courseTrainerNameColumn = null;
        if (!empty($trainerName)) {
            if (array_key_exists($trainerName, $dryRunTrainers)) {
                $trainerId = $dryRunTrainers[$trainerName];
                if ($trainerId === null) {
                    $courseTrainerNameColumn = $trainerName;
                }
            } else {
                // Find active/existing trainers from users table
                $allTrainerUsers = User::where('role', 'trainer')->get();
                $words = preg_split('/\s+/', trim($trainerName));
                $isSingleWord = (count($words) === 1);
                
                $trainerUser = $allTrainerUsers->first(function ($u) use ($trainerName) {
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
                
                // If single-word, ensure it is not ambiguous
                if ($trainerUser && $isSingleWord) {
                    $matchingFirstNames = $allTrainerUsers->filter(function ($u) use ($trainerName) {
                        $firstWord = preg_split('/\s+/', trim($u->name))[0];
                        $n1 = mb_strtolower(trim($firstWord));
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
                    
                    if ($matchingFirstNames->count() > 1) {
                        $trainerUser = null; // Ambiguous match, do not associate
                    }
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
                } else {
                    // Trainer not found or ambiguous: set trainer_id = null and store the sheet name as courseTrainerNameColumn
                    $courseTrainerNameColumn = $trainerName;
                    $dryRunTrainers[$trainerName] = null;
                }
            }
        }

        // 3. Process Students
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

                // Find and update lead status to confirmed
                if ($isLive) {
                    $lead = Lead::where('name', 'like', $sName)->first();
                    if ($lead && $lead->status !== 'confirmed') {
                        $lead->status = 'confirmed';
                        $lead->save();
                    }
                }
            }
        }

        // 4. Duplicate Check: Prevent duplicate import based on student & date overlap
        $dup = checkDuplicateCourse($studentIds, $startDate, $simulatedCourses);
        if ($dup) {
            $duplicateCount++;
            continue;
        }

        // 5. Parse Status
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

        // 6. Parse Amounts & Package Splitting
        $totalAmount = cleanAmount($amountUpdates);
        $amountPaid = cleanAmount($amountPaidStr);

        $isDual = count($studentIds) > 1;
        $isKids = (strpos(strtolower($courseType), 'أطفال') !== false || strpos(strtolower($courseType), 'kids') !== false);

        // Call our splitter logic
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

        // Note decoration
        $decoratedNotes = (!empty($notes) ? $notes : "");
        if (!empty($prevTrainer)) {
            $decoratedNotes .= (empty($decoratedNotes) ? "" : " | ") . "كان مع المدرب: $prevTrainer";
        }

        // Generate Split Courses
        for ($r = 1; $r <= $rounds; $r++) {
            $roundTitle = "كورس " . implode(' & ', $studentNamesToProcess);
            if ($rounds > 1) {
                $roundTitle .= " (جزء $r)";
            }

            // Distribute amounts for this round
            $roundTotal = min($remainingTotal, $singlePrice);
            $roundPaid = min($remainingPaid, $roundTotal);

            $remainingTotal -= $roundTotal;
            $remainingPaid -= $roundPaid;

            // Determine status of split round
            $roundStatus = $status;
            if ($status === 'finished') {
                $roundStatus = 'finished';
            }

            $courseData = [
                'trainer_id' => $trainerId,
                'trainer_name' => $courseTrainerNameColumn,
                'course_package_id' => $packageId,
                'title' => $roundTitle,
                'lectures_count' => $baseLectures,
                'start_date' => $currentRoundStartDate,
                'lecture_time' => $lectureTime,
                'lecture_days' => $lectureDays,
                'status' => $roundStatus,
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
                // Simulate end date calculation
                $courseMock = new Course($courseData);
                $endDate = generateLectureSchedule($courseMock, false);
            }

            // Save to in-memory list to prevent duplicates in the same run
            $simulatedCourses[] = [
                'student_ids' => $studentIds,
                'start_date' => $courseData['start_date'],
            ];

            // Set the start date for the next round to be 1 day after the current round's end date
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

@unlink($tempFile);

echo "\n--- IMPORT SUMMARY ---\n";
echo "Total Rows Parsed: {$rowCount}\n";
echo "Successfully Mapped Course Terms: {$importedCount}\n";
echo "Skipped Rows (Empty/Trash): {$skippedCount}\n";
echo "Skipped Duplicates: {$duplicateCount}\n";
echo "Skipped Post-August 2026: {$dateFilteredCount}\n";
echo "New Trainers Created: {$newTrainersCount}\n";
echo "New Students Created: {$newStudentsCount}\n";
echo "==================================================\n";
?>
