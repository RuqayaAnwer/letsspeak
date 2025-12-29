<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * إضافة حالة دفع المدرب للكورس
     */
    public function up(): void
    {
        // Check if column already exists
        $columns = Schema::getColumnListing('courses');
        
        if (!in_array('trainer_payment_status', $columns)) {
            // For SQLite compatibility, use raw SQL
            DB::statement("ALTER TABLE courses ADD COLUMN trainer_payment_status TEXT DEFAULT 'unpaid' CHECK(trainer_payment_status IN ('unpaid', 'paid'))");
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




















