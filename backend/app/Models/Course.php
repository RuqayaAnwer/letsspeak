<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'trainer_id',
        'course_type_id',
        'course_package_id',
        'title',
        'lectures_count',
        'start_date',
        'lecture_time',
        'lecture_days',
        'status',
        'payment_method',
        'subscription_source',
        'renewed_with_trainer',
        'amount_updates',
        'total_amount',
        'amount_paid',
        'notes',
        'finished_at',
        'is_dual',
        'trainer_payment_status',
        'renewal_status',
        'renewal_alert_status',
        'last_evaluation_milestone',
    ];

    protected $casts = [
        'lecture_days' => 'array',
        'start_date' => 'date',
        'finished_at' => 'datetime',
        'renewed_with_trainer' => 'boolean',
        'is_dual' => 'boolean',
        'total_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
    ];

    protected $appends = ['is_custom'];

    /**
     * Get the trainer for this course.
     */
    public function trainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class);
    }

    /**
     * Get the course type.
     */
    public function courseType(): BelongsTo
    {
        return $this->belongsTo(CourseType::class);
    }

    /**
     * Get the course package.
     */
    public function coursePackage(): BelongsTo
    {
        return $this->belongsTo(CoursePackage::class);
    }

    /**
     * Alias for coursePackage.
     */
    public function package(): BelongsTo
    {
        return $this->belongsTo(CoursePackage::class, 'course_package_id');
    }

    /**
     * Get all students enrolled in this course.
     */
    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'course_students')
            ->withPivot('is_primary', 'created_at');
    }

    /**
     * Get the primary student (for single-student courses).
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    /**
     * Get all lectures for this course.
     */
    public function lectures(): HasMany
    {
        return $this->hasMany(Lecture::class);
    }

    /**
     * Get all payments for this course.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Get status history.
     */
    public function statusHistory(): HasMany
    {
        return $this->hasMany(CourseStatusHistory::class);
    }

    /**
     * Scope: Active courses.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: Finished courses.
     */
    public function scopeFinished($query)
    {
        return $query->where('status', 'finished');
    }

    /**
     * Scope: Paused courses.
     */
    public function scopePaused($query)
    {
        return $query->where('status', 'paused');
    }

    /**
     * Get completed lectures count.
     */
    public function getCompletedLecturesCountAttribute(): int
    {
        return $this->lectures()->where('attendance', 'present')->count();
    }

    /**
     * Get progress percentage.
     */
    public function getProgressAttribute(): int
    {
        if ($this->lectures_count <= 0) {
            return 0;
        }
        return (int) round(($this->completed_lectures_count / $this->lectures_count) * 100);
    }

    /**
     * Recalculate and update amount_paid from payments.
     */
    public function recalculateAmountPaid(): void
    {
        $this->amount_paid = $this->payments()->sum('amount');
        $this->save();
    }

    /**
     * Get remaining amount.
     */
    public function getRemainingAmountAttribute(): float
    {
        return max(0, ($this->total_amount ?? 0) - ($this->amount_paid ?? 0));
    }

    /**
     * Check if course is fully paid.
     */
    public function getIsFullyPaidAttribute(): bool
    {
        return $this->remaining_amount <= 0;
    }

    /**
     * Get formatted lecture time.
     */
    public function getFormattedLectureTimeAttribute(): string
    {
        if (!$this->lecture_time) {
            return '';
        }
        return date('h:i A', strtotime($this->lecture_time));
    }

    /**
     * Get Arabic day names.
     */
    public function getArabicDaysAttribute(): array
    {
        $dayNames = [
            'Sunday' => 'الأحد',
            'Monday' => 'الاثنين',
            'Tuesday' => 'الثلاثاء',
            'Wednesday' => 'الأربعاء',
            'Thursday' => 'الخميس',
            'Friday' => 'الجمعة',
            'Saturday' => 'السبت',
        ];

        $days = $this->lecture_days ?? [];
        return array_map(fn($day) => $dayNames[$day] ?? $day, $days);
    }

    /**
     * Check if course is custom (no course package).
     */
    public function getIsCustomAttribute(): bool
    {
        return $this->course_package_id === null;
    }
}
