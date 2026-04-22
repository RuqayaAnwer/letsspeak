<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;

class LeadController extends Controller
{
    public function index()
    {
        $leads = Lead::orderBy('created_at', 'desc')->get();
        return response()->json($leads);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'phone_whatsapp' => 'required|string',
            'status' => 'nullable|string'
        ]);

        $lead = Lead::create($request->all());

        return response()->json(['message' => 'Lead created successfully', 'lead' => $lead]);
    }

    public function update(Request $request, Lead $lead)
    {
        $lead->update($request->all());
        return response()->json(['message' => 'Lead updated successfully', 'lead' => $lead]);
    }

    public function updateStatus(Request $request, Lead $lead)
    {
        $validated = $request->validate([
            'status' => 'required|string'
        ]);

        $lead->status = $validated['status'];
        $lead->save();

        return response()->json(['message' => 'Status updated successfully', 'lead' => $lead]);
    }

    public function destroy(Lead $lead)
    {
        $lead->delete();
        return response()->json(['message' => 'Lead deleted successfully']);
    }
}
