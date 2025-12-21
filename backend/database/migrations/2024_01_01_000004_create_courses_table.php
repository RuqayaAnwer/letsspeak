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
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trainer_id')->constrained()->onDelete('cascade');
            $table->foreignId('course_type_id')->nullable()->constrained()->onDelete('set null');
            $table->string('title', 255)->nullable();
            $table->unsignedInteger('lectures_count');
            $table->date('start_date');
            $table->time('lecture_time');
            $table->json('lecture_days');  // e.g., ["Sunday","Tuesday","Thursday"]
            $table->enum('status', ['active', 'paused', 'finished', 'paid', 'cancelled'])->default('active');
            $table->string('payment_method', 100)->nullable();
            $table->string('subscription_source', 100)->nullable();
            $table->boolean('renewed_with_trainer')->default(false);
            $table->string('amount_updates', 255)->nullable();  // discount notes
            $table->decimal('total_amount', 12, 2)->nullable();
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('trainer_id', 'idx_courses_trainer');
            $table->index('status', 'idx_courses_status');
            $table->index('start_date', 'idx_courses_start_date');
            $table->index('renewed_with_trainer', 'idx_courses_renewed');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};
