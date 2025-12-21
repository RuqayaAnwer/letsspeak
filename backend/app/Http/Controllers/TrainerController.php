<?php

namespace App\Http\Controllers;

use App\Models\Trainer;
use App\Models\User;
use App\Models\TrainerUnavailability;
use App\Models\Course;
use App\Models\Lecture;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TrainerController extends Controller
{
    /**
     * Display a listing of trainers.
     */
    public function index(Request $request)
    {
        $query = Trainer::with('user:id,name,email');

        // Search by name (search in both trainer name and user name)
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $trainers = $query->withCount('courses')->latest()->get();

        // Calculate weekly lectures count for each trainer
        $trainers = $trainers->map(function ($trainer) {
            $weeklyLecturesCount = $this->calculateWeeklyLecturesCount($trainer->id);
            $trainer->weekly_lectures_count = $weeklyLecturesCount;
            return $trainer;
        });

        // Apply weekly filter if provided
        if ($request->has('weekly_lectures')) {
            $filter = $request->weekly_lectures;
            $trainers = $trainers->filter(function ($trainer) use ($filter) {
                $count = $trainer->weekly_lectures_count ?? 0;
                switch ($filter) {
                    case 'less_than_3':
                        return $count < 3;
                    case 'more_than_3':
                        return $count > 3;
                    default:
                        return true;
                }
            });
        }

        // Paginate manually
        $perPage = 15;
        $currentPage = $request->get('page', 1);
        $items = $trainers->slice(($currentPage - 1) * $perPage, $perPage)->values();
        $total = $trainers->count();

        return response()->json([
            'data' => $items,
            'current_page' => $currentPage,
            'per_page' => $perPage,
            'total' => $total,
            'last_page' => ceil($total / $perPage),
        ]);
    }

    /**
     * Calculate weekly lectures count for a trainer
     */
    private function calculateWeeklyLecturesCount($trainerId): int
    {
        // Get all active courses for this trainer
        $courses = Course::where('trainer_id', $trainerId)
            ->where('status', 'active')
            ->get();

        $weeklyCount = 0;

        foreach ($courses as $course) {
            if (!$course->lecture_days || !is_array($course->lecture_days)) {
                continue;
            }

            // Count how many days per week this course has lectures
            $daysPerWeek = count($course->lecture_days);
            $weeklyCount += $daysPerWeek;
        }

        return $weeklyCount;
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
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }
        
        if (!$user->isTrainer()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized - Not a trainer'], 403);
        }

        // Get trainer from authenticated user
        $trainer = Trainer::where('user_id', $user->id)->first();
        
        if (!$trainer) {
            return response()->json([
                'success' => false, 
                'message' => 'Trainer profile not found. Please contact administrator.',
                'user_id' => $user->id
            ], 404);
        }
        
        $trainerId = $trainer->id;

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
     * Get today's lectures for trainer
     */
    public function todayLectures(Request $request)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }
        
        if (!$user->isTrainer()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized - Not a trainer'], 403);
        }

        $trainer = Trainer::where('user_id', $user->id)->first();
        
        if (!$trainer) {
            return response()->json([
                'success' => false, 
                'message' => 'Trainer profile not found. Please contact administrator.',
                'user_id' => $user->id
            ], 404);
        }

        $today = Carbon::today()->format('Y-m-d');
        
        $lectures = Lecture::whereHas('course', function ($q) use ($trainer) {
            $q->where('trainer_id', $trainer->id)
              ->where('status', 'active');
        })
        ->where('date', $today)
        ->with(['course.student', 'course.coursePackage'])
        ->orderBy('time')
        ->get()
        ->map(function ($lecture) {
            return [
                'id' => $lecture->id,
                'course' => [
                    'id' => $lecture->course->id,
                    'student' => $lecture->course->student,
                    'course_package' => $lecture->course->coursePackage,
                    'lecture_time' => $lecture->course->lecture_time,
                ],
                'date' => $lecture->date,
                'time' => $lecture->time,
                'attendance' => $lecture->attendance,
                'status' => $lecture->is_completed ? 'completed' : ($lecture->attendance === 'cancelled' ? 'cancelled' : 'pending'),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $lectures
        ]);
    }

    /**
     * Get next week's lectures for trainer
     */
    public function nextWeekLectures(Request $request)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }
        
        if (!$user->isTrainer()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized - Not a trainer'], 403);
        }

        $trainer = Trainer::where('user_id', $user->id)->first();
        
        if (!$trainer) {
            return response()->json([
                'success' => false, 
                'message' => 'Trainer profile not found. Please contact administrator.',
                'user_id' => $user->id
            ], 404);
        }

        $today = Carbon::today();
        $nextWeekStart = $today->copy()->addWeek()->startOfWeek();
        $nextWeekEnd = $today->copy()->addWeek()->endOfWeek();
        
        $lectures = Lecture::whereHas('course', function ($q) use ($trainer) {
            $q->where('trainer_id', $trainer->id)
              ->where('status', 'active');
        })
        ->whereBetween('date', [$nextWeekStart->format('Y-m-d'), $nextWeekEnd->format('Y-m-d')])
        ->with(['course.student', 'course.coursePackage'])
        ->orderBy('date')
        ->orderBy('time')
        ->get()
        ->map(function ($lecture) {
            return [
                'id' => $lecture->id,
                'course' => [
                    'id' => $lecture->course->id,
                    'student' => $lecture->course->student,
                    'course_package' => $lecture->course->coursePackage,
                    'lecture_time' => $lecture->course->lecture_time,
                ],
                'date' => $lecture->date,
                'time' => $lecture->time,
                'attendance' => $lecture->attendance,
                'status' => $lecture->is_completed ? 'completed' : ($lecture->attendance === 'cancelled' ? 'cancelled' : 'pending'),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $lectures
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

    /**
     * Find available trainers for specific dates and time
     */
    public function available(Request $request)
    {
        $request->validate([
            'dates' => 'required|array|min:1',
            'dates.*' => 'required|date',
            'time' => 'required|date_format:H:i',
        ]);

        $dates = $request->dates;
        $time = $request->time;

        // Get all trainers (filter by status if exists, otherwise get all)
        $allTrainers = Trainer::with('user:id,name,email')
            ->where(function($q) {
                $q->where('status', 'active')
                  ->orWhereNull('status');
            })
            ->get();

        $availableTrainers = [];

        foreach ($allTrainers as $trainer) {
            $isAvailable = true;

            // Check for conflicts in each date
            foreach ($dates as $date) {
                // Check if trainer has a lecture at this date/time
                $conflict = Lecture::whereHas('course', function ($q) use ($trainer) {
                    $q->where('trainer_id', $trainer->id)
                      ->where('status', 'active');
                })
                ->where('date', $date)
                ->where('time', $time)
                ->whereNotIn('attendance', ['postponed_by_trainer', 'postponed_by_student', 'postponed_holiday'])
                ->exists();

                if ($conflict) {
                    $isAvailable = false;
                    break;
                }

                // Check trainer unavailability
                $unavailability = TrainerUnavailability::where('trainer_id', $trainer->id)->first();
                if ($unavailability) {
                    $dayName = Carbon::parse($date)->locale('en')->dayName;
                    $unavailableDays = $unavailability->unavailable_days ?? [];
                    
                    if (in_array($dayName, $unavailableDays)) {
                        $isAvailable = false;
                        break;
                    }

                    // Check time-specific unavailability
                    $unavailableTimes = $unavailability->unavailable_times ?? [];
                    foreach ($unavailableTimes as $unavailableTime) {
                        if (isset($unavailableTime['day']) && $unavailableTime['day'] === $dayName) {
                            $from = $unavailableTime['from'] ?? null;
                            $to = $unavailableTime['to'] ?? null;
                            
                            if ($from && $to && $time >= $from && $time <= $to) {
                                $isAvailable = false;
                                break 2;
                            }
                        }
                    }
                }
            }

            if ($isAvailable) {
                $availableTrainers[] = [
                    'id' => $trainer->id,
                    'name' => $trainer->user->name ?? $trainer->name,
                    'email' => $trainer->user->email ?? $trainer->email,
                    'phone' => $trainer->phone,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'data' => $availableTrainers,
        ]);
    }

    /**
     * Find available trainers for weekly pattern over a month
     */
    public function availableMonthly(Request $request)
    {
        $request->validate([
            'week_days' => 'required|array|min:1',
            'week_days.*' => 'required|integer|between:0,6',
            'dates' => 'required|array|min:1',
            'dates.*' => 'required|date',
            'time' => 'required|date_format:H:i',
        ]);

        $weekDays = $request->week_days;
        $dates = $request->dates;
        $time = $request->time;

        // Get all trainers (filter by status if exists, otherwise get all)
        $allTrainers = Trainer::with('user:id,name,email')
            ->where(function($q) {
                $q->where('status', 'active')
                  ->orWhereNull('status');
            })
            ->get();

        $availableTrainers = [];

        foreach ($allTrainers as $trainer) {
            $isAvailable = true;

            // Check for conflicts in all dates
            foreach ($dates as $date) {
                // Check if trainer has a lecture at this date/time
                $conflict = Lecture::whereHas('course', function ($q) use ($trainer) {
                    $q->where('trainer_id', $trainer->id)
                      ->where('status', 'active');
                })
                ->where('date', $date)
                ->where('time', $time)
                ->whereNotIn('attendance', ['postponed_by_trainer', 'postponed_by_student', 'postponed_holiday'])
                ->exists();

                if ($conflict) {
                    $isAvailable = false;
                    break;
                }

                // Check trainer unavailability
                $unavailability = TrainerUnavailability::where('trainer_id', $trainer->id)->first();
                if ($unavailability) {
                    $dayName = Carbon::parse($date)->locale('en')->dayName;
                    $unavailableDays = $unavailability->unavailable_days ?? [];
                    
                    if (in_array($dayName, $unavailableDays)) {
                        $isAvailable = false;
                        break;
                    }

                    // Check time-specific unavailability
                    $unavailableTimes = $unavailability->unavailable_times ?? [];
                    foreach ($unavailableTimes as $unavailableTime) {
                        if (isset($unavailableTime['day']) && $unavailableTime['day'] === $dayName) {
                            $from = $unavailableTime['from'] ?? null;
                            $to = $unavailableTime['to'] ?? null;
                            
                            if ($from && $to && $time >= $from && $time <= $to) {
                                $isAvailable = false;
                                break 2;
                            }
                        }
                    }
                }
            }

            if ($isAvailable) {
                $availableTrainers[] = [
                    'id' => $trainer->id,
                    'name' => $trainer->user->name ?? $trainer->name,
                    'email' => $trainer->user->email ?? $trainer->email,
                    'phone' => $trainer->phone,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'data' => $availableTrainers,
        ]);
    }
}









