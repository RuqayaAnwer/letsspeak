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
        'include_renewal_bonus',
        'volume_bonus',
        'include_volume_bonus',
        'selected_volume_bonus',
        'competition_bonus',
        'include_competition_bonus',
        'selected_bonus_type',
        'bonus_deduction',
        'bonus_deduction_notes',
        'payment_method',
        'payment_account_number',
        'payment_pin',
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
        'include_renewal_bonus' => 'boolean',
        'volume_bonus' => 'decimal:2',
        'include_volume_bonus' => 'boolean',
        'selected_volume_bonus' => 'decimal:2',
        'competition_bonus' => 'decimal:2',
        'include_competition_bonus' => 'boolean',
        'selected_bonus_type' => 'string',
        'bonus_deduction' => 'decimal:2',
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
        $total = $this->base_pay;
        
        // Check if using old system (selected_bonus_type exists)
        if ($this->selected_bonus_type) {
            // Old system: single selection
            switch ($this->selected_bonus_type) {
                case 'renewal':
                    $total += $this->renewal_total ?? 0;
                    break;
                case 'competition':
                    $total += $this->competition_bonus ?? 0;
                    break;
                case 'volume_60':
                    $total += 30000;
                    break;
                case 'volume_80':
                    $total += 80000;
                    break;
            }
        } else {
            // New system: multiple selections using flags
            // مكافأة التجديد: مربوطة بعدد التجديدات (كل تجديد = renewal_bonus_rate)
            if ($this->include_renewal_bonus === true) {
                $total += (float) ($this->renewal_total ?? 0);
            }
            
            // مكافأة المنافسة: لأكثر 3 مدربين لديهم تجديدات
            if ($this->include_competition_bonus === true) {
                $total += (float) ($this->competition_bonus ?? 0);
            }
            
            // مكافأة الكمية: مربوطة بعدد المحاضرات (60+ = 30,000، 80+ = 80,000)
            if ($this->selected_volume_bonus !== null && $this->selected_volume_bonus > 0) {
                $total += (float) $this->selected_volume_bonus;
            }
        }
        
        // Add bonus/deduction
        $total += ($this->bonus_deduction ?? 0);
        
        return $total;
    }

    /**
     * Recalculate all values.
     */
    public function recalculate(): void
    {
        $this->base_pay = $this->completed_lectures * $this->lecture_rate;
        
        // Calculate renewal bonus using tiered system
        // 5 renewals = 50,000 د.ع, 7 renewals = 100,000 د.ع
        $this->renewal_total = 0;
        if ($this->renewals_count >= 7) {
            $this->renewal_total = 100000;
        } elseif ($this->renewals_count >= 5) {
            $this->renewal_total = 50000;
        }
        
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



















