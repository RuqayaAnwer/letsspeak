<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * إضافة حقل الكورس الثنائي
     */
    public function up(): void
    {
        // Check if column already exists
        $columns = Schema::getColumnListing('courses');
        
        if (!in_array('is_dual', $columns)) {
            // For SQLite compatibility, use raw SQL
            DB::statement("ALTER TABLE courses ADD COLUMN is_dual INTEGER DEFAULT 0");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // SQLite doesn't support dropping columns easily
    }
};














