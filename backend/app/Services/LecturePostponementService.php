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

        // Step 5: Perform the postponement in a transaction
        try {
            return DB::transaction(function () use ($lecture, $newDate, $newTime, $postponedBy, $reason) {
                // Mark original lecture as postponed
                $this->markAsPostponed($lecture, $postponedBy, $reason);

                // Create new makeup lecture
                $newLecture = $this->createMakeupLecture($lecture, $newDate, $newTime);

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
     * Check if the course has reached its postponement limit.
     * 
     * The limit is configurable via config('courses.max_postponements').
     * Default is 3 postponements per course.
     * 
     * @param Course $course
     * @return array ['allowed' => bool, 'message' => string, 'current' => int, 'max' => int]
     */
    public function checkPostponementLimit(Course $course): array
    {
        $maxPostponements = config('courses.max_postponements', 3);
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
            'payment_status' => 'unpaid',
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
                    
                    // Decrement course lectures count
                    $lecture->course->decrement('lectures_count');
                    
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
        $totalPostponements = $course->lectures()->postponed()->count();
        $makeupLectures = $course->lectures()->makeup()->count();
        $maxAllowed = config('courses.max_postponements', 3);
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

