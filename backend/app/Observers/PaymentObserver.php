<?php

namespace App\Observers;

use App\Models\Payment;

class PaymentObserver
{
    /**
     * Handle the Payment "created" event.
     */
    public function created(Payment $payment): void
    {
        $this->updateCourseAmountPaid($payment);
    }

    /**
     * Handle the Payment "updated" event.
     */
    public function updated(Payment $payment): void
    {
        if ($payment->isDirty('amount') || $payment->isDirty('status')) {
            $this->updateCourseAmountPaid($payment);
        }
    }

    /**
     * Handle the Payment "deleted" event.
     */
    public function deleted(Payment $payment): void
    {
        $this->updateCourseAmountPaid($payment);
    }

    /**
     * Handle the Payment "restored" event.
     */
    public function restored(Payment $payment): void
    {
        $this->updateCourseAmountPaid($payment);
    }

    protected function updateCourseAmountPaid(Payment $payment): void
    {
        if ($payment->course_id) {
            $course = \App\Models\Course::find($payment->course_id);
            if ($course) {
                // In Course model, recalculateAmountPaid sums 'amount'. If we want ONLY paid amounts:
                $totalPaid = $course->payments()
                    ->whereIn('status', ['paid', 'completed', 'partial'])
                    ->sum('amount');
                
                // Using saveQuietly avoids infinite loops if CourseObserver triggers Payment changes
                $course->amount_paid = $totalPaid;
                $course->saveQuietly();
            }
        }
    }
}
