<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;
use App\Services\IntroSystemSyncService;
use Illuminate\Support\Facades\Cache;

class LeadController extends Controller
{
    public function index(Request $request, IntroSystemSyncService $syncService)
    {
        // Auto sync with the intro system, throttle to run at most once every 2 minutes (120 seconds)
        if (!Cache::has('intro_system_last_sync_throttle')) {
            try {
                // Sync upcoming lectures and up to 20 history records to keep load times short
                $syncService->sync(20);
                Cache::put('intro_system_last_sync_throttle', true, 120);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('IntroSystemSync: AutoSync failed in LeadController: ' . $e->getMessage());
            }
        }

        $query = Lead::orderBy('created_at', 'desc');

        if ($request->has('search') && $request->search != '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone_whatsapp', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('telegram_id', 'like', "%{$search}%")
                  ->orWhere('trainer_name', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('all') && $request->all == 'true') {
            $leads = $query->limit(500)->get(); // Limit to 500 to prevent freezing
            return response()->json(['data' => $leads]);
        }

        // Return statistical counts as well alongside the paginated results
        $counts = [
            'all' => Lead::count(),
            'new' => Lead::where('status', 'new')->orWhereNull('status')->count(),
            'contacted' => Lead::where('status', 'contacted')->count(),
            'waiting_intro' => Lead::where('status', 'waiting_intro')->count(),
            'attended_intro' => Lead::where('status', 'attended_intro')->count(),
            'confirmed' => Lead::where('status', 'confirmed')->count(),
            'rejected' => Lead::where('status', 'rejected')->count(),
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
        // Extract level (L1-L8) from current_level, package_selected, or notes
        $level = 'L1';
        $fieldsToCheck = [
            $lead->current_level,
            $lead->package_selected,
            $lead->notes
        ];

        foreach ($fieldsToCheck as $field) {
            if ($field) {
                if (preg_match('/(L[1-8])/i', $field, $matches)) {
                    $level = strtoupper($matches[1]);
                    break;
                } elseif (preg_match('/مستوى\s*([1-8])/u', $field, $matches) || preg_match('/المستوى\s*([1-8])/u', $field, $matches)) {
                    $level = 'L' . $matches[1];
                    break;
                } elseif ($field === $lead->current_level && preg_match('/^[1-8]$/', trim($field))) {
                    // If they just typed "5" in current_level
                    $level = 'L' . trim($field);
                    break;
                }
            }
        }

        $isChild = $lead->age !== null && $lead->age < 16;
        $student = \App\Models\Student::create([
            'name' => $lead->name,
            'phone' => $lead->phone_whatsapp,
            'level' => $level,
            'notes' => "المستوى التقييمي: " . ($lead->current_level ?? 'غير محدد') . "\n" .
                       "الباقة المطلوبة: " . ($lead->package_selected ?? 'غير محدد') . "\n" . 
                       $lead->notes . "\n(تم التحويل من مسار العملاء)",
            'lead_id' => $lead->id,
            'is_child' => $isChild,
            'age' => $lead->age,
        ]);

        $lead->status = 'confirmed';
        $lead->save();

        return response()->json(['message' => 'تم تحويل العميل إلى طالب بنجاح!', 'data' => $student]);
    }
}
