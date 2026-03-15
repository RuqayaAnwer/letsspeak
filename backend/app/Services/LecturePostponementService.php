<?php

namespace App\Services;

use App\Models\Lecture;
use App\Models\Course;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * LecturePostponementService
 * 
 * Handles all business logic related to postponing lectures.
 * 
 * CORE PRINCIPLE:
 * When a lecture is postponed, the ORIGINAL lecture is NEVER deleted or modified
 * (except for its status). Instead, a NEW lecture is created with the new date/time.
 * This preserves the original schedule for history, reporting, and financial calculations.
 * 
 * WORKFLOW:
 * 1. Validate the lecture can be postponed
 * 2. Check course postponement limits
 * 3. Detect time conflicts for the new date/time
 * 4. Mark original lecture as postponed
 * 5. Create new makeup lecture with the new schedule
 * 
 * CONFLICT RULES:
 * - Trainers cannot override conflicts
 * - Customer Service and Admin can override with explicit force flag
 */
class LecturePostponementService
{
    /**
     * Result codes for postponement operations
     */
    const RESULT_SUCCESS = 'success';
    const RESULT_ERROR_CANNOT_POSTPONE = 'cannot_postpone';
    const RESULT_ERROR_MAX_POSTPONEMENTS = 'max_postponements_reached';
    const RESULT_ERROR_CONFLICT = 'time_conflict';
    const RESULT_ERROR_INVALID_DATE = 'invalid_date';
    const RESULT_ERROR_PERMISSION_DENIED = 'permission_denied';

    /**
     * Postpone a lecture to a new date/time.
     * 
     * @param Lecture $lecture The lecture to postpone
     * @param string $newDate The new date (Y-m-d format)
     * @param string|null $newTime The new time (H:i format)
     * @param string $postponedBy Who is postponing (trainer, student, customer_service, admin)
     * @param string|null $reason Reason for postponement
     * @param object|null $user The user performing the action (User model or stdClass with role)
     * @param bool $force Force override of conflicts (only for privileged roles)
     * 
     * @return array ['success' => bool, 'code' => string, 'message' => string, 'data' => array|null]
     */
    public function postpone(
        Lecture $lecture,
        string $newDate,
        ?string $newTime,
        string $postponedBy,
        ?string $reason = null,
        ?object $user = null,
        bool $force = false
    ): array {
        // Step 1: Validate the lecture can be postponed
        if (!$lecture->canBePostponed()) {
            return $this->errorResponse(
                self::RESULT_ERROR_CANNOT_POSTPONE,
                'هذه المحاضرة لا يمكن تأجيلها. قد تكون مكتملة أو مؤجلة مسبقاً.'
            );
        }

        // Step 2: Parse the new date (past dates are allowed for corrections)
        $newDateCarbon = Carbon::parse($newDate);

        // Step 3: Check course postponement limits
        $limitCheck = $this->checkPostponementLimit($lecture->course);
        if (!$limitCheck['allowed']) {
            return $this->errorResponse(
                self::RESULT_ERROR_MAX_POSTPONEMENTS,
                $limitCheck['message']
            );
        }

        // Step 4: Check for time conflicts
        $conflictCheck = $this->checkTimeConflicts(
            $lecture->course,
            $newDate,
            $newTime,
            $lecture->id
        );

        if ($conflictCheck['has_conflict']) {
            // Check if user can override
            if (!$this->canOverrideConflict($user, $force)) {
                return $this->errorResponse(
                    self::RESULT_ERROR_CONFLICT,
                    $conflictCheck['message'],
                    ['conflicts' => $conflictCheck['conflicts']]
                );
            }
            // Log the override
            Log::info('Conflict override by user', [
                'user_id' => $user?->id,
                'lecture_id' => $lecture->id,
                'conflicts' => $conflictCheck['conflicts']
            ]);
        }

        // Add specific rule: Can't postpone to a day which already has another lecture for the SAME course
        // (Unless we are in cascade mode where everything shifts, but even then, shifting to an existing day is tricky, 
        //  but the rule primarily prevents putting two lectures of the same course on the exact same date manually)
        $sameDayLectureExists = Lecture::where('course_id', $lecture->course->id)
            ->where('id', '!=', $lecture->id)
            ->whereDate('date', $newDateCarbon->format('Y-m-d'))
            ->whereNotIn('attendance', [
                Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
                Lecture::ATTENDANCE_POSTPONED_BY_STUDENT,
                Lecture::ATTENDANCE_POSTPONED_HOLIDAY
            ])
            ->exists();

        if ($sameDayLectureExists && !$this->courseHasDay($lecture->course, $newDate)) {
            // If it's a day that causes cascading, the cascade logic will push the existing one.
            // But if it's NOT a course day (meaning it generates a makeup), it should fail if there's already a lecture.
             return $this->errorResponse(
                self::RESULT_ERROR_CONFLICT,
                'لا يمكن جدولة محاضرة في يوم يحتوي بالفعل على محاضرة أخرى لنفس الكورس.'
             );
        }

        // Step 5: Decide path: if new date is a course day → cascade; else normal makeup
        $course = $lecture->course;
        $course->loadMissing('coursePackage');
        $newDateCarbon = Carbon::parse($newDate);
        $newTimeResolved = $newTime ?? $lecture->time ?? $course->lecture_time;

        if ($this->courseHasDay($course, $newDate)) {
            return $this->postponeWithCascade($lecture, $newDate, $newTimeResolved, $postponedBy, $reason);
        }

        // Normal path: mark original postponed + create makeup
        try {
            return DB::transaction(function () use ($lecture, $newDate, $newTime, $postponedBy, $reason) {
                $this->markAsPostponed($lecture, $postponedBy, $reason);
                $newLecture = $this->createMakeupLecture($lecture, $newDate, $newTime);
                $lecture->course->increment('postponements_used');

                return $this->successResponse(
                    'تم تأجيل المحاضرة بنجاح وإنشاء محاضرة تعويضية.',
                    [
                        'original_lecture' => $lecture->fresh(),
                        'new_lecture' => $newLecture,
                    ]
                );
            });
        } catch (\Exception $e) {
            Log::error('Postponement failed', [
                'lecture_id' => $lecture->id,
                'error' => $e->getMessage()
            ]);
            
            return $this->errorResponse(
                'error',
                'حدث خطأ أثناء تأجيل المحاضرة: ' . $e->getMessage()
            );
        }
    }

