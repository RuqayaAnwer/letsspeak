<?php

namespace App\Services;

use App\Models\Lead;
use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;
use DOMDocument;
use DOMXPath;

class IntroSystemSyncService
{
    protected $client;
    protected $jar;
    protected $baseUrl = 'https://php.letspeak.online/introletspeak';
    protected $username = 'cs_letspeak';
    protected $password = 'aDd@$1min';

    public function __construct()
    {
        $this->jar = new CookieJar();
        $this->client = new Client([
            'allow_redirects' => [
                'max' => 5,
                'referer' => true,
                'track_redirects' => true
            ],
            'cookies' => $this->jar,
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            'timeout' => 15 // Timeout in seconds
        ]);
    }

    /**
     * Authenticate with the intro system.
     */
    protected function login(): bool
    {
        try {
            // 1. Initial GET to set cookies
            $this->client->request('GET', "{$this->baseUrl}/login.php");

            // 2. POST credentials
            $response = $this->client->request('POST', "{$this->baseUrl}/login.php", [
                'form_params' => [
                    'username' => $this->username,
                    'password' => $this->password
                ]
            ]);

            // Check if we are redirected to index.php or if we are still on login page
            $body = $response->getBody()->getContents();
            if (strpos($body, 'name="username"') !== false) {
                Log::error('IntroSystemSync: Login failed - redirected back to login form.');
                return false;
            }

            Log::info('IntroSystemSync: Authenticated successfully.');
            return true;
        } catch (\Exception $e) {
            Log::error('IntroSystemSync: Login exception: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Query student details (phone/email) from the API.
     */
    public function searchStudentExternal(string $name): ?array
    {
        try {
            $response = $this->client->request('GET', "{$this->baseUrl}/get_students.php", [
                'query' => ['q' => $name]
            ]);
            
            $data = json_decode($response->getBody()->getContents(), true);
            if (isset($data['success']) && $data['success'] && !empty($data['students'])) {
                // Find the best match or return the first one
                foreach ($data['students'] as $student) {
                    if (trim($student['name']) === trim($name)) {
                        return $student;
                    }
                }
                return $data['students'][0];
            }
        } catch (\Exception $e) {
            Log::warning("IntroSystemSync: Failed to query details for student '{$name}': " . $e->getMessage());
        }
        return null;
    }

    /**
     * Run the full sync process.
     */
    public function sync(int $historyLimit = 100): array
    {
        $stats = [
            'scraped_upcoming' => 0,
            'scraped_history' => 0,
            'imported' => 0,
            'updated' => 0,
            'errors' => []
        ];

        // 1. Log in
        if (!$this->login()) {
            $stats['errors'][] = 'Authentication failed';
            return $stats;
        }

        // Keep local cache of student API lookups during this single execution
        $studentLookupCache = [];

        // 2. Sync upcoming/current lectures (lectures.php)
        try {
            Log::info('IntroSystemSync: Fetching lectures.php...');
            $response = $this->client->request('GET', "{$this->baseUrl}/lectures.php");
            $html = $response->getBody()->getContents();
            
            libxml_use_internal_errors(true);
            $dom = new DOMDocument();
            $dom->loadHTML($html);
            libxml_clear_errors();
            $xpath = new DOMXPath($dom);

            $cards = $xpath->query('//div[contains(@class, "lecture-card")]');
            $stats['scraped_upcoming'] = $cards->length;

            Log::info("IntroSystemSync: Found {$cards->length} upcoming lecture cards.");

            for ($i = 0; $i < $cards->length; $i++) {
                $card = $cards->item($i);
                
                // Student Name
                $titleNodes = $xpath->query('.//div[contains(@class, "lecture-title")]', $card);
                $studentName = $titleNodes->length > 0 ? trim($titleNodes->item(0)->nodeValue) : '';
                if (empty($studentName)) continue;

                // Time
                $timeNodes = $xpath->query('.//div[contains(@class, "lecture-time")]', $card);
                $time = $timeNodes->length > 0 ? trim($timeNodes->item(0)->nodeValue) : '';

                // Details (Trainer, Date, Package, Level, Status)
                $detailItems = $xpath->query('.//div[contains(@class, "detail-item")]', $card);
                $details = [];
                foreach ($detailItems as $item) {
                    $details[] = trim(preg_replace('/\s+/', ' ', $item->nodeValue));
                }

                // Notes & Phone
                $notesNodes = $xpath->query('.//div[contains(@class, "lecture-notes")]', $card);
                $notesText = $notesNodes->length > 0 ? trim(preg_replace('/\s+/', ' ', $notesNodes->item(0)->nodeValue)) : '';

                // Parse details array
                $trainerName = '';
                $introDate = null;
                $package = '';
                $level = '';
                $statusStr = 'مجدولة';

                foreach ($details as $detail) {
                    if (strpos($detail, 'المدرب:') !== false) {
                        $trainerName = trim(str_replace('المدرب:', '', $detail));
                    } elseif (strpos($detail, 'التاريخ:') !== false) {
                        // Extract YYYY/MM/DD
                        $rawDate = trim(str_replace('التاريخ:', '', $detail));
                        if (preg_match('/([0-9]{4}\/[0-9]{2}\/[0-9]{2})/', $rawDate, $dateMatches)) {
                            $introDate = str_replace('/', '-', $dateMatches[1]);
                        }
                    } elseif (strpos($detail, 'الباقة:') !== false) {
                        $package = trim(str_replace('الباقة:', '', $detail));
                    } elseif (strpos($detail, 'المستوى:') !== false) {
                        $level = trim(str_replace('المستوى:', '', $detail));
                    } elseif (strpos($detail, 'الحالة:') !== false) {
                        $statusStr = trim(str_replace('الحالة:', '', $detail));
                    }
                }

                // Clean up notes text prefix
                $notesClean = trim(preg_replace('/^ملاحظات:\s*/u', '', $notesText));

                // Parse phone number from notes
                $phone = null;
                if (preg_match('/(?:هاتف|رقم|واتساب|phone|whatsapp)\s*[:\-]?\s*(\+?[0-9][0-9\s-]{7,15})/ui', $notesClean, $phoneMatches)) {
                    $phone = preg_replace('/[^0-9+]/', '', $phoneMatches[1]);
                }

                // If no phone found in notes, search via API
                $email = null;
                if (empty($phone)) {
                    if (!isset($studentLookupCache[$studentName])) {
                        $studentDetails = $this->searchStudentExternal($studentName);
                        $studentLookupCache[$studentName] = $studentDetails;
                    }
                    if (!empty($studentLookupCache[$studentName])) {
                        $phone = $studentLookupCache[$studentName]['whatsapp'] ?? null;
                        $email = $studentLookupCache[$studentName]['email'] ?? null;
                        if (!empty($studentLookupCache[$studentName]['package']) && empty($package)) {
                            $package = $studentLookupCache[$studentName]['package'];
                        }
                    }
                }

                $this->saveOrUpdateLead([
                    'name' => $studentName,
                    'phone_whatsapp' => $phone ?? '0000000000',
                    'email' => $email,
                    'trainer_name' => $trainerName,
                    'intro_date' => $introDate,
                    'intro_time' => $time,
                    'package_selected' => $package,
                    'current_level' => $level,
                    'attendance_status' => $statusStr,
                    'notes' => $notesClean,
                    'source' => 'نظام التعريفيات'
                ], $stats);
            }
        } catch (\Exception $e) {
            $stats['errors'][] = 'Scraping lectures failed: ' . $e->getMessage();
            Log::error('IntroSystemSync: lectures.php error: ' . $e->getMessage());
        }

        // 3. Sync history lectures (lecture_history.php)
        try {
            Log::info('IntroSystemSync: Fetching lecture_history.php...');
            $response = $this->client->request('GET', "{$this->baseUrl}/lecture_history.php");
            $html = $response->getBody()->getContents();

            libxml_use_internal_errors(true);
            $dom = new DOMDocument();
            $dom->loadHTML($html);
            libxml_clear_errors();
            $xpath = new DOMXPath($dom);

            $rows = $xpath->query('//table[@class="lectures-table"]//tbody/tr');
            $stats['scraped_history'] = min($historyLimit, $rows->length);

            Log::info("IntroSystemSync: Found {$rows->length} history rows. Limiting sync to {$stats['scraped_history']}.");

            for ($i = 0; $i < $stats['scraped_history']; $i++) {
                $row = $rows->item($i);
                
                // Skip header or invalid row
                $tds = $xpath->query('.//td', $row);
                if ($tds->length < 7) continue;

                // Cell 0: Date
                $dateText = trim($tds->item(0)->nodeValue);
                $introDate = null;
                if (preg_match('/([0-9]{4}\/[0-9]{2}\/[0-9]{2})/', $dateText, $dateMatches)) {
                    $introDate = str_replace('/', '-', $dateMatches[1]);
                }

                // Cell 1: Time
                $time = trim($tds->item(1)->nodeValue);

                // Cell 2: Student Name
                $studentName = trim($tds->item(2)->nodeValue);
                if (empty($studentName)) continue;

                // Cell 3: Trainer
                $trainerName = trim($tds->item(3)->nodeValue);

                // Cell 4: Package
                $package = trim($tds->item(4)->nodeValue);

                // Cell 5: Level
                $level = trim($tds->item(5)->nodeValue);

                // Cell 6: Status
                $statusStr = trim($tds->item(6)->nodeValue);

                // Since history table doesn't have phone, look up by name in DB first to avoid API spamming
                $phone = null;
                $email = null;

                $existingLocalLead = Lead::where('name', $studentName)->first();
                if ($existingLocalLead) {
                    $phone = $existingLocalLead->phone_whatsapp;
                    $email = $existingLocalLead->email;
                } else {
                    // Not in DB, search via external API
                    if (!isset($studentLookupCache[$studentName])) {
                        $studentDetails = $this->searchStudentExternal($studentName);
                        $studentLookupCache[$studentName] = $studentDetails;
                    }
                    if (!empty($studentLookupCache[$studentName])) {
                        $phone = $studentLookupCache[$studentName]['whatsapp'] ?? null;
                        $email = $studentLookupCache[$studentName]['email'] ?? null;
                    }
                }

                $this->saveOrUpdateLead([
                    'name' => $studentName,
                    'phone_whatsapp' => $phone ?? '0000000000',
                    'email' => $email,
                    'trainer_name' => $trainerName,
                    'intro_date' => $introDate,
                    'intro_time' => $time,
                    'package_selected' => $package,
                    'current_level' => $level,
                    'attendance_status' => $statusStr,
                    'notes' => 'محاضرة تعريفية سابقة',
                    'source' => 'نظام التعريفيات (الأرشيف)'
                ], $stats);
            }
        } catch (\Exception $e) {
            $stats['errors'][] = 'Scraping lecture history failed: ' . $e->getMessage();
            Log::error('IntroSystemSync: lecture_history.php error: ' . $e->getMessage());
        }

        // Save last sync time in cache
        Cache::put('intro_system_last_sync', Carbon::now(), 1440);

        return $stats;
    }

    /**
     * Save or update the lead record in the local database.
     */
    protected function saveOrUpdateLead(array $data, array &$stats): void
    {
        try {
            $phone = $data['phone_whatsapp'];
            $name = $data['name'];

            // Find existing lead by phone (if not default) or name
            $lead = null;
            if ($phone !== '0000000000') {
                $lead = Lead::where('phone_whatsapp', $phone)->first();
            }
            if (!$lead) {
                $lead = Lead::where('name', $name)->first();
            }

            // Map statusStr to pipeline status
            $mappedStatus = 'new';
            $statusStr = $data['attendance_status'];
            if ($statusStr === 'مكتملة') {
                $mappedStatus = 'attended_intro'; // وصل التعريفية
            } elseif ($statusStr === 'مجدولة') {
                $mappedStatus = 'waiting_intro'; // بانتظار المحاضرة
            } elseif ($statusStr === 'ملغية') {
                $mappedStatus = 'rejected'; // مرفوض
            }

            if ($lead) {
                // Keep 'confirmed' status intact to protect student conversions
                $newStatus = $lead->status;
                if ($lead->status !== 'confirmed') {
                    $newStatus = $mappedStatus;
                }

                // Clean up notes (avoid duplicating notes text)
                $updatedNotes = $lead->notes;
                if (strpos($lead->notes, $data['notes']) === false && !empty($data['notes'])) {
                    $updatedNotes = $data['notes'] . "\n" . $lead->notes;
                }

                $lead->update([
                    'trainer_name' => $data['trainer_name'] ?: $lead->trainer_name,
                    'intro_date' => $data['intro_date'] ?: $lead->intro_date,
                    'intro_time' => $data['intro_time'] ?: $lead->intro_time,
                    'package_selected' => $data['package_selected'] ?: $lead->package_selected,
                    'current_level' => $data['current_level'] ?: $lead->current_level,
                    'attendance_status' => $data['attendance_status'] ?: $lead->attendance_status,
                    'status' => $newStatus,
                    'notes' => $updatedNotes,
                    'email' => $data['email'] ?: $lead->email,
                    'phone_whatsapp' => ($phone !== '0000000000') ? $phone : $lead->phone_whatsapp
                ]);
                $stats['updated']++;
            } else {
                Lead::create([
                    'name' => $name,
                    'phone_whatsapp' => $phone,
                    'email' => $data['email'],
                    'trainer_name' => $data['trainer_name'],
                    'intro_date' => $data['intro_date'],
                    'intro_time' => $data['intro_time'],
                    'package_selected' => $data['package_selected'],
                    'current_level' => $data['current_level'],
                    'attendance_status' => $data['attendance_status'],
                    'status' => $mappedStatus,
                    'notes' => $data['notes'],
                    'source' => $data['source']
                ]);
                $stats['imported']++;
            }
        } catch (\Exception $e) {
            $stats['errors'][] = "Failed saving lead '{$data['name']}': " . $e->getMessage();
            Log::error("IntroSystemSync: saveOrUpdateLead error: " . $e->getMessage());
        }
    }
}
