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
        // For SQLite, we need to recreate the table without payment_status
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('lectures', function (Blueprint $table) {
                // SQLite doesn't support dropping columns directly
                // We'll use a workaround by recreating the table
            });
            
            // Recreate table without payment_status
            DB::statement('
                CREATE TABLE lectures_new (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    course_id INTEGER NOT NULL,
                    lecture_number INTEGER NOT NULL,
                    date DATE NOT NULL,
                    time VARCHAR(10),
                    attendance TEXT DEFAULT "pending",
                    activity TEXT,
                    homework TEXT,
                    is_makeup BOOLEAN DEFAULT 0,
                    makeup_for INTEGER,
                    notes TEXT,
                    postpone_reason TEXT,
                    is_completed BOOLEAN DEFAULT 0,
                    student_attendance TEXT,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                    UNIQUE(course_id, lecture_number)
                )
            ');
            
            DB::statement('
                INSERT INTO lectures_new 
                (id, course_id, lecture_number, date, time, attendance, activity, homework, is_makeup, makeup_for, notes, postpone_reason, is_completed, student_attendance, created_at, updated_at)
                SELECT 
                id, course_id, lecture_number, date, time, attendance, activity, homework, is_makeup, makeup_for, notes, postpone_reason, is_completed, student_attendance, created_at, updated_at
                FROM lectures
            ');
            
            DB::statement('DROP TABLE lectures');
            DB::statement('ALTER TABLE lectures_new RENAME TO lectures');
        } else {
            // For other databases (MySQL, PostgreSQL)
            Schema::table('lectures', function (Blueprint $table) {
                $table->dropColumn('payment_status');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // For SQLite, we would need to recreate the table with payment_status
            // This is complex, so we'll just add it back if needed
            DB::statement('ALTER TABLE lectures ADD COLUMN payment_status TEXT DEFAULT "unpaid"');
        } else {
            Schema::table('lectures', function (Blueprint $table) {
                $table->enum('payment_status', ['unpaid', 'paid', 'partial'])->default('unpaid')->after('homework');
            });
        }
    }
};
