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
        Schema::table('students', function (Blueprint $table) {
            if (!Schema::hasColumn('students', 'is_child')) {
                $table->boolean('is_child')->default(false)->after('status');
            }
            if (!Schema::hasColumn('students', 'age')) {
                $table->integer('age')->nullable()->after('is_child');
            }
        });

        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'is_kids')) {
                $table->boolean('is_kids')->default(false)->after('status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn(['is_child', 'age']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['is_kids']);
        });
    }
};
