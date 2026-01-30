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
        // For SQLite, we need to recreate the table with the new enum values
        // First, create a temporary table with the new structure
        DB::statement("
            CREATE TABLE lectures_new (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,

                course_id BIGINT UNSIGNED NULL,
                lecture_number INTEGER NULL,
                date DATE NULL,
                attendance TEXT ,

                activity   TEXT ,

                homework   TEXT ,

                payment_status TEXT ,

                is_makeup INTEGER DEFAULT 0,
                notes TEXT NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        ");

        // Copy data from old table to new table
        DB::statement("
            INSERT INTO lectures_new (id, course_id, lecture_number, date, attendance, activity, homework, payment_status, is_makeup, notes, created_at, updated_at)
            SELECT id, course_id, lecture_number, date, attendance, activity, homework, payment_status, is_makeup, notes, created_at, updated_at FROM lectures
        ");

        // Drop old table
        DB::statement("DROP TABLE lectures");

        // Rename new table to original name
        DB::statement("ALTER TABLE lectures_new RENAME TO lectures");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to original enum without postponed_by_student
        DB::statement("
            CREATE TABLE lectures_old (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

                course_id BIGINT UNSIGNED NULL,
                lecture_number INTEGER NULL,
                date DATE NULL,
                attendance TEXT,
                activity TEXT,
                homework TEXT,
                payment_status TEXT,
                is_makeup INTEGER DEFAULT 0,
                notes TEXT NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        ");

        DB::statement("
            INSERT INTO lectures_old (id, course_id, lecture_number, date, attendance, activity, homework, payment_status, is_makeup, notes, created_at, updated_at)
            SELECT id, course_id, lecture_number, date, 
                CASE WHEN attendance = 'postponed_by_student' THEN 'excused' ELSE attendance END,
                activity, homework, payment_status, is_makeup, notes, created_at, updated_at FROM lectures
        ");

        DB::statement("DROP TABLE lectures");
        DB::statement("ALTER TABLE lectures_old RENAME TO lectures");
    }
};
