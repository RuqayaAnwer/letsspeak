<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trainer_unavailability', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trainer_id')->constrained('trainers')->onDelete('cascade');
            $table->json('unavailable_days')->nullable()->comment('e.g., ["Friday", "Saturday"]');
            $table->json('unavailable_times')->nullable()->comment('e.g., [{"day": "Sunday", "from": "08:00", "to": "12:00"}]');
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->unique('trainer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trainer_unavailability');
    }
};











