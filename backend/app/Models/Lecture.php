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
        'lecture_number',
        'date',
        'time',
        'attendance',
        'activity',
        'homework',
        'is_makeup',
        'makeup_for',
        'notes',
        'is_completed',
        'student_attendance',
    ];

    protected $casts = [
        'date' => 'date',
        'is_makeup' => 'boolean',
        'is_completed' => 'boolean',
        'student_attendance' => 'array',
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
     * Get the trainer through the course.
     * Provides quick access to the trainer for conflict detection.
     */
    public function trainer()
    {
        return $this->course?->trainer;
    }

    /**
     * Get the original lecture if this is a makeup lecture.
     * 
     * When a lecture is postponed, a new "makeup" lecture is created.
     * This relationship links the makeup lecture back to the original.
     */
    public function originalLecture(): BelongsTo
    {
        return $this->belongsTo(Lecture::class, 'original_lecture_id');
    }

    /**
     * Get the makeup lecture if this lecture was postponed.
     * 
     * Inverse of originalLecture relationship.
     * Returns the new lecture that was created when this one was postponed.
     */
    public function makeupLecture(): HasOne
    {
        return $this->hasOne(Lecture::class, 'original_lecture_id');
    }

    /**
     * Check if lecture is completed (present or partially attended).
     */
    public function isCompleted(): bool
    {
        return in_array($this->attendance, [self::ATTENDANCE_PRESENT, self::ATTENDANCE_PARTIALLY]);
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
            self::ATTENDANCE_POSTPONED_BY_STUDENT
        ]);
    }

    /**
     * Check if this is a makeup lecture (created from postponement).
     */
    public function isMakeup(): bool
    {
        return $this->is_makeup === true || $this->original_lecture_id !== null;
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
            self::ATTENDANCE_POSTPONED_BY_STUDENT
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
     * Scope: For a specific trainer (through course).
     */
    public function scopeForTrainer($query, int $trainerId)
    {
        return $query->whereHas('course', function ($q) use ($trainerId) {
            $q->where('trainer_id', $trainerId);
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