    /**
     * Max postponements for a course: from package (بمزاجي/التوازن=1, السرعة=3) or 3 for custom.
     * Never returns 0: if DB has null/0 (e.g. migration not run), fallback to 3.
     */
    public function getMaxPostponementsForCourse(Course $course): int
    {
        $course->loadMissing('coursePackage');
        if ($course->coursePackage) {
            $name = $course->coursePackage->name ?? '';
            if (str_contains($name, 'سرعة') || str_contains($name, 'السرعة')) {
                return 3;
            }
            if (str_contains($name, 'مزاجي') || str_contains($name, 'توازن') || str_contains($name, 'التوازن')) {
                return 1;
            }
            
            // Fallback to database value if names don't match exactly
            $max = (int) $course->coursePackage->max_postponements;
            return $max > 0 ? $max : 3;
        }
        return 3; // كورس مخصص
    }

    /**
     * Check if the course has reached its postponement limit.
     *
     * @param Course $course
     * @return array ['allowed' => bool, 'message' => string, 'current' => int, 'max' => int]
     */
    public function checkPostponementLimit(Course $course): array
    {
        $maxPostponements = $this->getMaxPostponementsForCourse($course);
        $currentPostponements = $course->postponement_count;

        if ($currentPostponements >= $maxPostponements) {
            return [
                'allowed' => false,
                'message' => "تم الوصول للحد الأقصى من التأجيلات ({$maxPostponements}). لا يمكن تأجيل المزيد من المحاضرات.",
                'current' => $currentPostponements,
                'max' => $maxPostponements,
            ];
        }

        return [
            'allowed' => true,
            'message' => "يمكن تأجيل المحاضرة. التأجيلات الحالية: {$currentPostponements}/{$maxPostponements}",
            'current' => $currentPostponements,
            'max' => $maxPostponements,
        ];
    }

