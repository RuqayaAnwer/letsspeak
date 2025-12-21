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
     * For SQLite, we need to recreate the table since it doesn't support modifying constraints.
     */
    public function up(): void
    {
        // Get current column list
        $columns = Schema::getColumnListing('lectures');
        
        // Build the column list dynamically based on what exists
        $columnList = implode(', ', $columns);
        
        // Create new table with updated attendance constraint
        DB::statement("
            CREATE TABLE lectures_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                lecture_number INTEGER NOT NULL,
                date DATE NOT NULL,
                time TEXT DEFAULT NULL,
                attendance TEXT CHECK(attendance IN ('pending', 'present', 'partially', 'absent', 'excused', 'postponed_by_trainer', 'postponed_by_student', 'postponed_holiday')) DEFAULT 'pending',
                activity TEXT CHECK(activity IN ('engaged', 'normal', 'not_engaged')) DEFAULT NULL,
                homework TEXT CHECK(homework IN ('yes', 'partial', 'no')) DEFAULT NULL,
                payment_status TEXT CHECK(payment_status IN ('unpaid', 'paid', 'partial')) DEFAULT 'unpaid',
                is_makeup INTEGER DEFAULT 0,
                makeup_for INTEGER DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                postpone_reason TEXT DEFAULT NULL,
                is_completed INTEGER DEFAULT 0,
                student_attendance TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT NULL,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        ");

        // Copy existing data - only copy columns that exist
        $existingColumns = ['id', 'course_id', 'lecture_number', 'date'];
        $optionalColumns = ['time', 'attendance', 'activity', 'homework', 'payment_status', 'is_makeup', 'makeup_for', 'notes', 'postpone_reason', 'is_completed', 'student_attendance', 'created_at', 'updated_at'];
        
        foreach ($optionalColumns as $col) {
            if (in_array($col, $columns)) {
                $existingColumns[] = $col;
            }
        }
        
        $columnListSafe = implode(', ', $existingColumns);
        
        DB::statement("
            INSERT INTO lectures_new ({$columnListSafe})
            SELECT {$columnListSafe} FROM lectures
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
        // Get current column list
        $columns = Schema::getColumnListing('lectures');
        
        // Revert to original enum without postponed_holiday
        DB::statement("
            CREATE TABLE lectures_old (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                lecture_number INTEGER NOT NULL,
                date DATE NOT NULL,
                time TEXT DEFAULT NULL,
                attendance TEXT CHECK(attendance IN ('pending', 'present', 'partially', 'absent', 'excused', 'postponed_by_trainer', 'postponed_by_student')) DEFAULT 'pending',
                activity TEXT CHECK(activity IN ('engaged', 'normal', 'not_engaged')) DEFAULT NULL,
                homework TEXT CHECK(homework IN ('yes', 'partial', 'no')) DEFAULT NULL,
                payment_status TEXT CHECK(payment_status IN ('unpaid', 'paid', 'partial')) DEFAULT 'unpaid',
                is_makeup INTEGER DEFAULT 0,
                makeup_for INTEGER DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                postpone_reason TEXT DEFAULT NULL,
                is_completed INTEGER DEFAULT 0,
                student_attendance TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT NULL,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        ");

        // Copy data, converting postponed_holiday to excused
        $existingColumns = ['id', 'course_id', 'lecture_number', 'date'];
        $optionalColumns = ['time', 'activity', 'homework', 'payment_status', 'is_makeup', 'makeup_for', 'notes', 'postpone_reason', 'is_completed', 'student_attendance', 'created_at', 'updated_at'];
        
        foreach ($optionalColumns as $col) {
            if (in_array($col, $columns)) {
                $existingColumns[] = $col;
            }
        }
        
        $columnListSafe = implode(', ', $existingColumns);
        $selectColumns = str_replace('attendance', "CASE WHEN attendance = 'postponed_holiday' THEN 'excused' ELSE attendance END as attendance", $columnListSafe);
        
        // Add attendance to insert columns
        $insertColumns = $columnListSafe . ', attendance';

        DB::statement("
            INSERT INTO lectures_old ({$insertColumns})
            SELECT {$selectColumns}, CASE WHEN attendance = 'postponed_holiday' THEN 'excused' ELSE attendance END FROM lectures
        ");

        DB::statement("DROP TABLE lectures");
        DB::statement("ALTER TABLE lectures_old RENAME TO lectures");
    }
};
