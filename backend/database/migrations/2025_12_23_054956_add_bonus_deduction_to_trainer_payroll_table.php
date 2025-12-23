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
            $table->decimal('bonus_deduction', 12, 2)->default(0)->after('competition_bonus')->comment('بونص أو خصم إضافي (موجب = بونص، سالب = خصم)');
            $table->text('bonus_deduction_notes')->nullable()->after('bonus_deduction')->comment('ملاحظات توضح سبب البونص أو الخصم');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trainer_payroll', function (Blueprint $table) {
            $table->dropColumn(['bonus_deduction', 'bonus_deduction_notes']);
        });
    }
};
