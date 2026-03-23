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
        Schema::table('course_packages', function (Blueprint $table) {
            $table->integer('trainee_max_postponements')->default(0)->after('price');
            $table->integer('trainer_max_postponements')->default(0)->after('trainee_max_postponements');
            if (Schema::hasColumn('course_packages', 'max_postponements')) {
                $table->dropColumn('max_postponements');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('course_packages', function (Blueprint $table) {
            $table->integer('max_postponements')->default(0)->after('price');
            $table->dropColumn(['trainee_max_postponements', 'trainer_max_postponements']);
        });
    }
};
