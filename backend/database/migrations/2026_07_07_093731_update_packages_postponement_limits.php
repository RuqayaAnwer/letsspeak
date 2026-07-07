<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Balance package (باقة التوازن / 24 محاضرة) -> Trainee: 2, Trainer: 2
        DB::table('course_packages')
            ->where('name', 'like', '%توازن%')
            ->orWhere('name', 'like', '%التوازن%')
            ->orWhere('name', 'like', '%24 محاضرة%')
            ->update([
                'trainee_max_postponements' => 2,
                'trainer_max_postponements' => 2,
            ]);

        // 2. My Mood package (باقة بمزاجي / 36 محاضرة) -> Trainee: 2, Trainer: 2
        DB::table('course_packages')
            ->where('name', 'like', '%مزاجي%')
            ->orWhere('name', 'like', '%36 محاضرة%')
            ->update([
                'trainee_max_postponements' => 2,
                'trainer_max_postponements' => 2,
            ]);

        // 3. Speed package (باقة السرعة / Speed Package) -> Trainee: 3, Trainer: 3
        DB::table('course_packages')
            ->where('name', 'like', '%سرعة%')
            ->orWhere('name', 'like', '%السرعة%')
            ->orWhere('name', 'like', '%Speed%')
            ->update([
                'trainee_max_postponements' => 3,
                'trainer_max_postponements' => 3,
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to 3 postponements for all as standard fallback
        DB::table('course_packages')
            ->update([
                'trainee_max_postponements' => 3,
                'trainer_max_postponements' => 3,
            ]);
    }
};
