<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;

class PublicWebhooksController extends Controller
{
    public function storeLead(Request $request)
    {
        // Simple authentication check using a predefined token.
        // In a real app, this key should be in .env (e.g. env('WEBHOOK_SECRET_KEY'))
        $expectedToken = "letspeak_secure_link_12345";
        
        $providedToken = $request->header('X-Webhook-Token') ?? $request->input('api_token');

        if ($providedToken !== $expectedToken) {
            return response()->json(['error' => 'Unauthorized Access'], 401);
        }

        // We accept dynamic data and default missing things to null or basic values
        $lead = new Lead();
        $lead->name = $request->input('name', 'عميل جديد');
        $lead->phone_whatsapp = $request->input('phone_whatsapp', 'بدون رقم');
        $lead->email = $request->input('email');
        $lead->telegram_id = $request->input('telegram_id');
        $lead->governorate = $request->input('governorate');
        $lead->age = $request->input('age');
        $lead->gender = $request->input('gender');
        $lead->package_selected = $request->input('package_selected');
        $lead->preferred_time = $request->input('preferred_time');
        $lead->current_level = $request->input('current_level');
        
        // Define source
        $lead->source = $request->input('source', 'External Webhook');
        
        // Always set status to new for incoming webhook leads
        $lead->status = 'new';
        
        $lead->save();

        return response()->json(['message' => 'Lead securely received and processed.', 'id' => $lead->id], 201);
    }
}