    /**
     * Check for time conflicts at the specified date/time.
     * 
     * Conflict Rules:
     * - Same trainer cannot have two lectures at the same date+time
     * - Checks only active (non-cancelled, non-postponed) lectures
     * 
     * @param Course $course
     * @param string $date
     * @param string|null $time
     * @param int|null $excludeLectureId Lecture to exclude from check (the one being postponed)
     * @return array ['has_conflict' => bool, 'message' => string, 'conflicts' => array]
     */
    public function checkTimeConflicts(
        Course $course,
        string $date,
        ?string $time,
        ?int $excludeLectureId = null
    ): array {
        $trainerId = $course->trainer_id;
        $conflicts = [];

        // Log the conflict check parameters
        Log::info('Checking time conflicts', [
            'trainer_id' => $trainerId,
            'date' => $date,
            'time' => $time,
            'exclude_lecture_id' => $excludeLectureId,
        ]);

        // Check trainer conflicts
        $query = Lecture::forTrainer($trainerId)
            ->atDateTime($date, $time)
            ->active()
            ->when($excludeLectureId, function ($query) use ($excludeLectureId) {
                $query->where('id', '!=', $excludeLectureId);
            })
            ->with('course');

        // Log the SQL query for debugging
        Log::info('Conflict query SQL', [
            'sql' => $query->toSql(),
            'bindings' => $query->getBindings(),
        ]);

        $trainerConflicts = $query->get();

        Log::info('Conflict check results', [
            'conflicts_found' => $trainerConflicts->count(),
            'conflict_ids' => $trainerConflicts->pluck('id')->toArray(),
        ]);

        foreach ($trainerConflicts as $conflict) {
            $conflicts[] = [
                'type' => 'trainer',
                'lecture_id' => $conflict->id,
                'course_title' => $conflict->course->title ?? 'N/A',
                'date' => $conflict->date->format('Y-m-d'),
                'time' => $conflict->time,
                'message' => "المدرب لديه محاضرة في نفس الوقت للكورس: " . ($conflict->course->title ?? 'N/A'),
            ];
        }

        if (!empty($conflicts)) {
            return [
                'has_conflict' => true,
                'message' => 'يوجد تعارض في المواعيد. المدرب لديه محاضرة أخرى في نفس الوقت.',
                'conflicts' => $conflicts,
            ];
        }

        return [
            'has_conflict' => false,
            'message' => 'لا يوجد تعارض في المواعيد.',
            'conflicts' => [],
        ];
    }

    /**
     * Check if the user can override a time conflict.
     * 
     * Rules:
     * - Trainers CANNOT override conflicts
     * - Customer Service and Admin CAN override with force=true
     * 
     * @param object|null $user
     * @param bool $force
     * @return bool
     */
    protected function canOverrideConflict(?object $user, bool $force): bool
    {
        if (!$force) {
            return false;
        }

        if (!$user) {
            return false;
        }

        // Only customer_service and admin can override
        $allowedRoles = ['customer_service', 'admin'];
        
        return in_array($user->role, $allowedRoles);
    }

    /**
     * Mark the original lecture as postponed.
     * 
     * This does NOT delete or modify the original date/time.
     * It only updates the status and postponement metadata.
     * 
     * @param Lecture $lecture
     * @param string $postponedBy
     * @param string|null $reason
     */
    protected function markAsPostponed(Lecture $lecture, string $postponedBy, ?string $reason): void
    {
        $attendanceMap = [
            Lecture::POSTPONED_BY_TRAINER => Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
            Lecture::POSTPONED_BY_STUDENT => Lecture::ATTENDANCE_POSTPONED_BY_STUDENT,
            Lecture::POSTPONED_BY_CUSTOMER_SERVICE => Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
            Lecture::POSTPONED_BY_ADMIN => Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
            Lecture::POSTPONED_BY_HOLIDAY => Lecture::ATTENDANCE_POSTPONED_HOLIDAY,
        ];

        // Store reason in notes field (since postpone_reason column doesn't exist)
        $reasonText = $reason ? "سبب التأجيل: {$reason}" : null;

        $lecture->update([
            'attendance' => $attendanceMap[$postponedBy] ?? Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
            'notes' => $reasonText,
        ]);
    }

