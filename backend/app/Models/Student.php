<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Student extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'level',
        'status',
        'notes',
        'lead_id',
        'is_child',
        'age',
    ];

    protected $casts = [
        'is_child' => 'boolean',
        'age' => 'integer',
    ];

    /**
     * Get the lead that this student was converted from.
     */
    public function lead()
    {
        return $this->belongsTo(Lead::class);
    }

    /**
     * Get all courses the student is enrolled in.
     */
    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_students')
            ->withPivot('is_primary', 'created_at');
    }

    /**
     * Get all payments made by the student.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Get the student's administrative notes.
     * Renamed to studentNotes to avoid conflict with the existing `notes` column on the students table.
     */
    public function studentNotes(): HasMany
    {
        return $this->hasMany(StudentNote::class);
    }

    /**
     * Scope: Active students only.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Get courses count.
     */
    public function getCoursesCountAttribute(): int
    {
        return $this->courses()->count();
    }

    /**
     * Get active courses count.
     */
    public function getActiveCoursesCountAttribute(): int
    {
        return $this->courses()->where('courses.status', 'active')->count();
    }
}
