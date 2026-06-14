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
        if (!Schema::hasColumn('lectures', 'trainer_id')) {
            if (DB::getDriverName() === 'sqlite') {
                // Raw SQL to bypass SQLite recreate table bug in Laravel/Doctrine DBAL
                DB::statement('ALTER TABLE lectures ADD COLUMN trainer_id INTEGER REFERENCES trainers(id) ON DELETE SET NULL');
            } else {
                Schema::table('lectures', function (Blueprint $table) {
                    $table->foreignId('trainer_id')
                        ->nullable()
                        ->after('course_id')
                        ->constrained('trainers')
                        ->nullOnDelete();
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('lectures', 'trainer_id')) {
            if (DB::getDriverName() === 'sqlite') {
                try {
                    DB::statement('ALTER TABLE lectures DROP COLUMN trainer_id');
                } catch (\Exception $e) {
                    // Ignore if SQLite version doesn't support DROP COLUMN (pre 3.35.0)
                }
            } else {
                Schema::table('lectures', function (Blueprint $table) {
                    $table->dropForeign(['trainer_id']);
                    $table->dropColumn('trainer_id');
                });
            }
        }
    }
};
