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
        Schema::table('course_students', function (Blueprint $table) {
            $table->string('student_level')->nullable()->after('is_primary');
        });
        
        Schema::table('courses', function (Blueprint $table) {
            $table->string('student_level')->nullable()->after('student_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('course_students', function (Blueprint $table) {
            $table->dropColumn('student_level');
        });
        
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('student_level');
        });
    }
};
