    /**
     * Get trainer achievements for current month
     */
    public function achievements(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }
            
            if (!$user->isTrainer()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized - Not a trainer'
                ], 403);
            }

            $trainer = Trainer::where('user_id', $user->id)->first();
            if (!$trainer) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trainer not found'
                ], 404);
            }

            $today = Carbon::today();
            $startDate = $today->copy()->startOfMonth()->format('Y-m-d');
            $endDate = $today->copy()->endOfMonth()->format('Y-m-d');

            // Get completed lectures for current month (only paid ones)
            $completedLectures = Lecture::whereHas('course', function ($query) use ($trainer) {
                $query->where('trainer_id', $trainer->id);
            })
            ->whereBetween('date', [$startDate, $endDate])
            ->where('trainer_payment_status', 'paid') // Only count paid lectures
            ->get()
            ->filter(function ($lecture) {
                // Check student_attendance for dual courses
                if ($lecture->student_attendance && is_array($lecture->student_attendance) && count($lecture->student_attendance) > 0) {
                    foreach ($lecture->student_attendance as $studentData) {
                        if (is_array($studentData)) {
                            $attendance = $studentData['attendance'] ?? null;
                            if ($attendance === 'present' || $attendance === 'absent') {
                                return true;
                            }
                        }
                    }
                }
                // For single courses, check is_completed or attendance
                return $lecture->is_completed || in_array($lecture->attendance, ['present', 'partially', 'absent']);
            })
            ->count();

            // Get total lectures (scheduled) for current month
            $totalLectures = Lecture::whereHas('course', function ($query) use ($trainer) {
                $query->where('trainer_id', $trainer->id);
            })
            ->whereBetween('date', [$startDate, $endDate])
            ->count();

            // Get active courses count for current month (courses that have lectures this month)
            $coursesThisMonth = Course::where('trainer_id', $trainer->id)
                ->whereHas('lectures', function ($query) use ($startDate, $endDate) {
                    $query->whereBetween('date', [$startDate, $endDate]);
                })
                ->distinct()
                ->count();

            // Calculate remaining lectures
            $remainingLectures = max(0, $totalLectures - $completedLectures);

            // Get renewals count for current month
            $month = $today->month;
            $year = $today->year;
            $renewalsCount = Course::where('trainer_id', $trainer->id)
                ->where('renewed_with_trainer', true)
                ->whereMonth('start_date', $month)
                ->whereYear('start_date', $year)
                ->get()
                ->filter(function ($course) use ($trainer) {
                    $studentIds = $course->students->pluck('id')->toArray();
                    if (empty($studentIds)) {
                        return false;
                    }
                    
                    $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                        $query->whereIn('students.id', $studentIds);
                    })
                    ->where('id', '!=', $course->id)
                    ->where('start_date', '<', $course->start_date)
                    ->orderBy('start_date', 'desc')
                    ->first();
                    
                    if ($previousCourse) {
                        return $previousCourse->trainer_id === $trainer->id;
                    }
                    
                    return false;
                })
                ->count();

            // Calculate competition bonus (check if trainer is in top 3)
            $allRenewalsData = Course::where('renewed_with_trainer', true)
                ->whereMonth('start_date', $month)
                ->whereYear('start_date', $year)
                ->get()
                ->groupBy('trainer_id')
                ->map(function ($courses) use ($trainer) {
                    return $courses->filter(function ($course) use ($trainer) {
                        $studentIds = $course->students->pluck('id')->toArray();
                        if (empty($studentIds)) {
                            return false;
                        }
                        
                        $previousCourse = Course::whereHas('students', function ($query) use ($studentIds) {
                            $query->whereIn('students.id', $studentIds);
                        })
                        ->where('id', '!=', $course->id)
                        ->where('start_date', '<', $course->start_date)
                        ->orderBy('start_date', 'desc')
                        ->first();
                        
                        if ($previousCourse) {
                            return $previousCourse->trainer_id === $course->trainer_id;
                        }
                        
                        return false;
                    })->count();
                })
                ->sortDesc()
                ->take(3)
                ->keys()
                ->toArray();
            
            $isInTop3 = in_array($trainer->id, $allRenewalsData) && $renewalsCount > 0;

            // Renewal Bonus Progress
            $renewalTarget5 = 5;
            $renewalTarget7 = 7;
            $renewalProgress5 = $renewalTarget5 > 0 ? min(100, ($renewalsCount / $renewalTarget5) * 100) : 0;
            $renewalProgress7 = $renewalTarget7 > 0 ? min(100, ($renewalsCount / $renewalTarget7) * 100) : 0;
            $renewalRemaining5 = max(0, $renewalTarget5 - $renewalsCount);
            $renewalRemaining7 = max(0, $renewalTarget7 - $renewalsCount);

            // Volume Bonus Progress (60 and 80 lectures)
            $volumeTarget60 = 60;
            $volumeTarget80 = 80;
            $volumeProgress60 = $volumeTarget60 > 0 ? min(100, ($completedLectures / $volumeTarget60) * 100) : 0;
            $volumeProgress80 = $volumeTarget80 > 0 ? min(100, ($completedLectures / $volumeTarget80) * 100) : 0;
            $volumeRemaining60 = max(0, $volumeTarget60 - $completedLectures);
            $volumeRemaining80 = max(0, $volumeTarget80 - $completedLectures);

            // Calculate monthly earnings (استحقاق المدرب)
            $lectureRate = 4000;
            $basePay = $completedLectures * $lectureRate;
            
            // Calculate renewal bonus (tiered system)
            $renewalBonus = 0;
            if ($renewalsCount >= 7) {
                $renewalBonus = 100000;
            } elseif ($renewalsCount >= 5) {
                $renewalBonus = 50000;
            }
            
            // Calculate competition bonus
            $competitionBonus = $isInTop3 ? 20000 : 0;
            
            // Calculate volume bonus
            $volumeBonus = 0;
            if ($completedLectures >= 80) {
                $volumeBonus = 80000;
            } elseif ($completedLectures >= 60) {
                $volumeBonus = 30000;
            }
            
            // Total earnings
            $totalEarnings = $basePay + $renewalBonus + $competitionBonus + $volumeBonus;

            return response()->json([
                'success' => true,
                'data' => [
                    'completed_lectures' => $completedLectures,
                    'total_lectures' => $totalLectures,
                    'remaining_lectures' => $remainingLectures,
                    'courses_count' => $coursesThisMonth,
                    'renewals_count' => $renewalsCount,
                    'earnings' => [
                        'base_pay' => $basePay,
                        'renewal_bonus' => $renewalBonus,
                        'competition_bonus' => $competitionBonus,
                        'volume_bonus' => $volumeBonus,
                        'total' => $totalEarnings,
                        'lecture_rate' => $lectureRate
                    ],
                    'bonuses' => [
                        'renewal' => [
                            'type' => 'renewal',
                            'name' => 'مكافأة التجديد',
                            'icon' => '🔄',
                            'levels' => [
                                [
                                    'target' => $renewalTarget5,
                                    'current' => $renewalsCount,
                                    'remaining' => $renewalRemaining5,
                                    'progress_percentage' => $renewalProgress5,
                                    'achieved' => $renewalsCount >= $renewalTarget5,
                                    'amount' => 50000,
                                    'label' => '5 تجديدات'
                                ],
                                [
                                    'target' => $renewalTarget7,
                                    'current' => $renewalsCount,
                                    'remaining' => $renewalRemaining7,
                                    'progress_percentage' => $renewalProgress7,
                                    'achieved' => $renewalsCount >= $renewalTarget7,
                                    'amount' => 100000,
                                    'label' => '7 تجديدات'
                                ]
                            ]
                        ],
                        'competition' => [
                            'type' => 'competition',
                            'name' => 'مكافأة المنافسة',
                            'icon' => '🏆',
                            'current' => $renewalsCount,
                            'is_in_top3' => $isInTop3,
                            'achieved' => $isInTop3,
                            'amount' => 20000,
                            'description' => 'أن تكون من أفضل 3 مدربين في التجديدات'
                        ],
                        'volume' => [
                            'type' => 'volume',
                            'name' => 'مكافأة الكمية',
                            'icon' => '📊',
                            'levels' => [
                                [
                                    'target' => $volumeTarget60,
                                    'current' => $completedLectures,
                                    'remaining' => $volumeRemaining60,
                                    'progress_percentage' => $volumeProgress60,
                                    'achieved' => $completedLectures >= $volumeTarget60,
                                    'amount' => 0, // Will be set based on system config
                                    'label' => '60 محاضرة'
                                ],
                                [
                                    'target' => $volumeTarget80,
                                    'current' => $completedLectures,
                                    'remaining' => $volumeRemaining80,
                                    'progress_percentage' => $volumeProgress80,
                                    'achieved' => $completedLectures >= $volumeTarget80,
                                    'amount' => 0, // Will be set based on system config
                                    'label' => '80 محاضرة'
                                ]
                            ]
                        ]
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error in achievements endpoint: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء جلب البيانات',
                'error' => config('app.debug') ? $e->getMessage() : 'خطأ في الخادم'
            ], 500);
        }
    }
