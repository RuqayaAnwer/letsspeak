<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * إضافة حقل مكتمل للمحاضرات
     */
    public function up(): void
    {
        // Check if column already exists
        $columns = Schema::getColumnListing('lectures');
        
        if (!in_array('is_completed', $columns)) {
            // For SQLite compatibility, use raw SQL
            DB::statement("ALTER TABLE lectures ADD COLUMN is_completed INTEGER DEFAULT 0");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // SQLite doesn't support dropping columns easily
        // This is intentionally left empty for SQLite compatibility
    }
};




















