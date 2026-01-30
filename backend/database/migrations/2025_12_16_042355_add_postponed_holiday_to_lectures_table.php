<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add postponed_holiday attendance value.
     */
    public function up(): void
    {
        // MySQL: Modify ENUM column to add new value
        DB::statement("
            ALTER TABLE lectures 
            MODIFY COLUMN attendance ENUM(
                'pending', 
                'present', 
                'partially', 
                'absent', 
                'excused', 
                'postponed_by_trainer', 
                'postponed_by_student', 
                'postponed_holiday'
            ) DEFAULT 'pending'
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Convert any postponed_holiday values to excused before removing from enum
        DB::statement("
            UPDATE lectures 
            SET attendance = 'excused' 
            WHERE attendance = 'postponed_holiday'
        ");

        // Remove postponed_holiday from enum
        DB::statement("
            ALTER TABLE lectures 
            MODIFY COLUMN attendance ENUM(
                'pending', 
                'present', 
                'partially', 
                'absent', 
                'excused', 
                'postponed_by_trainer', 
                'postponed_by_student'
            ) DEFAULT 'pending'
        ");
    }
};
