<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_packages', function (Blueprint $table) {
            $table->unsignedTinyInteger('max_postponements')->default(3)->after('price');
        });

        // Set by package name: بمزاجي & التوازن = 1, السرعة = 3
        DB::table('course_packages')->whereIn('name', ['بمزاجي', 'التوازن'])->update(['max_postponements' => 1]);
        DB::table('course_packages')->where('name', 'السرعة')->update(['max_postponements' => 3]);
    }

    public function down(): void
    {
        Schema::table('course_packages', function (Blueprint $table) {
            $table->dropColumn('max_postponements');
        });
    }
};
