<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Lecture;
use Carbon\Carbon;

$googleSheetUrl = 'https://docs.google.com/spreadsheets/d/1db0NYPAOunswRyxOMfprGcU-zCfUfMBsxZfKbMcpLAY/export?format=csv&gid=556864345';

echo "Fetching CSV data from Google Sheet...\n";
$csvContent = file_get_contents($googleSheetUrl);
if ($csvContent === false) {
    die("Error: Unable to fetch Google Sheet data.\n");
}

$tempFile = tempnam(sys_get_temp_dir(), 'import_sheet_');
file_put_contents($tempFile, $csvContent);

$handle = fopen($tempFile, 'r');

// Skip header rows
for ($i = 0; $i < 9; $i++) {
    fgetcsv($handle);
}

function parseDate($str) {
    if (empty($str)) return null;
    $str = trim($str);
    try {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $str)) {
            return $str;
        }
        $formats = ['d/m/Y', 'Y/m/d', 'm/d/Y', 'd-m-Y', 'Y-m-d'];
        foreach ($formats as $f) {
            try {
                $d = Carbon::createFromFormat($f, $str);
                if ($d) return $d->format('Y-m-d');
            } catch (\Exception $e) {}
        }
        $d = Carbon::parse($str);
        if ($d) return $d->format('Y-m-d');
    } catch (\Exception $e) {}
    return null;
}

$updatedToFinished = 0;
$updatedToPaused = 0;
$notFound = 0;
$totalRows = 0;

echo "Processing rows...\n";

// Start Transaction
DB::beginTransaction();

try {
    while (($row = fgetcsv($handle)) !== FALSE) {
        if (count($row) < 11) continue;
        $totalRows++;

        $timestamp = trim($row[0]);
        $studentName = trim($row[1]);
        $partnerName = trim($row[2]);
        $statusStr = trim($row[10]);
        $startDateStr = trim($row[8]);

        if (empty($studentName) || strpos($studentName, 'حذف') !== false || strpos($studentName, 'مكرر') !== false) {
            continue;
        }

        $startDate = parseDate($startDateStr);
        if (!$startDate) {
            $startDate = parseDate($timestamp);
        }
        if (!$startDate) {
            continue;
        }

        $studentNamesToProcess = [$studentName];
        if (!empty($partnerName)) {
            $studentNamesToProcess[] = $partnerName;
        }
        $courseTitle = "كورس " . implode(' & ', $studentNamesToProcess);

        // Find the course in database
        $course = Course::where('title', 'like', $courseTitle)
            ->where('start_date', 'like', $startDate . '%')
            ->first();

        if (!$course) {
            $notFound++;
            continue;
        }

        // Map status from sheet
        $targetStatus = 'active';
        $statusStrLower = strtolower($statusStr);
        
        if (strpos($statusStr, 'تم') !== false 
            || strpos($statusStr, 'مكتمل') !== false 
            || strpos($statusStr, 'مدفوع') !== false 
            || $statusStrLower === 'paid' 
            || $statusStrLower === 'finished'
        ) {
            $targetStatus = 'finished';
        } elseif (strpos($statusStr, 'مأجل') !== false 
            || strpos($statusStr, 'مؤجل') !== false 
            || $statusStrLower === 'paused'
        ) {
            $targetStatus = 'paused';
        } elseif (strpos($statusStr, 'ملغي') !== false 
            || strpos($statusStr, 'ملغى') !== false 
            || $statusStrLower === 'cancelled'
        ) {
            $targetStatus = 'cancelled';
        }

        if ($course->status !== $targetStatus) {
            $oldStatus = $course->status;
            $course->status = $targetStatus;
            $course->save();

            if ($targetStatus === 'finished') {
                $updatedToFinished++;
                // Mark all lectures of this course as completed (present)
                Lecture::where('course_id', $course->id)->update([
                    'attendance' => 'present'
                ]);
            } elseif ($targetStatus === 'paused') {
                $updatedToPaused++;
            }
        }
    }

    DB::commit();
    echo "\nDatabase transaction COMMITTED successfully.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

fclose($handle);
unlink($tempFile);

echo "\n--- DATABASE CORRECTION SUMMARY ---\n";
echo "Total Rows Processed: $totalRows\n";
echo "Courses Updated to Finished: $updatedToFinished\n";
echo "Courses Updated to Paused: $updatedToPaused\n";
echo "Courses Not Found in DB: $notFound\n";
echo "====================================\n";
