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
            $table->integer('extra_lectures_count')->default(0)->after('lectures_count');
            $table->decimal('extra_lectures_fee', 10, 2)->default(0)->after('total_amount');
        });

        Schema::table('lectures', function (Blueprint $table) {
            $table->boolean('is_extra')->default(false)->after('is_makeup');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses_and_lectures', function (Blueprint $table) {
            //
        });
    }
};