    /**
     * Create a new makeup lecture for the postponed lecture.
     * 
     * The new lecture:
     * - Has a new lecture_number (appended at the end)
     * - Is marked as is_makeup=true
     * - Links back to the original via original_lecture_id
     * - Has status=planned (ready to be attended)
     * 
     * @param Lecture $originalLecture
     * @param string $newDate
     * @param string|null $newTime
     * @return Lecture
     */
    protected function createMakeupLecture(Lecture $originalLecture, string $newDate, ?string $newTime): Lecture
    {
        $course = $originalLecture->course;
        
        // Get next lecture number (append at end)
        // This preserves the original schedule structure
        $maxLectureNumber = $course->lectures()->max('lecture_number') ?? 0;
        $newLectureNumber = $maxLectureNumber + 1;

        // Increment the course's total lectures count
        $course->increment('lectures_count');

        // Use the new time, or fall back to original lecture time, or course default time
        $lectureTime = $newTime ?? $originalLecture->time ?? $course->lecture_time;

        return Lecture::create([
            'course_id' => $course->id,
            'lecture_number' => $newLectureNumber,
            'date' => $newDate,
            'time' => $lectureTime,
            'attendance' => Lecture::ATTENDANCE_PENDING,
            'trainer_payment_status' => 'unpaid',
            'is_makeup' => true,
            'makeup_for' => $originalLecture->id,
            'notes' => "محاضرة تعويضية للمحاضرة رقم {$originalLecture->lecture_number}",
        ]);
    }

    /**
     * Cancel a postponement and delete the makeup lecture.
     * 
     * When cancelling a postponement:
     * 1. The original lecture is restored to 'planned' status
     * 2. The makeup lecture (if exists) is DELETED
     * 3. The course lectures count is decremented
     * 
     * @param Lecture $lecture The originally postponed lecture
     * @return array ['success' => bool, 'message' => string, 'data' => array|null]
     */
    public function cancelPostponement(Lecture $lecture): array
    {
        // Check if lecture is actually postponed
        if (!$lecture->isPostponed()) {
            return $this->errorResponse(
                'not_postponed',
                'هذه المحاضرة ليست مؤجلة.'
            );
        }

        try {
            return DB::transaction(function () use ($lecture) {
                // Find and delete the makeup lecture (using makeup_for field)
                $makeupLecture = Lecture::where('makeup_for', $lecture->id)->first();
                
                if ($makeupLecture) {
                    // Check if makeup lecture has been completed - don't delete if so
                    if ($makeupLecture->isCompleted()) {
                        return $this->errorResponse(
                            'makeup_completed',
                            'لا يمكن إلغاء التأجيل لأن المحاضرة التعويضية قد اكتملت.'
                        );
                    }
                    
                    // Decrement course lectures count and postponements used
                    $lecture->course->decrement('lectures_count');
                    if ($lecture->course->postponements_used > 0) {
                        $lecture->course->decrement('postponements_used');
                    }
                    
                    // Delete the makeup lecture
                    $makeupLecture->delete();
                    
                    Log::info('Makeup lecture deleted', [
                        'original_lecture_id' => $lecture->id,
                        'makeup_lecture_id' => $makeupLecture->id,
                    ]);
                }

                // Restore original lecture to pending status
                $lecture->update([
                    'attendance' => Lecture::ATTENDANCE_PENDING,
                    'notes' => null,
                ]);

                return $this->successResponse(
                    'تم إلغاء التأجيل وحذف المحاضرة التعويضية بنجاح.',
                    [
                        'lecture' => $lecture->fresh(),
                        'makeup_deleted' => $makeupLecture ? true : false,
                    ]
                );
            });
        } catch (\Exception $e) {
            Log::error('Cancel postponement failed', [
                'lecture_id' => $lecture->id,
                'error' => $e->getMessage()
            ]);
            
            return $this->errorResponse(
                'error',
                'حدث خطأ أثناء إلغاء التأجيل: ' . $e->getMessage()
            );
        }
    }

