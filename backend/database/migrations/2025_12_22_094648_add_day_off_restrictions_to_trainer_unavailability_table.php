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
        Schema::table('trainer_unavailability', function (Blueprint $table) {
            $table->timestamp('last_day_off_update')->nullable()->after('notes')->comment('تاريخ آخر تعديل يوم الإجازة');
            $table->integer('day_off_updates_count')->default(0)->after('last_day_off_update')->comment('عدد مرات التعديل في الساعة الحالية');
            $table->timestamp('day_off_updates_hour')->nullable()->after('day_off_updates_count')->comment('الساعة التي تم فيها آخر تعديل');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trainer_unavailability', function (Blueprint $table) {
            $table->dropColumn(['last_day_off_update', 'day_off_updates_count', 'day_off_updates_hour']);
        });
    }
};
