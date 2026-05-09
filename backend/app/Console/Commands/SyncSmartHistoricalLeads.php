<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Lead;
use Carbon\Carbon;

class SyncSmartHistoricalLeads extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'leads:sync-smart';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Smart sync from forms.json and confirmed_students.json';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $formsPath = base_path('forms.json');
        $confirmedPath = base_path('confirmed_students.json');

        if (!file_exists($formsPath)) {
            $this->warn("forms.json not found in " . base_path() . ", skipping step 1.");
        } else {
            // STEP 1: IMPORT FROM FORMS.JSON
            $this->info("Parsing forms.json...");
            $formsData = json_decode(file_get_contents($formsPath), true);
            
            $formsRows = [];
            foreach ($formsData as $item) {
                if (isset($item['type']) && $item['type'] === 'table' && isset($item['data'])) {
                    $formsRows = $item['data'];
                    break;
                }
            }

            if (empty($formsRows)) {
                $this->error("No data rows found in forms.json!");
            } else {
                $this->info("Found " . count($formsRows) . " leads in forms.json. Importing...");

                $bar = $this->output->createProgressBar(count($formsRows));
                $bar->start();

                $imported = 0;
                $skipped = 0;

        foreach ($formsRows as $row) {
            $phone = trim($row['whatsapp'] ?? '');
            if (empty($phone)) {
                $phone = '0000000000';
            }

            $name = trim($row['full_name'] ?? 'بدون اسم');
            
            // Check if already imported
            $existing = Lead::where('phone_whatsapp', $phone)
                ->when($phone === '0000000000', function ($q) use ($name) {
                    $q->where('name', $name);
                })
                ->first();

            if ($existing) {
                // Skip if duplicate
                $skipped++;
                $bar->advance();
                continue;
            }

            $createdAt = now();
            if (!empty($row['submission_time'])) {
                try {
                    $createdAt = Carbon::parse($row['submission_time']);
                } catch (\Exception $e) {}
            }

            $notes = [];
            if (!empty($row['education_level'])) $notes[] = "المستوى التعليمي: " . $row['education_level'];
            if (!empty($row['specialization'])) $notes[] = "التخصص: " . $row['specialization'];
            if (!empty($row['learning_reason'])) $notes[] = "سبب التعلم: " . $row['learning_reason'];
            if (!empty($row['payment_method'])) $notes[] = "طريقة الدفع المفضلة: " . $row['payment_method'];

            Lead::create([
                'name' => $name,
                'email' => $row['email'] ?? null,
                'phone_whatsapp' => $phone,
                'telegram_id' => $row['telegram'] ?? null,
                'governorate' => $row['city'] ?? null,
                'age' => $row['age'] ?? null,
                'gender' => isset($row['gender']) ? ($row['gender'] === '???' ? 'male' : ($row['gender'] === '????' ? 'female' : null)) : null,
                'package_selected' => $row['package'] ?? null,
                'preferred_time' => $row['suitable_time'] ?? null,
                'current_level' => $row['english_level'] ?? null,
                'source' => $row['how_heard'] ?? 'legacy_sync',
                'status' => 'new',
                'notes' => implode("\n", $notes),
                'intro_date' => clone $createdAt,
                'created_at' => clone $createdAt,
                'updated_at' => clone $createdAt,
            ]);

            $imported++;
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();
        $this->info("Imported $imported, Skipped duplicates: $skipped");
            }
        }

        // STEP 2: UPDATE FROM CONFIRMED_STUDENTS.JSON
        if (file_exists($confirmedPath)) {
            $this->info("Parsing confirmed_students.json...");
            $confData = json_decode(file_get_contents($confirmedPath), true);
            
            $confRows = [];
            foreach ($confData as $item) {
                if (isset($item['type']) && $item['type'] === 'table' && isset($item['data'])) {
                    $confRows = $item['data'];
                    break;
                }
            }

            $this->info("Found " . count($confRows) . " confirmed students. Updating statuses...");
            
            $updated = 0;
            $notFound = 0;

            $bar2 = $this->output->createProgressBar(count($confRows));
            $bar2->start();

            foreach ($confRows as $crow) {
                $cName = trim($crow['trainee_name'] ?? '');
                if (!$cName) {
                    $bar2->advance();
                    continue;
                }

                // Find lead by exact name
                $lead = Lead::where('name', $cName)->first();
                if (!$lead) {
                    $notFound++;
                    $bar2->advance();
                    continue;
                }

                // Update to confirmed
                $lead->status = 'confirmed';
                $lead->trainer_name = trim($crow['trainer_name'] ?? '');
                
                $cNotes = [];
                $cNotes[] = "--- تم التأكيد ---";
                if (!empty($crow['course_type'])) $cNotes[] = "نوع الكورس المؤكد: " . $crow['course_type'];
                if (!empty($crow['amount_paid'])) $cNotes[] = "المبلغ المدفوع: " . $crow['amount_paid'];
                if (!empty($crow['class_time'])) $cNotes[] = "وقت المحاضرة: " . $crow['class_time'];
                if (!empty($crow['days'])) $cNotes[] = "الأيام: " . $crow['days'];
                if (!empty($crow['payment_method'])) $cNotes[] = "طريقة الدفع (المؤكدة): " . $crow['payment_method'];
                if (!empty($crow['notes'])) $cNotes[] = "ملاحظات الدفع: " . $crow['notes'];

                $lead->notes = ($lead->notes ? $lead->notes . "\n\n" : "") . implode("\n", $cNotes);
                $lead->save();

                $updated++;
                $bar2->advance();
            }

            $bar2->finish();
            $this->newLine();
            $this->info("Updated $updated leads to 'confirmed'. Not found in forms: $notFound");
        } else {
            $this->warn("confirmed_students.json not found, skipping step 2.");
        }

        // STEP 3: LINK EXISTING STUDENTS TO LEADS
        $this->info("Linking existing students to leads...");
        $studentsToLink = \App\Models\Student::whereNull('lead_id')->get();
        $this->info("Found " . count($studentsToLink) . " students without lead_id.");
        
        $linked = 0;
        if (count($studentsToLink) > 0) {
            $allLeads = Lead::all();
            $bar3 = $this->output->createProgressBar(count($studentsToLink));
            $bar3->start();

            foreach ($studentsToLink as $student) {
                $foundLead = null;
                $sPhone = preg_replace('/[^0-9]/', '', $student->phone);
                $sName = trim(strtolower($student->name));

                foreach ($allLeads as $lead) {
                    // Try phone match
                    $lPhone = preg_replace('/[^0-9]/', '', $lead->phone_whatsapp);
                    
                    if (strlen($sPhone) >= 7 && strlen($lPhone) >= 7) {
                        if (substr($sPhone, -7) === substr($lPhone, -7)) {
                            $foundLead = $lead;
                            break;
                        }
                    }
                    
                    // Try name match
                    $lName = trim(strtolower($lead->name));
                    if ($sName && $lName && (str_contains($sName, $lName) || str_contains($lName, $sName))) {
                        if (strlen($sName) > 4 && strlen($lName) > 4) {
                            $foundLead = $lead;
                            break;
                        }
                    }
                }

                if ($foundLead) {
                    $student->lead_id = $foundLead->id;
                    $student->save();
                    $linked++;
                }
                $bar3->advance();
            }
            $bar3->finish();
            $this->newLine();
            $this->info("Successfully linked $linked students to their leads.");
        }

        return Command::SUCCESS;
    }
}
