<?php

namespace App\Http\Controllers;

use App\Models\Lecture;
use App\Models\Course;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Carbon\Carbon;

class LectureController extends Controller
{
    /**
     * Check if a lecture can be modified based on its date/time.
     * - Future lectures: Cannot be modified
     * - Today's lectures: Can be modified (regardless of time)
     * - Past lectures: Can be modified
     */
    protected function canModifyLecture(Lecture $lecture): array
    {
        $lectureDate = Carbon::parse($lecture->date)->startOfDay();
        $today = Carbon::today();

        // Future lecture (date is after today) - cannot be modified
        if ($lectureDate->gt($today)) {
            return [
                'canModify' => false,
                'reason' => 'لا يمكن تعديل محاضرة مستقبلية',
                'type' => 'future'
            ];
        }

        // Today's lecture or past lecture - can be modified
        return [
            'canModify' => true,
            'reason' => null,
            'type' => $lectureDate->eq($today) ? 'today' : 'past'
        ];
    }

    /**
     * Log lecture modification activity.
     */
    protected function logLectureModification(Lecture $lecture, array $oldData, array $newData, $user): void
    {
        $changes = [];
        
        foreach ($newData as $field => $newValue) {
            $oldValue = $oldData[$field] ?? null;
            if ($oldValue !== $newValue) {
                $changes[$field] = [
                    'old' => $oldValue,
                    'new' => $newValue
                ];
            }
        }

        if (!empty($changes)) {
            ActivityLog::create([
                'user_id' => $user->id,
                'action' => 'update',
                'model_type' => 'Lecture',
                'model_id' => $lecture->id,
                'description' => "تعديل المحاضرة رقم {$lecture->lecture_number} للكورس #{$lecture->course_id}",
                'old_values' => $oldData,
                'new_values' => $newData,
                'changes' => json_encode($changes),
            ]);
        }
    }

