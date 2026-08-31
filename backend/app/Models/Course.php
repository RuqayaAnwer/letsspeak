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
        'actual_start_date',
        'lecture_time',
        'lecture_days',
        'status',
        'payment_method',
        'subscription_source',
        'renewed_with_trainer',
        'amount_updates',
        'total_amount',
        'amount_paid',
        'discount',
        'notes',
        'finished_at',
        'is_dual',
        'trainer_payment_status',
        'renewal_status',
        'renewal_alert_status',
        'last_evaluation_milestone',
        'postponements_used',
        'extra_lectures_count',
        'extra_lectures_fee',
        'student_max_postponements_override',
        'trainer_max_postponements_override',
        'renewal_iteration',
        'is_kids',
        'trainer_name',
    ];

    protected $casts = [
        'lecture_days' => 'array',
        'start_date' => 'date',
        'actual_start_date' => 'date',
        'finished_at' => 'datetime',
        'renewed_with_trainer' => 'boolean',
        'is_dual' => 'boolean',
        'total_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'is_kids' => 'boolean',
    ];

    protected $appends = [
        'is_custom',
        'student_price',
        'student_postponement_count',
        'trainer_postponement_count',
        'max_student_postponements',
        'max_trainer_postponements',
        'has_trainer_changed',
        'trainer_name'
    ];

    /**
     * Helper attribute to get max student postponements dynamically for the frontend.
     */
    public function getMaxStudentPostponementsAttribute(): int
    {
        $postponementService = app(\App\Services\LecturePostponementService::class);
        return $postponementService->getMaxPostponementsForCourse($this);
    }

    /**
     * Helper attribute to get max trainer postponements dynamically for the frontend.
     */
    public function getMaxTrainerPostponementsAttribute(): int
    {
        $postponementService = app(\App\Services\LecturePostponementService::class);
        return $postponementService->getTrainerMaxPostponementsForCourse($this);
    }

    /**
     * Check if the trainer has been changed during the course.
     */
    public function getHasTrainerChangedAttribute(): bool
    {
        if ($this->relationLoaded('lectures')) {
            return $this->lectures->contains(function ($lecture) {
                return $lecture->trainer_id !== null && $lecture->trainer_id != $this->trainer_id;
            });
        }
        if (array_key_exists('has_trainer_changed', $this->attributes)) {
            return (bool) $this->attributes['has_trainer_changed'];
        }
        return $this->lectures()->whereNotNull('trainer_id')->where('trainer_id', '!=', $this->trainer_id)->exists();
    }


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
            ->withPivot('is_primary', 'student_level', 'created_at');
    }

    /**
     * Get the primary student (for single-student courses).
     */
    public function student()
    {
        return $this->hasOneThrough(
            Student::class,
            CourseStudent::class,
            'course_id', // Foreign key on course_students table
            'id',        // Foreign key on students table
            'id',        // Local key on courses table
            'student_id' // Local key on course_students table
        )->where('course_students.is_primary', true);
    }

    /**
     * Get all lectures for this course (ordered by date then time).
     */
    public function lectures(): HasMany
    {
        return $this->hasMany(Lecture::class)->orderBy('date')->orderBy('time');
    }

    /**
     * Number of postponements used (total legacy fallback).
     */
    public function getPostponementCountAttribute(): int
    {
        return (int) ($this->attributes['postponements_used'] ?? 0);
    }

    /**
     * Get student postponements count.
     */
    public function getStudentPostponementCountAttribute(): int
    {
        if ($this->relationLoaded('lectures')) {
            return $this->lectures->where('attendance', Lecture::ATTENDANCE_POSTPONED_BY_STUDENT)->count();
        }
        if (array_key_exists('student_postponement_count', $this->attributes)) {
            return (int) $this->attributes['student_postponement_count'];
        }
        return $this->lectures()->where('attendance', Lecture::ATTENDANCE_POSTPONED_BY_STUDENT)->count();
    }

    /**
     * Get trainer postponements count.
     */
    public function getTrainerPostponementCountAttribute(): int
    {
        if ($this->relationLoaded('lectures')) {
            return $this->lectures->where('attendance', Lecture::ATTENDANCE_POSTPONED_BY_TRAINER)->count();
        }
        if (array_key_exists('trainer_postponement_count', $this->attributes)) {
            return (int) $this->attributes['trainer_postponement_count'];
        }
        return $this->lectures()->where('attendance', Lecture::ATTENDANCE_POSTPONED_BY_TRAINER)->count();
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
        if ($this->relationLoaded('lectures')) {
            return $this->lectures->where('attendance', 'present')->count();
        }
        if (array_key_exists('completed_lectures_count', $this->attributes)) {
            return (int) $this->attributes['completed_lectures_count'];
        }
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

    /**
     * Get the trainer name dynamically.
     */
    public function getTrainerNameAttribute(): string
    {
        if ($this->relationLoaded('trainer') && $this->trainer) {
            if ($this->trainer->user) {
                return $this->trainer->user->name;
            }
            return $this->trainer->name ?? '';
        }

        $trainer = $this->trainer;
        if ($trainer) {
            return $trainer->user ? $trainer->user->name : ($trainer->name ?? '');
        }

        return $this->attributes['trainer_name'] ?? '-';
    }

    /**
     * Get the exact price required from a single student for this course.
     * Replicates and replaces frontend JS logic for dual packages.
     */
    public function getStudentPriceAttribute(): float
    {
        $isDual = $this->is_dual;
        $pkgName = $this->coursePackage ? $this->coursePackage->name : '';
        
        $extraFee = $this->extra_lectures_fee ?? 0;
        if (is_string($extraFee)) {
            $extraFee = (float)str_replace(',', '', $extraFee);
        } else {
            $extraFee = (float)$extraFee;
        }

        // Retroactive Iraqi Dinar dot truncation fix
        if ($extraFee > 0 && $extraFee < 5000) {
            $extraFee *= 1000;
        }

        if ($isDual) {
            $basePrice = 0;
            if (mb_strpos($pkgName, 'بمزاجي') !== false || $pkgName === 'بمزاجي') {
                $basePrice = 90000;
            } elseif (mb_strpos($pkgName, 'توازن') !== false || mb_strpos($pkgName, 'التوازن') !== false || $pkgName === 'التوازن') {
                $basePrice = 135000;
            } elseif (mb_strpos($pkgName, 'سرعة') !== false || mb_strpos($pkgName, 'السرعة') !== false || $pkgName === 'السرعة') {
                $basePrice = 225000;
            }

            if ($basePrice > 0) {
                return $basePrice + ($extraFee / 2);
            }
            // Fallback for unknown dual packages
            $pkgPrice = $this->coursePackage ? $this->coursePackage->price : 0;
            if (is_string($pkgPrice)) $pkgPrice = (float)str_replace(',', '', $pkgPrice);
            if ($pkgPrice > 0 && $pkgPrice < 5000) $pkgPrice *= 1000;
            return ($pkgPrice > 0 ? $pkgPrice / 2 : 0) + ($extraFee / 2);
        }

        // Single Course
        $packagePrice = 0;
        if ($this->is_custom && isset($this->total_amount)) {
            $packagePrice = $this->total_amount;
        } elseif ($this->coursePackage) {
            $packagePrice = $this->coursePackage->price;
        }

        if (is_string($packagePrice)) {
            $packagePrice = (float)str_replace(',', '', $packagePrice);
        } else {
            $packagePrice = (float)$packagePrice;
        }

        // Retroactive fix for single package dot notation errors
        if ($packagePrice > 0 && $packagePrice < 5000) {
            $packagePrice *= 1000;
        }

        return $packagePrice + $extraFee;
    }

    public static function closePastCourses()
    {
        $today = now()->toDateString();
        $activeCourses = self::where('status', 'active')->get();
        $count = 0;
        
        foreach ($activeCourses as $course) {
            $lastLecture = $course->lectures()->orderBy('date', 'desc')->first();
            if ($lastLecture) {
                if ($lastLecture->date < $today) {
                    $course->status = 'finished';
                    $course->finished_at = $lastLecture->date . ' 23:59:59';
                    $course->save();
                    $count++;
                }
            } else {
                if ($course->start_date && $course->start_date->toDateString() < now()->subDays(60)->toDateString()) {
                    $course->status = 'finished';
                    $course->finished_at = $course->start_date->copy()->addDays(30)->toDateString() . ' 23:59:59';
                    $course->save();
                    $count++;
                }
            }
        }
        return $count;
    }
}
