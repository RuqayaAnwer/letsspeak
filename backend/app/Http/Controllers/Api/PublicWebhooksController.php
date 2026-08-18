<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Student;
use Illuminate\Http\Request;

class PublicWebhooksController extends Controller
{
    public function storeLead(Request $request)
    {
        // Get webhook token from environment variable, with a fallback for compatibility
        $expectedToken = env('EXTERNAL_WEBHOOK_TOKEN', 'letspeak_secure_link_12345');
        
        $providedToken = $request->header('X-Webhook-Token') ?? $request->input('api_token');

        if ($providedToken !== $expectedToken) {
            \Illuminate\Support\Facades\Log::warning('Webhook unauthorized attempt', ['ip' => $request->ip()]);
            return response()->json(['error' => 'Unauthorized Access'], 401);
        }

        \Illuminate\Support\Facades\Log::info('Webhook Payload Received', $request->all());

        // Prevent duplicates: find by phone or create new (robust to phone/whatsapp fields)
        $phone = $request->input('phone_whatsapp') ?? $request->input('phone') ?? $request->input('whatsapp');
        if (empty($phone)) {
            $phone = 'بدون رقم';
        } else {
            $phone = preg_replace('/[^\+0-9]/', '', $phone);
        }

        $lead = null;
        if ($phone !== 'بدون رقم' && $phone !== '0000000000') {
            $lead = Lead::where('phone_whatsapp', $phone)->first();
        }

        if (!$lead) {
            $lead = new Lead();
            $lead->phone_whatsapp = $phone;
        }

        $lead->name = $request->input('name') ?? $request->input('full_name') ?? 'عميل جديد';
        $lead->email = $request->input('email');
        $lead->telegram_id = $request->input('telegram_id') ?? $request->input('telegram');
        $lead->governorate = $request->input('governorate') ?? $request->input('city') ?? $request->input('gov');
        $lead->age = $request->input('age');
        $genderInput = mb_strtolower(trim($request->input('gender') ?? ''), 'UTF-8');
        if (in_array($genderInput, ['ذكر', 'مذكر', 'ولد', 'male', 'm'])) {
            $lead->gender = 'male';
        } elseif (in_array($genderInput, ['أنثى', 'انثى', 'مؤنث', 'بنت', 'female', 'f'])) {
            $lead->gender = 'female';
        } else {
            $lead->gender = null;
        }

        $lead->package_selected = $request->input('package_selected');
        $lead->preferred_time = $request->input('preferred_time');
        $lead->current_level = $request->input('current_level');
        $lead->intro_date = $request->input('intro_date');
        $lead->trainer_name = $request->input('trainer_name');
        $lead->intro_time = $request->input('intro_time');
        
        // Define source
        $lead->source = $request->input('source', 'External Webhook');
        
        if ($request->has('notes')) {
            $lead->notes = $request->input('notes');
        }
        
        // Only set status to 'new' if this is a brand new lead, to avoid resetting old ones
        $isNewLead = !$lead->exists || empty($lead->status);
        if ($isNewLead) {
            $lead->status = 'new';
        }
        
        $lead->save();

        // Automatic Conversion to Student
        // Check if student with this phone already exists
        $existingStudent = null;
        if ($lead->phone_whatsapp !== '0000000000' && $lead->phone_whatsapp !== 'بدون رقم') {
            $existingStudent = Student::where('phone', $lead->phone_whatsapp)->first();
        }

        if (!$existingStudent) {
            // Extract level (L1-L8)
            $level = 'L1';
            $fieldsToCheck = [
                $lead->current_level,
                $lead->package_selected,
                $lead->notes
            ];

            foreach ($fieldsToCheck as $field) {
                if ($field) {
                    $fieldLower = strtolower($field);
                    if (strpos($fieldLower, 'l_prep') !== false || strpos($fieldLower, 'prep') !== false || strpos($fieldLower, 'تمهيدي') !== false) {
                        $level = 'L_PREP';
                        break;
                    } elseif (preg_match('/(L[1-8])/i', $field, $matches)) {
                        $level = strtoupper($matches[1]);
                        break;
                    } elseif (preg_match('/مستوى\s*([1-8])/u', $field, $matches) || preg_match('/المستوى\s*([1-8])/u', $field, $matches)) {
                        $level = 'L' . $matches[1];
                        break;
                    }
                }
            }

            // Determine if child (less than 16 years, or keywords in level/package/notes)
            $isChild = ($lead->age !== null && $lead->age < 16);
            if (!$isChild) {
                // check for kids keywords
                foreach ($fieldsToCheck as $field) {
                    if ($field) {
                        if (mb_strpos($field, 'اطفال') !== false || mb_strpos(strtolower($field), 'kids') !== false) {
                            $isChild = true;
                            break;
                        }
                    }
                }
            }

            $student = Student::create([
                'name' => $lead->name,
                'phone' => $lead->phone_whatsapp,
                'level' => $isChild ? 'أطفال' : $level,
                'notes' => "المستوى التقييمي: " . ($lead->current_level ?? 'غير محدد') . "\n" .
                           "الباقة المطلوبة: " . ($lead->package_selected ?? 'غير محدد') . "\n" . 
                           $lead->notes . "\n(تم إنشاء هذا الطالب تلقائياً من استمارة التسجيل)",
                'lead_id' => $lead->id,
                'is_child' => $isChild,
                'age' => $lead->age,
            ]);

            // Set lead status to confirmed since it's converted
            $lead->status = 'confirmed';
            $lead->save();
        } elseif ($existingStudent) {
            // If student already exists, update lead status to confirmed to keep database clean
            $lead->status = 'confirmed';
            $lead->save();
        }

        return response()->json(['message' => 'Lead securely received and processed.', 'id' => $lead->id], 201);
    }
}
