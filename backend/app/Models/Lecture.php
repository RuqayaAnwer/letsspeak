<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Lecture Model
 * 
 * Represents a single lecture in a course schedule.
 * 
 * POSTPONEMENT LOGIC:
 * When a lecture is postponed, the original lecture record is NOT deleted.
 * Instead:
 * 1. The original lecture's status is set to 'postponed'
 * 2. A NEW lecture record is created with:
 *    - is_makeup = true
 *    - original_lecture_id = original lecture's ID
 *    - The new date/time chosen by the user
 * 
 * This preserves the original schedule for history and reporting purposes.
 */
class Lecture extends Model
{
    use HasFactory;

    /**
     * Lecture status constants
     */
    const STATUS_PLANNED = 'planned';
    const STATUS_COMPLETED = 'completed';
    const STATUS_POSTPONED = 'postponed';
    const STATUS_CANCELLED = 'cancelled';

    /**
     * Attendance status constants
     */
    const ATTENDANCE_PENDING = 'pending';
    const ATTENDANCE_PRESENT = 'present';
    const ATTENDANCE_PARTIALLY = 'partially';
    const ATTENDANCE_ABSENT = 'absent';
    const ATTENDANCE_EXCUSED = 'excused';
    const ATTENDANCE_POSTPONED_BY_TRAINER = 'postponed_by_trainer';
    const ATTENDANCE_POSTPONED_BY_STUDENT = 'postponed_by_student';
    const ATTENDANCE_POSTPONED_HOLIDAY = 'postponed_holiday';

    /**
     * Postponed by constants
     */
    const POSTPONED_BY_TRAINER = 'trainer';
    const POSTPONED_BY_STUDENT = 'student';
    const POSTPONED_BY_CUSTOMER_SERVICE = 'customer_service';
    const POSTPONED_BY_ADMIN = 'admin';
    const POSTPONED_BY_HOLIDAY = 'holiday';

    protected $fillable = [
        'course_id',
        'trainer_id',
        'lecture_number',
        'date',
        'time',
        'attendance',
        'activity',
        'homework',
        'is_makeup',
        'makeup_for',
        'notes',
        'trainer_payment_status',
        'is_extra',
    ];

    protected $casts = [
        'date' => 'date',
        'is_makeup' => 'boolean',
    ];

    protected $appends = [
        'is_completed',
        'student_attendance',
        'trainer_name',
        'trainer_id_actual'
    ];

