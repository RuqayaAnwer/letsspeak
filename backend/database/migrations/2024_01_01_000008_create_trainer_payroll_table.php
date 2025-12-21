<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trainer_payroll', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trainer_id')->constrained()->onDelete('cascade');
            $table->unsignedTinyInteger('month');  // 1-12
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('completed_lectures')->default(0);
            $table->decimal('lecture_rate', 10, 2);  // 4000 IQD
            $table->decimal('base_pay', 12, 2)->default(0);  // lectures * rate
            $table->unsignedInteger('renewals_count')->default(0);
            $table->decimal('renewal_bonus_rate', 10, 2);  // 5000 IQD
            $table->decimal('renewal_total', 12, 2)->default(0);
            $table->decimal('volume_bonus', 12, 2)->default(0);  // 30000 or 80000
            $table->decimal('competition_bonus', 12, 2)->default(0);  // 20000 if top 3
            $table->decimal('total_pay', 12, 2)->default(0);
            $table->enum('status', ['draft', 'approved', 'paid'])->default('draft');
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            
            // Unique constraint: one payroll record per trainer per month
            $table->unique(['trainer_id', 'month', 'year'], 'uk_trainer_month');
            $table->index(['year', 'month'], 'idx_payroll_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trainer_payroll');
    }
};


















