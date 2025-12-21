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
        Schema::create('trainers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->string('name', 255);
            $table->string('username', 100)->unique();
            $table->string('password', 255);
            $table->string('email', 255)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('specialty', 255)->nullable();
            $table->enum('status', ['active', 'inactive', 'archived'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('username', 'idx_trainers_username');
            $table->index('status', 'idx_trainers_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trainers');
    }
};
