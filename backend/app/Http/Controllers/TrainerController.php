<?php

namespace App\Http\Controllers;

use App\Models\Trainer;
use App\Models\User;
use App\Models\TrainerUnavailability;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class TrainerController extends Controller
{
    /**
     * Display a listing of trainers.
     */
    public function index(Request $request)
    {
        $query = Trainer::with('user');

        // Search by name
        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
        }

        $trainers = $query->withCount('courses')->latest()->paginate(15);

        return response()->json($trainers);
    }

    /**
     * Store a newly created trainer.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'min_level' => 'nullable|string|max:10',
            'max_level' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        // Create trainer profile without user account
        $trainer = Trainer::create([
            'name' => $request->name,
            'phone' => $request->phone,
            'min_level' => $request->min_level,
            'max_level' => $request->max_level,
            'notes' => $request->notes,
            'status' => 'active',
        ]);

        return response()->json($trainer, 201);
    }

    /**
     * Display the specified trainer.
     */
    public function show(Trainer $trainer)
    {
        $trainer->load(['user', 'courses.student', 'courses.lectures']);
        
        return response()->json($trainer);
    }

    /**
     * Update the specified trainer.
     */
    public function update(Request $request, Trainer $trainer)
    {
        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'min_level' => 'nullable|string|max:10',
            'max_level' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        // Update trainer profile
        $trainer->update($request->only(['name', 'phone', 'min_level', 'max_level', 'notes']));

        return response()->json($trainer);
    }

    /**
     * Remove the specified trainer.
     */
    public function destroy(Trainer $trainer)
    {
        DB::transaction(function () use ($trainer) {
            $trainer->user->delete(); // This will cascade delete trainer
        });

        return response()->json(null, 204);
    }

    /**
     * Get all trainers for dropdown
     */
    public function list()
    {
        $trainers = Trainer::with('user:id,name')->get(['id', 'user_id', 'min_level', 'max_level']);
        
        return response()->json($trainers);
    }

    /**
     * Get trainer dashboard data
     */
    public function dashboard(Request $request)
    {
        // Get trainer ID from session or request
        $trainerId = $request->input('trainer_id') ?? session('trainer_id');
        
        if (!$trainerId) {
            // Try to get from authenticated user
            $user = $request->user();
            if ($user) {
                $trainer = Trainer::where('user_id', $user->id)->first();
                $trainerId = $trainer?->id;
            }
        }

        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Trainer not found'], 404);
        }

        $trainer = Trainer::with(['courses.student', 'courses.lectures', 'courses.package'])
            ->find($trainerId);

        if (!$trainer) {
            return response()->json(['success' => false, 'message' => 'Trainer not found'], 404);
        }

        $courses = $trainer->courses->map(function ($course) {
            return [
                'id' => $course->id,
                'student' => $course->student,
                'package' => $course->package,
                'status' => $course->status,
                'lectures' => $course->lectures,
                'completed_lectures' => $course->lectures->where('is_completed', true)->count(),
                'total_lectures' => $course->lectures->count(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'trainer' => $trainer->only(['id', 'name', 'phone']),
                'courses' => $courses,
            ]
        ]);
    }

    /**
     * Get trainer unavailability
     */
    public function getUnavailability(Request $request)
    {
        $trainerId = $this->getTrainerId($request);
        
        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Trainer not found'], 404);
        }

        $unavailability = TrainerUnavailability::where('trainer_id', $trainerId)->first();

        return response()->json([
            'success' => true,
            'data' => $unavailability
        ]);
    }

    /**
     * Save trainer unavailability
     */
    public function saveUnavailability(Request $request)
    {
        $trainerId = $this->getTrainerId($request);

        if (!$trainerId) {
            return response()->json(['success' => false, 'message' => 'Trainer not found'], 404);
        }

        $request->validate([
            'unavailable_days' => 'nullable|array',
            'unavailable_times' => 'nullable|array',
            'notes' => 'nullable|string|max:500',
        ]);

        $unavailability = TrainerUnavailability::updateOrCreate(
            ['trainer_id' => $trainerId],
            [
                'unavailable_days' => $request->input('unavailable_days'),
                'unavailable_times' => $request->input('unavailable_times'),
                'notes' => $request->input('notes'),
            ]
        );

        return response()->json([
            'success' => true,
            'data' => $unavailability,
            'message' => 'تم حفظ أوقات عدم التوفر بنجاح'
        ]);
    }

    /**
     * Get trainer ID from request
     */
    private function getTrainerId(Request $request)
    {
        $trainerId = $request->input('trainer_id') ?? session('trainer_id');
        
        if (!$trainerId) {
            $user = $request->user();
            if ($user) {
                $trainer = Trainer::where('user_id', $user->id)->first();
                $trainerId = $trainer?->id;
            }
        }

        return $trainerId;
    }
}









