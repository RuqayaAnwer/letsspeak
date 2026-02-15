<?php

namespace App\Console\Commands;

use App\Models\Course;
use Illuminate\Console\Command;

class SetDefaultPaymentMethod extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'courses:set-default-payment-method {method=zain_cash}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Set default payment method for courses that don\'t have one';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $method = $this->argument('method');
        
        $this->info("بدء تعيين طريقة الدفع الافتراضية: {$method}");
        
        // Get all courses without payment_method
        $courses = Course::whereNull('payment_method')
            ->orWhere('payment_method', '')
            ->get();
        
        $this->info("وُجد {$courses->count()} كورس بدون طريقة دفع");
        
        if ($courses->isEmpty()) {
            $this->info('لا توجد كورسات تحتاج تحديث');
            return Command::SUCCESS;
        }
        
        $updated = 0;
        
        foreach ($courses as $course) {
            $course->payment_method = $method;
            $course->save();
            $updated++;
            $this->line("✓ تم تحديث الكورس #{$course->id} - {$course->title}");
        }
        
        $this->newLine();
        $this->info("═══════════════════════════════════");
        $this->info("✓ تم تحديث {$updated} كورس بنجاح");
        $this->info("═══════════════════════════════════");
        
        return Command::SUCCESS;
    }
}
