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
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('phone', 20)->nullable();
            $table->enum('level', ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'])->default('L1');
            $table->enum('status', ['active', 'inactive', 'archived'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('name', 'idx_students_name');
            $table->index('phone', 'idx_students_phone');
            $table->index('status', 'idx_students_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
