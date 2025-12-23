<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * جدول معلومات المحاضرات لكل طالب
     */
    public function up(): void
    {
        if (!Schema::hasTable('lecture_students')) {
            Schema::create('lecture_students', function (Blueprint $table) {
                $table->id();
                $table->foreignId('lecture_id')->constrained()->onDelete('cascade');
                $table->foreignId('student_id')->constrained()->onDelete('cascade');
                $table->string('attendance')->default('pending');
                $table->string('activity')->nullable();
                $table->string('homework')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                
                $table->unique(['lecture_id', 'student_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lecture_students');
    }
};















