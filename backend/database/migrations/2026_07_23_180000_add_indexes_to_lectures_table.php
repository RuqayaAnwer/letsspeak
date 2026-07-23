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
        Schema::table('lectures', function (Blueprint $table) {
            // Add indexes for performance optimization
            $table->index('course_id', 'idx_lectures_course_id');
            $table->index('trainer_id', 'idx_lectures_trainer_id');
            $table->index('date', 'idx_lectures_date');
            $table->index('attendance', 'idx_lectures_attendance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lectures', function (Blueprint $table) {
            // Drop indexes if rolled back
            $table->dropIndex('idx_lectures_course_id');
            $table->dropIndex('idx_lectures_trainer_id');
            $table->dropIndex('idx_lectures_date');
            $table->dropIndex('idx_lectures_attendance');
        });
    }
};
