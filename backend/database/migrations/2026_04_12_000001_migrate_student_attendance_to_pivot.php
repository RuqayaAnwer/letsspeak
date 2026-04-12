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
        // 1. Migrate JSON data to pivot table safely
        $lectures = DB::table('lectures')->whereNotNull('student_attendance')->get();

        foreach ($lectures as $lecture) {
            $attendanceData = json_decode($lecture->student_attendance, true);
            
            if (is_array($attendanceData)) {
                foreach ($attendanceData as $studentId => $data) {
                    if (is_array($data)) {
                        DB::table('lecture_students')->updateOrInsert(
                            ['lecture_id' => $lecture->id, 'student_id' => $studentId],
                            [
                                'attendance' => $data['attendance'] ?? 'pending',
                                'activity' => $data['activity'] ?? null,
                                'homework' => $data['homework'] ?? null,
                                'notes' => $data['notes'] ?? null,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]
                        );
                    }
                }
            }
        }

        // 2. Drop the JSON column from lectures
        Schema::table('lectures', function (Blueprint $table) {
            $table->dropColumn('student_attendance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lectures', function (Blueprint $table) {
            $table->json('student_attendance')->nullable();
        });
    }
};
