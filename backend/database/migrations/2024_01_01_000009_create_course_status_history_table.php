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
        Schema::create('course_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->onDelete('cascade');
            $table->string('old_status', 50)->nullable();
            $table->string('new_status', 50);
            $table->foreignId('changed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->string('reason', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
            
            // Index
            $table->index('course_id', 'idx_status_history_course');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('course_status_history');
    }
};





















