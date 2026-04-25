<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;

class LeadController extends Controller
{
    public function index(Request $request)
    {
        $query = Lead::orderBy('created_at', 'desc');

        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Return statistical counts as well alongside the paginated results
        $counts = [
            'all' => Lead::count(),
            'new' => Lead::where('status', 'new')->count(),
            'attended_intro' => Lead::where('status', 'attended_intro')->count(),
            'confirmed' => Lead::where('status', 'confirmed')->count(),
        ];

        $leads = $query->paginate(30);

        return response()->json([
            'leads' => $leads,
            'counts' => $counts
        ]);
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

    public function convertToStudent(Lead $lead)
    {
        $student = \App\Models\Student::create([
            'name' => $lead->name,
            'phone' => $lead->phone_whatsapp,
            'level' => mb_substr($lead->package_selected ?: 'L1', 0, 10),
            'notes' => $lead->notes . "\n(تم التحويل من مسار العملاء)",
        ]);

        $lead->status = 'confirmed';
        $lead->save();

        return response()->json(['message' => 'تم تحويل العميل إلى طالب بنجاح!', 'student' => $student]);
    }
}
