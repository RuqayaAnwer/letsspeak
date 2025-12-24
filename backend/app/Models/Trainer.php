<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trainer extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'username',
        'password',
        'email',
        'phone',
        'min_level',
        'max_level',
        'status',
        'notes',
        'payment_method',
        'payment_account_number',
    ];

    protected $hidden = [
        'password',
    ];

    /**
     * Get the user that owns the trainer profile.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all courses for the trainer.
     */
    public function courses(): HasMany
    {
        return $this->hasMany(Course::class);
    }

    /**
     * Get all payroll records for the trainer.
     */
    public function payrolls(): HasMany
    {
        return $this->hasMany(TrainerPayroll::class);
    }

    /**
     * Scope: Active trainers only.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Get active courses count.
     */
    public function getActiveCoursesCountAttribute(): int
    {
        return $this->courses()->where('status', 'active')->count();
    }

    /**
     * Get completed lectures count for a specific month.
     */
    public function getCompletedLecturesForMonth(int $month, int $year): int
    {
        return Lecture::whereHas('course', function ($query) {
            $query->where('trainer_id', $this->id);
        })
        ->whereMonth('date', $month)
        ->whereYear('date', $year)
        ->whereIn('attendance', ['present', 'partially'])
        ->count();
    }

    /**
     * Get renewals count for a specific month.
     */
    public function getRenewalsForMonth(int $month, int $year): int
    {
        return $this->courses()
            ->where('renewed_with_trainer', true)
            ->whereMonth('start_date', $month)
            ->whereYear('start_date', $year)
            ->count();
    }
}
