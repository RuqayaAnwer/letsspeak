<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
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

        // Prevent duplicates: find by phone or create new
        $phone = $request->input('phone_whatsapp', 'بدون رقم');
        $lead = Lead::firstOrNew(['phone_whatsapp' => $phone]);
        $lead->name = $request->input('name', 'عميل جديد');
        $lead->email = $request->input('email');
        $lead->telegram_id = $request->input('telegram_id');
        $lead->governorate = $request->input('governorate');
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
        if (!$lead->exists || empty($lead->status)) {
            $lead->status = 'new';
        }
        
        $lead->save();

        return response()->json(['message' => 'Lead securely received and processed.', 'id' => $lead->id], 201);
    }
}
