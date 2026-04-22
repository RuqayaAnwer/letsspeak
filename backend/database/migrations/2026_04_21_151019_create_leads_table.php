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
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            
            // Personal & Contact Info
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone_whatsapp');
            $table->string('telegram_id')->nullable();
            $table->string('governorate')->nullable();
            $table->integer('age')->nullable();
            $table->enum('gender', ['male', 'female'])->nullable();
            
            // Educational & Form Info
            $table->string('package_selected')->nullable(); // الباقة المختارة
            $table->string('preferred_time')->nullable();
            $table->string('current_level')->nullable();
            $table->string('source')->nullable(); // e.g., 'form', 'php-intro'
            
            // Pipeline & Intro Tracking
            $table->datetime('intro_date')->nullable();
            $table->string('attendance_status')->nullable(); // مجدولة، مكتملة، لم يحضر
            $table->text('intro_evaluation')->nullable();
            $table->string('assigned_level')->nullable();
            
            // Kanban Status
            $table->string('status')->default('new'); // new, contacted, waiting_intro, attended_intro, confirmed, rejected
            $table->text('notes')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
