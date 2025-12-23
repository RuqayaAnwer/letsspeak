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
            $table->enum('selected_bonus_type', ['renewal', 'competition', 'volume_60', 'volume_80'])->nullable()->after('include_competition_bonus')->comment('نوع المكافأة المختارة: تجديد، منافسة، كمية 60+، كمية 80+');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trainer_payroll', function (Blueprint $table) {
            $table->dropColumn('selected_bonus_type');
        });
    }
};
