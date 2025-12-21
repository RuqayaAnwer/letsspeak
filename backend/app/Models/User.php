<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Get the trainer profile associated with the user.
     */
    public function trainer(): HasOne
    {
        return $this->hasOne(Trainer::class);
    }

    /**
     * Get payments recorded by this user.
     */
    public function recordedPayments(): HasMany
    {
        return $this->hasMany(Payment::class, 'recorded_by');
    }

    /**
     * Get status changes made by this user.
     */
    public function statusChanges(): HasMany
    {
        return $this->hasMany(CourseStatusHistory::class, 'changed_by');
    }

    /**
     * Scope: Active users only.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Check if user is admin.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Check if user is customer service.
     */
    public function isCustomerService(): bool
    {
        return $this->role === 'customer_service';
    }

    /**
     * Check if user is finance.
     */
    public function isFinance(): bool
    {
        return $this->role === 'finance';
    }
}
