<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainerPayroll extends Model
{
    use HasFactory;

    protected $table = 'trainer_payroll';

    protected $fillable = [
        'trainer_id',
        'month',
        'year',
        'completed_lectures',
        'lecture_rate',
        'base_pay',
        'renewals_count',
        'renewal_bonus_rate',
        'renewal_total',
        'volume_bonus',
        'competition_bonus',
        'total_pay',
        'status',
        'paid_at',
        'notes',
    ];

    protected $casts = [
        'lecture_rate' => 'decimal:2',
        'base_pay' => 'decimal:2',
        'renewal_bonus_rate' => 'decimal:2',
        'renewal_total' => 'decimal:2',
        'volume_bonus' => 'decimal:2',
        'competition_bonus' => 'decimal:2',
        'total_pay' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    /**
     * Get the trainer.
     */
    public function trainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class);
    }

    /**
     * Calculate total pay.
     */
    public function calculateTotalPay(): float
    {
        return $this->base_pay + $this->renewal_total + $this->volume_bonus + $this->competition_bonus;
    }

    /**
     * Recalculate all values.
     */
    public function recalculate(): void
    {
        $this->base_pay = $this->completed_lectures * $this->lecture_rate;
        $this->renewal_total = $this->renewals_count * $this->renewal_bonus_rate;
        $this->total_pay = $this->calculateTotalPay();
    }

    /**
     * Scope: For period.
     */
    public function scopeForPeriod($query, int $month, int $year)
    {
        return $query->where('month', $month)->where('year', $year);
    }

    /**
     * Scope: Paid.
     */
    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    /**
     * Scope: Pending (draft or approved).
     */
    public function scopePending($query)
    {
        return $query->whereIn('status', ['draft', 'approved']);
    }
}


















