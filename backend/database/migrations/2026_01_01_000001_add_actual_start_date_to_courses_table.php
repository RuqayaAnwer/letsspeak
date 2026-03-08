<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * تاريخ بدء الكورس الفعلي (عند تفعيل المدرب لبدء الكورس) — منفصل عن تاريخ أول دفعة.
     */
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->date('actual_start_date')->nullable()->after('start_date')->comment('تاريخ بدء الكورس الفعلي (يفعّله المدرب)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('actual_start_date');
        });
    }
};
