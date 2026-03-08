<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * تخزين كلمة المرور بشكل مشفّر لتمكين المدير من عرضها عند نسيان الموظف (للمدير فقط).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('recoverable_password')->nullable()->after('password')->comment('كلمة مرور قابلة للاسترجاع للمدير - مخزنة مشفّرة');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('recoverable_password');
        });
    }
};
