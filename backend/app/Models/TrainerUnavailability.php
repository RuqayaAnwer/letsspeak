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
    ];

    protected $casts = [
        'unavailable_days' => 'array',
        'unavailable_times' => 'array',
    ];

    public function trainer()
    {
        return $this->belongsTo(Trainer::class);
    }
}





