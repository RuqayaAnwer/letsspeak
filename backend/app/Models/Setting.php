<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'value',
        'description',
    ];

    public $timestamps = false;

    /**
     * Get a setting value by key.
     */
    public static function getValue(string $key, $default = null)
    {
        $setting = Cache::remember("setting.{$key}", 3600, function () use ($key) {
            return static::where('key', $key)->first();
        });

        return $setting ? $setting->value : $default;
    }

    /**
     * Set a setting value.
     */
    public static function setValue(string $key, $value, ?string $description = null): void
    {
        static::updateOrCreate(
            ['key' => $key],
            [
                'value' => $value,
                'description' => $description,
                'updated_at' => now(),
            ]
        );

        Cache::forget("setting.{$key}");
    }

    /**
     * Get all settings as key-value array.
     */
    public static function getAllSettings(): array
    {
        return static::pluck('value', 'key')->toArray();
    }

    /**
     * Get lecture rate.
     */
    public static function getLectureRate(): float
    {
        return (float) static::getValue('lecture_rate', 4000);
    }

    /**
     * Get renewal bonus.
     */
    public static function getRenewalBonus(): float
    {
        return (float) static::getValue('renewal_bonus', 5000);
    }

    /**
     * Get volume bonus for 60 lectures.
     */
    public static function getVolumeBonus60(): float
    {
        return (float) static::getValue('volume_bonus_60', 30000);
    }

    /**
     * Get volume bonus for 80 lectures.
     */
    public static function getVolumeBonus80(): float
    {
        return (float) static::getValue('volume_bonus_80', 80000);
    }

    /**
     * Get competition bonus.
     */
    public static function getCompetitionBonus(): float
    {
        return (float) static::getValue('competition_bonus', 20000);
    }

    /**
     * Get max postponements.
     */
    public static function getMaxPostponements(): int
    {
        return (int) static::getValue('max_postponements', 3);
    }

    /**
     * Get completion alert percentage.
     */
    public static function getCompletionAlertPercent(): int
    {
        return (int) static::getValue('completion_alert_percent', 75);
    }
}
























