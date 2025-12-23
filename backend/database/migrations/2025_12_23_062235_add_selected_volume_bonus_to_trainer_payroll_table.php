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
        Schema::table('trainer_payroll', function (Blueprint $table) {
            $table->decimal('selected_volume_bonus', 12, 2)->nullable()->after('include_volume_bonus')->comment('مكافأة الكمية المختارة يدوياً (30000 أو 80000 أو null)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trainer_payroll', function (Blueprint $table) {
            $table->dropColumn('selected_volume_bonus');
        });
    }
};
