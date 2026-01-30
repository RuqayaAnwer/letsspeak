<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * إضافة طريقة التحويل ورقم الحساب إلى جدول المدربين
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // For SQLite, use raw SQL
            DB::statement("ALTER TABLE trainers ADD COLUMN payment_method TEXT )");
            DB::statement("ALTER TABLE trainers ADD COLUMN payment_account_number TEXT(50)");
        } else {
            Schema::table('trainers', function (Blueprint $table) {
                $table->enum('payment_method', ['zain_cash', 'qi_card'])->nullable()->after('notes')->comment('طريقة التحويل: زين كاش أو كي كارد');
                $table->string('payment_account_number', 50)->nullable()->after('payment_method')->comment('رقم البطاقة أو الحساب');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // SQLite doesn't support dropping columns easily
            // This is intentionally left empty for SQLite compatibility
        } else {
            Schema::table('trainers', function (Blueprint $table) {
                $table->dropColumn(['payment_method', 'payment_account_number']);
            });
        }
    }
};




