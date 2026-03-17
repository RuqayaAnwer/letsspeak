<?php

namespace App\Observers;

use App\Models\TrainerUnavailability;

class TrainerUnavailabilityObserver
{
    /**
     * Handle the TrainerUnavailability "created" event.
     */
    public function created(TrainerUnavailability $trainerUnavailability): void
    {
        //
    }

    /**
     * Handle the TrainerUnavailability "updated" event.
     */
    public function updated(TrainerUnavailability $trainerUnavailability): void
    {
        //
    }

    /**
     * Handle the TrainerUnavailability "deleted" event.
     */
    public function deleted(TrainerUnavailability $trainerUnavailability): void
    {
        //
    }

    /**
     * Handle the TrainerUnavailability "restored" event.
     */
    public function restored(TrainerUnavailability $trainerUnavailability): void
    {
        //
    }

    /**
     * Handle the TrainerUnavailability "force deleted" event.
     */
    public function forceDeleted(TrainerUnavailability $trainerUnavailability): void
    {
        //
    }
}
