<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration enhances the lectures table to support proper postponement logic.
     * Note: SQLite requires table recreation for adding columns with constraints.
     */
    public function up(): void
    {
        $columns = Schema::getColumnListing('lectures');
        
        // Add time column for the lecture time (if not exists)
        if (!in_array('time', $columns)) {
            DB::statement("ALTER TABLE lectures ADD COLUMN time TEXT DEFAULT NULL");
        }
        
        // Copy lecture_time from courses to lectures where missing
        DB::statement("
            UPDATE lectures 
            SET time = (SELECT lecture_time FROM courses WHERE courses.id = lectures.course_id)
            WHERE time IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // SQLite doesn't support DROP COLUMN easily
    }
};
