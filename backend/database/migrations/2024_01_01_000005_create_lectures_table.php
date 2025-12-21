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
        Schema::create('lectures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->onDelete('cascade');
            $table->unsignedInteger('lecture_number');
            $table->date('date');
            $table->enum('attendance', ['pending', 'present', 'partially', 'absent', 'excused', 'postponed_by_trainer'])->default('pending');
            $table->enum('activity', ['engaged', 'normal', 'not_engaged'])->nullable();
            $table->enum('homework', ['yes', 'partial', 'no'])->nullable();
            $table->enum('payment_status', ['unpaid', 'paid', 'partial'])->default('unpaid');
            $table->boolean('is_makeup')->default(false);  // makeup lecture for postponement
            $table->unsignedInteger('makeup_for')->nullable();  // original lecture_number if makeup
            $table->text('notes')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('course_id', 'idx_lectures_course');
            $table->index('date', 'idx_lectures_date');
            $table->index('attendance', 'idx_lectures_attendance');
            $table->unique(['course_id', 'lecture_number'], 'uk_course_lecture');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lectures');
    }
};
