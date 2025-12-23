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
            // حقول لتحديد ما إذا كانت المكافأة مفعلة أم لا
            $table->boolean('include_renewal_bonus')->default(true)->after('renewal_total')->comment('تضمين مكافأة التجديد');
            $table->boolean('include_volume_bonus')->default(true)->after('volume_bonus')->comment('تضمين مكافأة الكمية');
            $table->boolean('include_competition_bonus')->default(true)->after('competition_bonus')->comment('تضمين مكافأة المنافسة');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trainer_payroll', function (Blueprint $table) {
            $table->dropColumn(['include_renewal_bonus', 'include_volume_bonus', 'include_competition_bonus']);
        });
    }
};
