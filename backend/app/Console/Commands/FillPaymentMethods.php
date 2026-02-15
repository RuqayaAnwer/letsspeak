<?php

namespace App\Console\Commands;

use App\Models\Payment;
use Illuminate\Console\Command;

class FillPaymentMethods extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'payments:fill-methods';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fill payment_method for existing payments from their courses';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('بدء تحديث طرق الدفع للمدفوعات الموجودة...');
        
        // Get all payments without payment_method
        $payments = Payment::whereNull('payment_method')
            ->orWhere('payment_method', '')
            ->with('course')
            ->get();
        
        $this->info("وُجد {$payments->count()} دفعة بدون طريقة دفع");
        
        $updated = 0;
        $skipped = 0;
        
        foreach ($payments as $payment) {
            if ($payment->course && $payment->course->payment_method) {
                $payment->payment_method = $payment->course->payment_method;
                $payment->save();
                $updated++;
                $this->line("✓ تم تحديث الدفعة #{$payment->id}");
            } else {
                $skipped++;
                $this->warn("⚠ تم تخطي الدفعة #{$payment->id} (الكورس بدون طريقة دفع)");
            }
        }
        
        $this->newLine();
        $this->info("═══════════════════════════════════");
        $this->info("✓ تم تحديث {$updated} دفعة بنجاح");
        if ($skipped > 0) {
            $this->warn("⚠ تم تخطي {$skipped} دفعة (الكورسات بدون طريقة دفع)");
        }
        $this->info("═══════════════════════════════════");
        
        return Command::SUCCESS;
    }
}
