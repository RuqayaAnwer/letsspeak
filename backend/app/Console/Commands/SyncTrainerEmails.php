<?php

namespace App\Console\Commands;

use App\Models\Trainer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class SyncTrainerEmails extends Command
{
    protected $signature = 'trainers:sync-emails
                            {--fix-password : تعيين كلمة مرور 123456 للمدربين الذين لا يوجد لهم كلمة مرور صحيحة}';

    protected $description = 'مزامنة إيميل trainers مع جدول users لضمان عمل تسجيل الدخول';

    public function handle()
    {
        $trainers = Trainer::with('user')->get();
        $synced   = 0;
        $skipped  = 0;
        $noUser   = 0;

        foreach ($trainers as $trainer) {
            if (!$trainer->user) {
                $noUser++;
                $this->warn("المدرب [{$trainer->name}] (id: {$trainer->id}) لا يملك user مرتبط.");
                continue;
            }

            $trainerEmail = $trainer->email ?: $trainer->username;

            if (!$trainerEmail) {
                $skipped++;
                continue;
            }

            $changed = false;

            // مزامنة الإيميل من trainers → users إذا كانا مختلفين
            if ($trainer->user->email !== $trainerEmail) {
                $this->line("مزامنة: [{$trainer->name}] users.email: {$trainer->user->email} → {$trainerEmail}");
                $trainer->user->email = $trainerEmail;
                $changed = true;
            }

            // تعيين كلمة مرور افتراضية (اختياري عند تمرير --fix-password)
            if ($this->option('fix-password')) {
                $trainer->user->password = Hash::make('123456');
                $changed = true;
            }

            if ($changed) {
                $trainer->user->save();

                // مزامنة عكسية: trainers.email و trainers.username
                $trainer->email    = $trainerEmail;
                $trainer->username = $trainerEmail;
                $trainer->save();

                $synced++;
            } else {
                $skipped++;
            }
        }

        $this->info("✓ تمت المزامنة لـ {$synced} مدرب.");
        $this->info("- بدون تغيير: {$skipped}");
        if ($noUser > 0) {
            $this->warn("- بدون user مرتبط: {$noUser} (يحتاجون إعادة إضافة)");
        }

        return 0;
    }
}
