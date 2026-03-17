<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Use GeneralObserver for all important models to centralize logging
        \App\Models\Course::observe(\App\Observers\GeneralObserver::class);
        \App\Models\Payment::observe(\App\Observers\GeneralObserver::class);
        \App\Models\Lecture::observe(\App\Observers\GeneralObserver::class);
        \App\Models\Student::observe(\App\Observers\GeneralObserver::class);
        \App\Models\Trainer::observe(\App\Observers\GeneralObserver::class);
        \App\Models\TrainerUnavailability::observe(\App\Observers\GeneralObserver::class);
        \App\Models\TrainerPayroll::observe(\App\Observers\GeneralObserver::class);
        \App\Models\User::observe(\App\Observers\GeneralObserver::class);
        \App\Models\CoursePackage::observe(\App\Observers\GeneralObserver::class);
    }
}
