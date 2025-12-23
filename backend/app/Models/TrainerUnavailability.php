<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TrainerUnavailability extends Model
{
    use HasFactory;

    protected $table = 'trainer_unavailability';

    protected $fillable = [
        'trainer_id',
        'unavailable_days',
        'unavailable_times',
        'notes',
        'last_day_off_update',
        'day_off_updates_count',
        'day_off_updates_hour',
    ];

    protected $casts = [
        'unavailable_days' => 'array',
        'unavailable_times' => 'array',
        'last_day_off_update' => 'datetime',
        'day_off_updates_hour' => 'datetime',
    ];

    public function trainer()
    {
        return $this->belongsTo(Trainer::class);
    }
}





