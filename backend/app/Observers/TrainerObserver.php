<?php

namespace App\Observers;

use App\Models\Trainer;

class TrainerObserver
{
    /**
     * Handle the Trainer "created" event.
     */
    public function created(Trainer $trainer): void
    {
        //
    }

    /**
     * Handle the Trainer "updated" event.
     */
    public function updated(Trainer $trainer): void
    {
        //
    }

    /**
     * Handle the Trainer "deleted" event.
     */
    public function deleted(Trainer $trainer): void
    {
        //
    }

    /**
     * Handle the Trainer "restored" event.
     */
    public function restored(Trainer $trainer): void
    {
        //
    }

    /**
     * Handle the Trainer "force deleted" event.
     */
    public function forceDeleted(Trainer $trainer): void
    {
        //
    }
}