    /**
     * Display a listing of lectures for a course.
     */
    public function index(Request $request, Course $course)
    {
        // Check authorization for trainers
        if ($request->user()->isTrainer()) {
            $trainerId = $request->user()->trainer->id;
            if ($course->trainer_id !== $trainerId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        $lectures = $course->lectures()->orderBy('date')->orderBy('time')->get();

        return response()->json($lectures);
    }

    /**
     * Update the specified lecture.
     */
    public function update(Request $request, Lecture $lecture)
    {
        $user = $request->user();
        
        // Check authorization for trainers (use null-safe in case trainer relation is missing)
        if ($user->isTrainer()) {
            $trainer = $user->trainer;
            if (!$trainer) {
                return response()->json(['message' => 'ملف المدرب غير موجود.'], 403);
            }
            if ($lecture->course->trainer_id !== $trainer->id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        // For date/time-only requests, skip canModifyLecture restriction (allow future lectures)
        $isDateTimeOnly = ($request->has('date') || $request->has('time'))
            && !$request->hasAny(['attendance', 'activity', 'homework', 'notes']);

        if (!$isDateTimeOnly) {
            $canModify = $this->canModifyLecture($lecture);
            if (!$canModify['canModify']) {
                return response()->json([
                    'message' => $canModify['reason'],
                    'type' => $canModify['type']
                ], 422);
            }
        }

        $rules = [
            'attendance' => 'sometimes|in:present,absent,excused,pending',
            'activity' => 'nullable|string',
            'homework' => 'nullable|string',
            'notes' => 'nullable|string',
        ];

        // Trainers and customer_service can update date and time (any lecture, including future)
        if ($user->isTrainer() || $user->isCustomerService()) {
            $rules['date'] = 'sometimes|date_format:Y-m-d';
            $rules['time'] = 'sometimes|nullable|date_format:H:i';
        }

        $request->validate($rules);

        // Save old data for logging
        $oldData = $lecture->only(['attendance', 'activity', 'homework', 'notes', 'date', 'time', 'is_completed']);

        $updateData = $request->only(['attendance', 'activity', 'homework', 'notes', 'is_completed']);
        
        // Allow trainers and customer_service to update date and time
        if (($user->isTrainer() || $user->isCustomerService()) && $request->has('date')) {
            $updateData['date'] = $request->date;
        }
        if (($user->isTrainer() || $user->isCustomerService()) && $request->has('time')) {
            $updateData['time'] = $request->time;
        }

        // Auto-complete lecture when attendance is set to 'present' or 'absent'
        if ($request->has('attendance')) {
            $attendance = $request->input('attendance');
            if ($attendance === 'present' || $attendance === 'absent') {
                $updateData['is_completed'] = true;
            } elseif ($attendance === 'pending') {
                $updateData['is_completed'] = false;
            }
        }

        $lecture->update($updateData);

        // Log the modification (wrapped in try-catch so logging failure never breaks the update)
        try {
            $this->logLectureModification($lecture, $oldData, $updateData, $user);
        } catch (\Exception $e) {
            \Log::error('Failed to log lecture modification: ' . $e->getMessage());
        }

        return response()->json($lecture);
    }

    /**
     * Bulk update lectures.
     */
    public function bulkUpdate(Request $request, Course $course)
    {
        $user = $request->user();
        
        // Check authorization for trainers
        if ($user->isTrainer()) {
            $trainerId = $user->trainer->id;
            if ($course->trainer_id !== $trainerId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        $request->validate([
            'lectures' => 'required|array',
            'lectures.*.id' => 'required|exists:lectures,id',
            'lectures.*.attendance' => 'sometimes|in:present,absent,excused,pending',
            'lectures.*.activity' => 'nullable|string',
            'lectures.*.homework' => 'nullable|string',
            'lectures.*.notes' => 'nullable|string',
        ]);

        $skippedLectures = [];
        $updatedCount = 0;

        foreach ($request->lectures as $lectureData) {
            $lecture = Lecture::find($lectureData['id']);
            
            if ($lecture->course_id !== $course->id) {
                continue;
            }

            // Check if lecture can be modified
            $canModify = $this->canModifyLecture($lecture);
            if (!$canModify['canModify']) {
                $skippedLectures[] = [
                    'id' => $lecture->id,
                    'lecture_number' => $lecture->lecture_number,
                    'reason' => $canModify['reason']
                ];
                continue;
            }

            // Save old data for logging
            $oldData = $lecture->only(['attendance', 'activity', 'homework', 'notes', 'is_completed']);

            $updateData = array_filter([
                'attendance' => $lectureData['attendance'] ?? null,
                'activity' => $lectureData['activity'] ?? null,
                'homework' => $lectureData['homework'] ?? null,
                'notes' => $lectureData['notes'] ?? null,
                'is_completed' => $lectureData['is_completed'] ?? null,
            ], fn($v) => $v !== null);

            // Auto-complete lecture when attendance is set to 'present' or 'absent'
            if (isset($lectureData['attendance'])) {
                $attendance = $lectureData['attendance'];
                if ($attendance === 'present' || $attendance === 'absent') {
                    $updateData['is_completed'] = true;
                } elseif ($attendance === 'pending') {
                    // If attendance is reset to pending, mark as not completed
                    $updateData['is_completed'] = false;
                }
            }

            if (!empty($updateData)) {
                $lecture->update($updateData);
                
                // Log the modification
                $this->logLectureModification($lecture, $oldData, $updateData, $user);
                $updatedCount++;
            }
        }

        return response()->json([
            'lectures' => $course->lectures()->orderBy('date')->get(),
            'updated_count' => $updatedCount,
            'skipped' => $skippedLectures
        ]);
    }

    /**
     * Get lecture modification status (can it be edited?).
     */
    public function checkModifiable(Lecture $lecture)
    {
        $status = $this->canModifyLecture($lecture);
        
        return response()->json([
            'lecture_id' => $lecture->id,
            'can_modify' => $status['canModify'],
            'reason' => $status['reason'],
            'type' => $status['type']
        ]);
    }
}


