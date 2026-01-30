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
        if (DB::getDriverName() === 'sqlite') {
            // For SQLite, we need to add the column
            DB::statement("ALTER TABLE lectures ADD COLUMN trainer_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' )");
        } else {
            Schema::table('lectures', function (Blueprint $table) {
                $table->enum('trainer_payment_status', ['unpaid', 'paid'])->default('unpaid')->after('homework');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // For SQLite, we need to recreate the table without the column
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
            Schema::table('lectures', function (Blueprint $table) {
                $table->dropColumn('trainer_payment_status');
            });
        }
    }
};
