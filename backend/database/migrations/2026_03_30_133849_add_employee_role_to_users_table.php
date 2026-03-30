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
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql' || $driver === 'pgsql') {
            // MySQL/PostgreSQL: Modify ENUM
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'customer_service', 'finance', 'trainer', 'accounting', 'employee') NOT NULL DEFAULT 'customer_service'");
        }
        // If SQLite, the column was already converted to VARCHAR(50) in 2025_12_21_072947_add_trainer_role_to_users_table.php
        // so no database schema change is required.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql' || $driver === 'pgsql') {
            // Revert MySQL ENUM
            DB::statement("UPDATE users SET role = 'customer_service' WHERE role = 'employee'");
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'customer_service', 'finance', 'trainer', 'accounting') NOT NULL DEFAULT 'customer_service'");
        }
    }
};