    /**
     * Get the course that owns the lecture.
     */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * Get the students with their attendance data for this lecture.
     */
    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'lecture_students')
            ->withPivot('attendance', 'activity', 'homework', 'notes')
            ->withTimestamps();
    }

    /**
     * Get the explicit trainer relation.
     */
    public function lectureTrainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class, 'trainer_id');
    }

    /**
     * Get the trainer through the lecture or the course fallback.
     * Provides quick access to the trainer for conflict detection.
     */
    public function trainer()
    {
        if ($this->trainer_id) {
            return $this->lectureTrainer ?? Trainer::find($this->trainer_id);
        }
        return $this->course?->trainer;
    }

    /**
     * Get the trainer's name for this lecture.
     */
    public function getTrainerNameAttribute(): ?string
    {
        $trainer = $this->trainer();
        return $trainer?->user?->name ?? $trainer?->name ?? null;
    }

    /**
     * Get the actual trainer's ID for this lecture.
     */
    public function getTrainerIdActualAttribute(): ?int
    {
        return $this->trainer_id ?: $this->course?->trainer_id;
    }

    /**
     * Get the original lecture if this is a makeup lecture.
     * 
     * When a lecture is postponed, a new "makeup" lecture is created.
     * This relationship links the makeup lecture back to the original.
     */
    public function originalLecture(): BelongsTo
    {
        return $this->belongsTo(Lecture::class, 'makeup_for');
    }

    /**
     * Get the makeup lecture if this lecture was postponed.
     * 
     * Inverse of originalLecture relationship.
     * Returns the new lecture that was created when this one was postponed.
     */
    public function makeupLecture(): HasOne
    {
        return $this->hasOne(Lecture::class, 'makeup_for');
    }

    /**
     * Get is_completed attribute automatically based on attendance.
     */
    public function getIsCompletedAttribute(): bool
    {
        if (in_array($this->attendance, [
            self::ATTENDANCE_PRESENT, 
            self::ATTENDANCE_PARTIALLY,
            self::ATTENDANCE_ABSENT
        ])) {
            return true;
        }

        if ($this->relationLoaded('students')) {
            foreach ($this->students as $student) {
                if (in_array($student->pivot->attendance, [
                    self::ATTENDANCE_PRESENT, 
                    self::ATTENDANCE_PARTIALLY,
                    self::ATTENDANCE_ABSENT
                ])) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get student attendance data from pivot table.
     */
    public function getStudentAttendanceAttribute()
    {
        if (!$this->relationLoaded('students')) {
            return null;
        }

        $attendance = [];
        foreach ($this->students as $student) {
            $attendance[$student->id] = [
                'attendance' => $student->pivot->attendance ?? 'pending',
                'activity' => $student->pivot->activity ?? '',
                'homework' => $student->pivot->homework ?? '',
                'notes' => $student->pivot->notes ?? '',
            ];
        }
        return $attendance;
    }

    /**
     * Check if lecture is completed (present or partially attended or absent).
     */
    public function isCompleted(): bool
    {
        return $this->getIsCompletedAttribute();
    }

    /**
     * Check if lecture is pending (not yet held).
     */
    public function isPending(): bool
    {
        return $this->attendance === self::ATTENDANCE_PENDING;
    }

    /**
     * Check if lecture was postponed.
     */
    public function isPostponed(): bool
    {
        return in_array($this->attendance, [
            self::ATTENDANCE_POSTPONED_BY_TRAINER,
            self::ATTENDANCE_POSTPONED_BY_STUDENT,
            self::ATTENDANCE_POSTPONED_HOLIDAY,
        ]);
    }

    /**
     * Check if this is a makeup lecture (created from postponement).
     */
    public function isMakeup(): bool
    {
        return $this->is_makeup === true || $this->makeup_for !== null;
    }

    /**
     * Check if lecture can be postponed.
     * 
     * Rules:
     * - Cannot postpone already completed lectures
     * - Cannot postpone already postponed lectures
     */
    public function canBePostponed(): bool
    {
        return !$this->isCompleted() && !$this->isPostponed();
    }

    /**
     * Check if a lecture can be modified based on its date/time.
     * - Future lectures: Cannot be modified
     * - Today's lectures: Can be modified (regardless of time)
     * - Past lectures: Can be modified
     */
    public function canBeModifiedArray(): array
    {
        $lectureDate = \Carbon\Carbon::parse($this->date)->startOfDay();
        $today = \Carbon\Carbon::today();

        // Always allow modification, matching frontend logic which allows editing/postponing future lectures
        return [
            'canModify' => true,
            'reason' => null,
            'type' => $lectureDate->gt($today) ? 'future' : ($lectureDate->eq($today) ? 'today' : 'past')
        ];
    }

    /**
     * Get the full datetime of this lecture.
     */
    public function getDateTimeAttribute(): ?\DateTime
    {
        if (!$this->date) {
            return null;
        }
        
        $dateStr = $this->date->format('Y-m-d');
        $timeStr = $this->time ?? '00:00';
        
        return new \DateTime("{$dateStr} {$timeStr}");
    }

    /**
     * Scope: Planned/Pending lectures.
     */
    public function scopePlanned($query)
    {
        return $query->where('attendance', self::ATTENDANCE_PENDING);
    }

    /**
     * Scope: Completed lectures.
     */
    public function scopeCompleted($query)
    {
        return $query->whereIn('attendance', [self::ATTENDANCE_PRESENT, self::ATTENDANCE_PARTIALLY]);
    }

    /**
     * Scope: Postponed lectures.
     */
    public function scopePostponed($query)
    {
        return $query->whereIn('attendance', [
            self::ATTENDANCE_POSTPONED_BY_TRAINER,
            self::ATTENDANCE_POSTPONED_BY_STUDENT,
            self::ATTENDANCE_POSTPONED_HOLIDAY,
        ]);
    }

    /**
     * Scope: Pending lectures.
     */
    public function scopePending($query)
    {
        return $query->where('attendance', self::ATTENDANCE_PENDING);
    }

    /**
     * Scope: Makeup lectures only.
     */
    public function scopeMakeup($query)
    {
        return $query->where('is_makeup', true);
    }

    /**
     * Scope: By date range.
     */
    public function scopeInDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('date', [$startDate, $endDate]);
    }

    /**
     * Scope: For month.
     */
    public function scopeForMonth($query, int $month, int $year)
    {
        return $query->whereMonth('date', $month)->whereYear('date', $year);
    }

    /**
     * Scope: For a specific trainer (directly or through course fallback).
     */
    public function scopeForTrainer($query, int $trainerId)
    {
        return $query->where(function ($q) use ($trainerId) {
            $q->where('lectures.trainer_id', $trainerId)
              ->orWhere(function ($sub) use ($trainerId) {
                  $sub->whereNull('lectures.trainer_id')
                      ->whereHas('course', function ($c) use ($trainerId) {
                          $c->where('trainer_id', $trainerId);
                      });
              });
        });
    }

    /**
     * Scope: At specific date and time.
     * Used for conflict detection.
     * Uses whereDate() for SQLite compatibility.
     */
    public function scopeAtDateTime($query, string $date, ?string $time = null)
    {
        // Use whereDate for proper date comparison in SQLite
        $query->whereDate('date', $date);
        
        if ($time) {
            $query->where('time', $time);
        }
        
        return $query;
    }

    /**
     * Scope: Exclude postponed lectures (for conflict detection).
     */
    public function scopeActive($query)
    {
        return $query->whereNotIn('attendance', [
            self::ATTENDANCE_POSTPONED_BY_TRAINER,
            self::ATTENDANCE_POSTPONED_BY_STUDENT
        ]);
    }
}
