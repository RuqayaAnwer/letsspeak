<?php

namespace App\Observers;

use App\Models\TrainerPayroll;

class TrainerPayrollObserver
{
    /**
     * Handle the TrainerPayroll "created" event.
     */
    public function created(TrainerPayroll $trainerPayroll): void
    {
        //
    }

    /**
     * Handle the TrainerPayroll "updated" event.
     */
    public function updated(TrainerPayroll $trainerPayroll): void
    {
        //
    }

    /**
     * Handle the TrainerPayroll "deleted" event.
     */
    public function deleted(TrainerPayroll $trainerPayroll): void
    {
        //
    }

    /**
     * Handle the TrainerPayroll "restored" event.
     */
    public function restored(TrainerPayroll $trainerPayroll): void
    {
        //
    }

    /**
     * Handle the TrainerPayroll "force deleted" event.
     */
    public function forceDeleted(TrainerPayroll $trainerPayroll): void
    {
        //
    }
}
