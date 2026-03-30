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
        $query = Trainer::with('user:id,name,email,job_title,base_salary');

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
        // 1. التحقق من البيانات
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'job_title' => 'nullable|string|max:255',
            'base_salary' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request) {
            
            // 2. تجهيز بيانات الدخول
            $generatedEmail = 'trainer_' . time() . '@letspeak.online';
            $email = $request->email ?? $generatedEmail;
            
            // ✅ تصحيح سطر كلمة السر (إعطاء قيمة افتراضية 123456 في حال عدم وجودها)
            $hashedPassword = $request->password ? Hash::make($request->password) : Hash::make('123456');

            // 3. إنشاء المستخدم في جدول users (المخزن الأول: لا يحوي username)
            $user = User::create([
                'name'     => $request->name,
                'email'    => $email,
                'password' => $hashedPassword,
                'role'     => 'trainer',
                'status'   => 'active',
                'job_title'=> $request->job_title,
                'base_salary'=> $request->base_salary,
            ]);

            // 4. إنشاء المدرب في جدول trainers (المخزن الثاني: يحوي username ويطلب البيانات مكررة)
            $trainer = Trainer::create([
                'user_id' => $user->id,
                'name' => $request->name,
                'phone' => $request->phone,
                'min_level' => $request->min_level,
                'max_level' => $request->max_level,
                'notes' => $request->notes,
                'status' => 'active',

                // 👇 البيانات الإضافية التي يطلبها هذا الجدول تحديداً
                'username' => $email,          // نستخدم الإيميل كاسم مستخدم
                'email' => $email,             // تكرار الإيميل
                'password' => $hashedPassword, // تكرار كلمة السر
            ]);

            $plainPassword = $request->password ?: '123456';

            return response()->json([
                'trainer'        => $trainer,
                'login_email'    => $email,
                'login_password' => $plainPassword,
            ], 201);
        });
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
            'name'      => 'sometimes|required|string|max:255',
            'email'     => 'nullable|email|max:255',
            'phone'     => 'nullable|string|max:20',
            'min_level' => 'nullable|string|max:10',
            'max_level' => 'nullable|string|max:10',
            'notes'     => 'nullable|string',
            'password'  => 'nullable|string|min:6',
            'job_title' => 'nullable|string|max:255',
            'base_salary' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $trainer) {
            // Update trainer profile
            $trainerData = $request->only(['name', 'phone', 'min_level', 'max_level', 'notes']);
            if ($request->filled('email')) {
                $trainerData['email']    = $request->email;
                $trainerData['username'] = $request->email;
            }
            $trainer->update($trainerData);

            // Sync changes to linked User account
            if ($trainer->user) {
                $userData = [];
                if ($request->filled('name'))     $userData['name']     = $request->name;
                if ($request->filled('email'))    $userData['email']    = $request->email;
                if ($request->filled('password')) $userData['password'] = \Illuminate\Support\Facades\Hash::make($request->password);
                
                // Allow clearing job_title and base_salary by handling them unconditionally from the request if present
                if ($request->has('job_title'))   $userData['job_title']   = $request->job_title;
                if ($request->has('base_salary')) $userData['base_salary'] = $request->base_salary;
                
                if (!empty($userData)) {
                    $trainer->user->update($userData);
                }
            }

            return response()->json($trainer->fresh(['user']));
        });
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
        $trainers = Trainer::with('user:id,name,email,job_title,base_salary')
            ->get()
            ->map(function ($trainer) {
                return [
                    'id' => $trainer->id,
                    'name' => $trainer->name ?? $trainer->user->name ?? '',
                    'user' => $trainer->user ? [
                        'id' => $trainer->user->id,
                        'name' => $trainer->user->name,
                        'email' => $trainer->user->email,
                        'job_title' => $trainer->user->job_title,
                        'base_salary' => $trainer->user->base_salary,
                    ] : null,
                    'phone' => $trainer->phone ?? '',
                    'min_level' => $trainer->min_level,
                    'max_level' => $trainer->max_level,
                ];
            });
        
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

        $trainer = Trainer::with(['user:id,job_title', 'courses.student', 'courses.lectures', 'courses.package'])
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
                'trainer' => array_merge($trainer->only(['id', 'name', 'phone']), [
                    'job_title' => $trainer->user ? $trainer->user->job_title : null
                ]),
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

        $unavailability = TrainerUnavailability::where('trainer_id', $trainerId)->first();
        
        // Check if unavailable_days is being changed
        $newUnavailableDays = $request->input('unavailable_days', []);
        $oldUnavailableDays = $unavailability ? ($unavailability->unavailable_days ?? []) : [];
        $daysChanged = json_encode($newUnavailableDays) !== json_encode($oldUnavailableDays);
        
        $now = Carbon::now();
        
        if ($daysChanged && !empty($newUnavailableDays)) {
            // Check if last update was less than a week ago
            if ($unavailability && $unavailability->last_day_off_update) {
                $lastUpdate = Carbon::parse($unavailability->last_day_off_update);
                $weekAgo = $now->copy()->subWeek();
                
                if ($lastUpdate->gt($weekAgo)) {
                    $daysRemaining = $lastUpdate->copy()->addWeek()->diffInDays($now);
                    return response()->json([
                        'success' => false,
                        'message' => "لا يمكن تعديل يوم الإجازة إلا بعد أسبوع من آخر تعديل. متبقي {$daysRemaining} يوم.",
                        'error_code' => 'WEEKLY_LIMIT_NOT_PASSED',
                        'days_remaining' => $daysRemaining
                    ], 400);
                }
            }
            
            // Update last_day_off_update (only if checks passed)
            if (!$unavailability) {
                $unavailability = new TrainerUnavailability();
                $unavailability->trainer_id = $trainerId;
            }
            $unavailability->last_day_off_update = $now;
        }

        // Update or create unavailability
        $updateData = [
            'unavailable_days' => $request->input('unavailable_days'),
            'unavailable_times' => $request->input('unavailable_times'),
            'notes' => $request->input('notes'),
        ];
        
        if ($daysChanged && !empty($newUnavailableDays)) {
            $updateData['last_day_off_update'] = $now;
        }
        
        $unavailability = TrainerUnavailability::updateOrCreate(
            ['trainer_id' => $trainerId],
            $updateData
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
            'min_days_count' => 'nullable|integer|min:1|max:7'
        ]);

        $weekDays = $request->week_days;
        $dates = $request->dates;
        $time = $request->time;
        // If min_days_count is provided, we need that many days. Otherwise, we need ALL requested week_days.
        $minDaysCount = $request->min_days_count ?? count($weekDays);

        // Get all active trainers
        $allTrainers = Trainer::with('user:id,name,email')
            ->where(function($q) {
                $q->where('status', 'active')
                  ->orWhereNull('status');
            })
            ->get();

        $availableTrainers = [];

        // Group dates by day of week
        $datesByWeekDay = [];
        foreach ($dates as $date) {
            $dayOfWeek = Carbon::parse($date)->dayOfWeek;
            $datesByWeekDay[$dayOfWeek][] = $date;
        }

        foreach ($allTrainers as $trainer) {
            $unavailability = TrainerUnavailability::where('trainer_id', $trainer->id)->first();
            $unavailableDays = $unavailability->unavailable_days ?? [];
            $unavailableTimes = $unavailability->unavailable_times ?? [];

            $freeWeekDaysCount = 0;
            $trainerFreeDays = [];

            foreach ($weekDays as $weekDay) {
                if (!isset($datesByWeekDay[$weekDay])) {
                    continue;
                }

                $isDayConsistentlyFree = true;

                foreach ($datesByWeekDay[$weekDay] as $date) {
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
                        $isDayConsistentlyFree = false;
                        break;
                    }

                    // Check trainer unavailability
                    if ($unavailability) {
                        $dayName = Carbon::parse($date)->locale('en')->dayName;
                        
                        // Check full day unavailability
                        if (in_array($dayName, $unavailableDays)) {
                            $isDayConsistentlyFree = false;
                            break;
                        }

                        // Check time-specific unavailability
                        foreach ($unavailableTimes as $unavailableTime) {
                            if (isset($unavailableTime['day']) && strcasecmp($unavailableTime['day'], $dayName) === 0) {
                                $from = $unavailableTime['from'] ?? null;
                                $to = $unavailableTime['to'] ?? null;
                                
                                if ($from && $to && $time >= $from && $time <= $to) {
                                    $isDayConsistentlyFree = false;
                                    break 2;
                                }
                            }
                        }
                    }
                }

                if ($isDayConsistentlyFree) {
                    $freeWeekDaysCount++;
                    $trainerFreeDays[] = $weekDay;
                }
            }

            // Only add trainer if they have AT LEAST the required number of free days
            if ($freeWeekDaysCount >= $minDaysCount) {
                $availableTrainers[] = [
                    'id' => $trainer->id,
                    'name' => $trainer->user->name ?? $trainer->name,
                    'email' => $trainer->user->email ?? $trainer->email,
                    'phone' => $trainer->phone,
                    'free_days_count' => $freeWeekDaysCount,
                    'free_days' => $trainerFreeDays,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'data' => $availableTrainers,
        ]);
    }
}









