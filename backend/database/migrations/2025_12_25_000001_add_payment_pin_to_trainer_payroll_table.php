<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if SQLite
        if (DB::getDriverName() === 'sqlite') {
            DB::statement("ALTER TABLE trainer_payroll ADD COLUMN payment_pin TEXT(20)");
        } else {
            Schema::table('trainer_payroll', function (Blueprint $table) {
                $table->string('payment_pin', 20)->nullable()->after('payment_account_number')->comment('الرقم السري للبطاقة');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // SQLite doesn't support dropping columns easily
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('trainer_payroll', function (Blueprint $table) {
                $table->dropColumn('payment_pin');
            });
        }
    }
};

