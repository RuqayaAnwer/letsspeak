<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use App\Models\Lead;
use Carbon\Carbon;

class SyncHistoricalLeads extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'leads:sync-historical';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync historical leads/customers data from the legacy system (JSON)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $url = 'https://form.letspeak.online/letsregister/data.json';
        $this->info("Fetching data from: {$url}");

        try {
            $response = Http::get($url);
            
            if (!$response->successful()) {
                $this->error("Failed to fetch data. Status Code: " . $response->status());
                return Command::FAILURE;
            }

            $data = $response->json();
            
            if (!is_array($data) || empty($data)) {
                $this->error("No data found or invalid JSON format.");
                return Command::FAILURE;
            }

            $this->info("Found " . count($data) . " records. Starting import...");

            $imported = 0;
            $skipped = 0;

            $bar = $this->output->createProgressBar(count($data));
            $bar->start();

            foreach ($data as $row) {
                // Determine the phone number dynamically
                // Based on user feedback: "رقم الهاتف موجود بالفعل"
                $phone = $row['رقم الهاتف'] ?? $row['Phone'] ?? $row['phone'] ?? $row['phone_whatsapp'] ?? null;
                
                // If it's still null, we use a fallback to ensure DB constraints don't fail, 
                // but since the user confirmed it's there, we expect it to be found.
                if (!$phone) {
                    $phone = '0000000000';
                }

                $name = $row['اسم المتدرب'] ?? $row['Name'] ?? 'بدون اسم';
                
                // Avoid importing duplicate leads based on phone number (if valid) or exact name matching
                $existing = Lead::where('phone_whatsapp', $phone)
                                ->when($phone === '0000000000', function ($q) use ($name) {
                                    $q->where('name', $name);
                                })
                                ->first();

                if ($existing) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }

                // Map old status to new Kanban status
                $oldStatus = strtolower(trim($row['حالة الكورس'] ?? ''));
                $newStatus = 'new';
                if (in_array($oldStatus, ['paid', 'confirmed', 'done'])) {
                    $newStatus = 'confirmed';
                }

                // Parse dates safely
                $createdAt = now();
                if (!empty($row['Timestamp'])) {
                    try {
                        $createdAt = Carbon::parse($row['Timestamp']);
                    } catch (\Exception $e) {
                        // ignore
                    }
                }

                // Create the lead
                Lead::create([
                    'name' => $name,
                    'phone_whatsapp' => $phone,
                    'trainer_name' => $row['اسم المدرب'] ?? null,
                    'intro_time' => $row['الوقت'] ?? null,
                    'current_level' => $row['مستوى المتدرب'] ?? null,
                    'package_selected' => $row['نوع الكورس'] ?? null,
                    'status' => $newStatus,
                    'source' => 'legacy_sync',
                    'notes' => trim(($row['طريقة الدفع'] ?? '') . "\n" . ($row['ملاحظات'] ?? '')),
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);

                $imported++;
                $bar->advance();
            }

            $bar->finish();
            $this->newLine(2);

            $this->info("Import completed successfully!");
            $this->line("<fg=green>Imported:</> {$imported} records");
            $this->line("<fg=yellow>Skipped (Duplicates):</> {$skipped} records");

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error("An error occurred: " . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