    /**
     * Get postponement statistics for a course.
     * 
     * @param Course $course
     * @return array
     */
    public function getPostponementStats(Course $course): array
    {
        $totalPostponements = $course->postponement_count;
        $makeupLectures = $course->lectures()->makeup()->count();
        $maxAllowed = $this->getMaxPostponementsForCourse($course);
        $remaining = max(0, $maxAllowed - $totalPostponements);

        return [
            'total_postponements' => $totalPostponements,
            'makeup_lectures_created' => $makeupLectures,
            'max_allowed' => $maxAllowed,
            'remaining' => $remaining,
            'can_postpone' => $remaining > 0,
        ];
    }

    /**
     * Carbon dayOfWeek (0=Sun..6=Sat) to short key.
     */
    protected function dayOfWeekToKey(int $dayOfWeek): string
    {
        $map = [0 => 'sun', 1 => 'mon', 2 => 'tue', 3 => 'wed', 4 => 'thu', 5 => 'fri', 6 => 'sat'];
        return $map[$dayOfWeek] ?? 'sun';
    }

    /**
     * Normalize course lecture_days to lowercase short keys (sun, mon, ...).
     */
    protected function normalizeLectureDays(Course $course): array
    {
        $days = $course->lecture_days ?? [];
        $longToShort = [
            'sunday' => 'sun', 'monday' => 'mon', 'tuesday' => 'tue', 'wednesday' => 'wed',
            'thursday' => 'thu', 'friday' => 'fri', 'saturday' => 'sat',
        ];
        $result = [];
        foreach ($days as $d) {
            $key = is_string($d) ? strtolower($d) : '';
            if (strlen($key) === 3) {
                $result[] = $key;
            } elseif (isset($longToShort[$key])) {
                $result[] = $longToShort[$key];
            }
        }
        return array_values(array_unique($result));
    }

    /**
     * Whether the given date (Y-m-d) falls on a course lecture day.
     */
    public function courseHasDay(Course $course, string $dateYmd): bool
    {
        $courseDays = $this->normalizeLectureDays($course);
        if (empty($courseDays)) {
            return false;
        }
        $dayOfWeek = Carbon::parse($dateYmd)->dayOfWeek;
        $key = $this->dayOfWeekToKey($dayOfWeek);
        return in_array($key, $courseDays, true);
    }

