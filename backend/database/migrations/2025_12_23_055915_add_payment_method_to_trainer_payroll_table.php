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
            $table->enum('payment_method', ['zain_cash', 'qi_card'])->nullable()->after('bonus_deduction_notes')->comment('طريقة التحويل: زين كاش أو كي كارد');
            $table->string('payment_account_number', 50)->nullable()->after('payment_method')->comment('رقم البطاقة أو الحساب');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trainer_payroll', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'payment_account_number']);
        });
    }
};
