<?php

namespace App\Observers;

use App\Models\CoursePackage;

class CoursePackageObserver
{
    /**
     * Handle the CoursePackage "created" event.
     */
    public function created(CoursePackage $coursePackage): void
    {
        //
    }

    /**
     * Handle the CoursePackage "updated" event.
     */
    public function updated(CoursePackage $coursePackage): void
    {
        //
    }

    /**
     * Handle the CoursePackage "deleted" event.
     */
    public function deleted(CoursePackage $coursePackage): void
    {
        //
    }

    /**
     * Handle the CoursePackage "restored" event.
     */
    public function restored(CoursePackage $coursePackage): void
    {
        //
    }

    /**
     * Handle the CoursePackage "force deleted" event.
     */
    public function forceDeleted(CoursePackage $coursePackage): void
    {
        //
    }
}
