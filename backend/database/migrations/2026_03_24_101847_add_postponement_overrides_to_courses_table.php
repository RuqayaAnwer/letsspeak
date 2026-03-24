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
        Schema::table('courses', function (Blueprint $table) {
            $table->integer('student_max_postponements_override')->nullable()->after('postponements_used')->comment('Overrides package limit for student directly on the course');
            $table->integer('trainer_max_postponements_override')->nullable()->after('student_max_postponements_override')->comment('Overrides package limit for trainer directly on the course');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['student_max_postponements_override', 'trainer_max_postponements_override']);
        });
    }
};
