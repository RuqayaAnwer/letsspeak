<?php

namespace App\Observers;

use App\Models\TrainerPayment;

class TrainerPaymentObserver
{
    /**
     * Handle the TrainerPayment "created" event.
     */
    public function created(TrainerPayment $trainerPayment): void
    {
        //
    }

    /**
     * Handle the TrainerPayment "updated" event.
     */
    public function updated(TrainerPayment $trainerPayment): void
    {
        //
    }

    /**
     * Handle the TrainerPayment "deleted" event.
     */
    public function deleted(TrainerPayment $trainerPayment): void
    {
        //
    }

    /**
     * Handle the TrainerPayment "restored" event.
     */
    public function restored(TrainerPayment $trainerPayment): void
    {
        //
    }

    /**
     * Handle the TrainerPayment "force deleted" event.
     */
    public function forceDeleted(TrainerPayment $trainerPayment): void
    {
        //
    }
}