    /**
     * First course day on or after the given date. Returns ['date' => 'Y-m-d', 'time' => 'H:i'].
     */
    public function getNextCourseDayAfter(Course $course, string $afterDateYmd, ?string $time = null): array
    {
        $courseDays = $this->normalizeLectureDays($course);
        if (empty($courseDays)) {
            $fallback = Carbon::parse($afterDateYmd)->addDay()->format('Y-m-d');
            return ['date' => $fallback, 'time' => $time ?? $course->lecture_time ?? '09:00'];
        }

        $dayMap = ['sun' => 0, 'mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6];
        $dayOrder = array_map(fn ($k) => $dayMap[$k] ?? 0, $courseDays);
        $current = Carbon::parse($afterDateYmd)->startOfDay();
        $maxIterations = 14;
        $iterations = 0;

        while ($iterations < $maxIterations) {
            $dow = $current->dayOfWeek;
            if (in_array($dow, $dayOrder, true)) {
                return [
                    'date' => $current->format('Y-m-d'),
                    'time' => $time ?? $course->lecture_time ?? '09:00',
                ];
            }
            $current->addDay();
            $iterations++;
        }

        $fallback = Carbon::parse($afterDateYmd)->addDay()->format('Y-m-d');
        return ['date' => $fallback, 'time' => $time ?? $course->lecture_time ?? '09:00'];
    }

    /**
     * Postpone by shifting: move this lecture to new date and shift all subsequent lectures.
     * New date must be a course day (caller checks).
     */
    protected function postponeWithCascade(
        Lecture $lecture,
        string $newDate,
        ?string $newTime,
        string $postponedBy,
        ?string $reason = null
    ): array {
        $course = $lecture->course;
        $courseDays = $this->normalizeLectureDays($course);
        if (empty($courseDays)) {
            return $this->errorResponse(self::RESULT_ERROR_INVALID_DATE, 'أيام الكورس غير محددة.');
        }

        $dayMap = ['sun' => 0, 'mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6];
        $dayOrder = array_values(array_map(fn ($k) => $dayMap[$k] ?? 0, $courseDays));

        // All lectures (including makeup) ordered by date, time, id — exclude already postponed
        $ordered = $course->lectures()
            ->whereNotIn('attendance', [
                Lecture::ATTENDANCE_POSTPONED_BY_TRAINER,
                Lecture::ATTENDANCE_POSTPONED_BY_STUDENT,
                Lecture::ATTENDANCE_POSTPONED_HOLIDAY,
            ])
            ->orderBy('date')
            ->orderBy('time')
            ->orderBy('id')
            ->get();

        $idx = $ordered->search(fn ($l) => (int) $l->id === (int) $lecture->id);
        if ($idx === false || $idx === null) {
            return $this->errorResponse(self::RESULT_ERROR_CANNOT_POSTPONE, 'المحاضرة غير موجودة في الجدول.');
        }

        $time = $newTime ?? $lecture->time ?? $course->lecture_time ?? '09:00';
        $currentDate = Carbon::parse($newDate)->startOfDay();

        // Build new dates for this lecture and all following
        $updates = [];
        foreach ($ordered as $i => $l) {
            if ($i < $idx) {
                continue;
            }
            $updates[] = [
                'lecture' => $l,
                'date' => $currentDate->format('Y-m-d'),
                'time' => $time,
            ];
            // Next course day
            $dow = $currentDate->dayOfWeek;
            $pos = array_search($dow, $dayOrder, true);
            $nextPos = $pos === false ? 0 : (($pos + 1) % count($dayOrder));
            $nextDow = $dayOrder[$nextPos];
            $currentDate->addDay();
            while ($currentDate->dayOfWeek !== $nextDow) {
                $currentDate->addDay();
            }
        }

        try {
            return DB::transaction(function () use ($lecture, $postponedBy, $reason, $updates) {
                // 1. Mark the original lecture as postponed
                $this->markAsPostponed($lecture, $postponedBy, $reason);

                // 2. The first item in $updates corresponds to the original lecture's new slot. 
                // We create a makeup lecture here instead of mutating the original lecture's date.
                $firstUpdate = $updates[0];
                $newLecture = $this->createMakeupLecture($lecture, $firstUpdate['date'], $firstUpdate['time']);

                // 3. Shift the rest of the subsequent lectures
                $count = count($updates);
                for ($i = 1; $i < $count; $i++) {
                    $u = $updates[$i];
                    $u['lecture']->update([
                        'date' => $u['date'],
                        'time' => $u['time'],
                    ]);
                }

                $lecture->course->increment('postponements_used');

                return $this->successResponse(
                    'تم تأجيل المحاضرة بنجاح مع زحف بقية المحاضرات وإنشاء محاضرة تعويضية.',
                    [
                        'original_lecture' => $lecture->fresh(),
                        'new_lecture_id' => $newLecture->id,
                        'shifted_count' => $count - 1,
                    ]
                );
            });
        } catch (\Exception $e) {
            Log::error('Postponement cascade failed', ['lecture_id' => $lecture->id, 'error' => $e->getMessage()]);
            return $this->errorResponse('error', 'حدث خطأ أثناء تأجيل المحاضرة: ' . $e->getMessage());
        }
    }

    /**
     * Build a success response.
     */
    protected function successResponse(string $message, array $data = []): array
    {
        return [
            'success' => true,
            'code' => self::RESULT_SUCCESS,
            'message' => $message,
            'data' => $data,
        ];
    }

    /**
     * Build an error response.
     */
    protected function errorResponse(string $code, string $message, array $data = []): array
    {
        return [
            'success' => false,
            'code' => $code,
            'message' => $message,
            'data' => $data,
        ];
    }
}

