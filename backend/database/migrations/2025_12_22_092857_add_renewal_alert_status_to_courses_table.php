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
            $table->enum('renewal_alert_status', ['none', 'alert', 'sent', 'renewed'])
                  ->default('none')
                  ->after('renewal_status')
                  ->comment('حالة تنبيه التجديد: none=لا يوجد, alert=تنبيه, sent=تم الإرسال, renewed=تم الاشتراك');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('renewal_alert_status');
        });
    }
};
