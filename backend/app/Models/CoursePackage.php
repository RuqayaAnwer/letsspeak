<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CoursePackage extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'lectures_count',
        'description',
        'price',
    ];

    protected $casts = [
        'lectures_count' => 'integer',
        'price' => 'decimal:2',
    ];

    /**
     * Get all courses using this package.
     */
    public function courses(): HasMany
    {
        return $this->hasMany(Course::class);
    }
}






