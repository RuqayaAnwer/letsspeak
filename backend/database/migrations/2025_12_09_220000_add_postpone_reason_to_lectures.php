<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add postpone_reason column to lectures table
        DB::statement("ALTER TABLE lectures ADD COLUMN postpone_reason TEXT DEFAULT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // SQLite doesn't support dropping columns easily, so we'll recreate the table
        // For simplicity, we'll just leave the column if rolling back
    }
};




















