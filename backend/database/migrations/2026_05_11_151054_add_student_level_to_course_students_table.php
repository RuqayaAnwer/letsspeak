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
        if (!Schema::hasColumn('course_students', 'student_level')) {
            Schema::table('course_students', function (Blueprint $table) {
                $table->string('student_level')->nullable()->after('is_primary');
            });
        }
        
        if (!Schema::hasColumn('courses', 'student_level')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->string('student_level')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('course_students', 'student_level')) {
            Schema::table('course_students', function (Blueprint $table) {
                $table->dropColumn('student_level');
            });
        }
        
        if (Schema::hasColumn('courses', 'student_level')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropColumn('student_level');
            });
        }
    }
};
