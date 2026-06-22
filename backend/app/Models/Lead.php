<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'phone_whatsapp',
        'telegram_id',
        'governorate',
        'age',
        'gender',
        'package_selected',
        'preferred_time',
        'current_level',
        'source',
        'intro_date',
        'trainer_name',
        'intro_time',
        'attendance_status',
        'intro_evaluation',
        'assigned_level',
        'status',
        'notes',
    ];

    protected $casts = [
        'intro_date' => 'datetime',
        'age' => 'integer',
    ];

    /**
     * Mutator to ensure empty age string is stored as null.
     */
    public function setAgeAttribute($value)
    {
        $this->attributes['age'] = ($value === '' || $value === null) ? null : (int)$value;
    }
}
