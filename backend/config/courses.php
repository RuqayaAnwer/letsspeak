<?php

/**
 * Course Configuration
 * 
 * Contains configurable values for course-related features.
 */

return [
    /*
    |--------------------------------------------------------------------------
    | Maximum Postponements Per Course (fallback)
    |--------------------------------------------------------------------------
    |
    | Used only when course has no package (custom course). Package limits override:
    | بمزاجي/التوازن = 1, السرعة = 3, كورس مخصص = 3 (this default).
    |
    */
    'max_postponements' => env('COURSE_MAX_POSTPONEMENTS', 3),

    /*
    |--------------------------------------------------------------------------
    | Postponement Window (Days)
    |--------------------------------------------------------------------------
    |
    | How many days in advance a lecture must be postponed.
    | Set to 0 to allow same-day postponements.
    |
    */
    'postponement_advance_days' => env('COURSE_POSTPONEMENT_ADVANCE_DAYS', 0),

    /*
    |--------------------------------------------------------------------------
    | Allow Conflict Override
    |--------------------------------------------------------------------------
    |
    | Whether privileged users (customer_service, admin) can override
    | time conflicts when postponing lectures.
    |
    */
    'allow_conflict_override' => env('COURSE_ALLOW_CONFLICT_OVERRIDE', true),
];























