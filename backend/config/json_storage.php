<?php
/**
 * JSON Storage Configuration
 * 
 * This config controls whether the system uses dummy data or live data.
 * Set 'use_dummy_data' to false when ready to use real data from Google Sheets.
 */

return [
    /*
    |--------------------------------------------------------------------------
    | Use Dummy Data
    |--------------------------------------------------------------------------
    |
    | When true, the system reads from storage/json_data/dummy/
    | When false, the system reads from storage/json_data/live/
    |
    | Set to false when you want to use real data synchronized from Google Sheets.
    |
    */
    'use_dummy_data' => env('JSON_USE_DUMMY_DATA', true),

    /*
    |--------------------------------------------------------------------------
    | Course Types and Lecture Counts
    |--------------------------------------------------------------------------
    |
    | Mapping of course types to their lecture counts.
    | These values come from Google Sheets course_type field.
    |
    */
    'course_types' => [
        'بمزاجي' => 8,      // "بمزاجي" → 8 lectures
        'التوازن' => 12,    // "التوازن" → 12 lectures  
        'السرعة' => 20,     // "السرعة" → 20 lectures
    ],

    /*
    |--------------------------------------------------------------------------
    | Financial Settings
    |--------------------------------------------------------------------------
    |
    | Configurable rates for trainer payments and bonuses.
    |
    */
    'finance' => [
        'lecture_rate' => 4000,           // IQD per completed lecture
        'renewal_bonus' => 5000,          // IQD per renewal
        'volume_bonus_60' => 30000,       // IQD bonus at 60 lectures
        'volume_bonus_80' => 80000,       // IQD bonus at 80 lectures (replaces 30k)
        'top_trainer_bonus' => 20000,     // IQD for top 3 trainers in renewals
    ],

    /*
    |--------------------------------------------------------------------------
    | Course Rules
    |--------------------------------------------------------------------------
    |
    | Rules for course management.
    |
    */
    'rules' => [
        'max_postponements' => 3,         // Maximum allowed postponements per course
        'completion_alert_percent' => 75, // Show alert at this completion percentage
    ],
];























