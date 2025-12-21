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
        Schema::table('trainers', function (Blueprint $table) {
            // Add level columns
            $table->string('min_level', 10)->nullable()->after('phone');
            $table->string('max_level', 10)->nullable()->after('min_level');
            
            // Remove specialty column
            $table->dropColumn('specialty');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trainers', function (Blueprint $table) {
            // Re-add specialty column
            $table->string('specialty', 255)->nullable()->after('phone');
            
            // Remove level columns
            $table->dropColumn(['min_level', 'max_level']);
        });
    }
};
