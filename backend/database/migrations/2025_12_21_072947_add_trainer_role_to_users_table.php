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
        // Check database driver
        $driver = DB::getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite: Change column type to string (no ENUM support)
            DB::statement('PRAGMA foreign_keys=off;');
            
            // Create new table with string role
            DB::statement("
                CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    email_verified_at TIMESTAMP NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'customer_service',
                    status VARCHAR(50) NOT NULL DEFAULT 'active',
                    remember_token VARCHAR(100) NULL,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL
                )
            ");
            
            // Copy data
            DB::statement("
                INSERT INTO users_new (id, name, email, email_verified_at, password, role, status, remember_token, created_at, updated_at)
                SELECT id, name, email, email_verified_at, password, role, status, remember_token, created_at, updated_at
                FROM users
            ");
            
            // Drop old and rename
            Schema::dropIfExists('users');
            DB::statement('ALTER TABLE users_new RENAME TO users');
            
            // Recreate indexes
            DB::statement('CREATE INDEX idx_users_role ON users(role)');
            DB::statement('CREATE INDEX idx_users_status ON users(status)');
            
            DB::statement('PRAGMA foreign_keys=on;');
        } else {
            // MySQL/PostgreSQL: Modify ENUM
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'customer_service', 'finance', 'trainer', 'accounting') NOT NULL DEFAULT 'customer_service'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite: Revert to original (remove trainer role)
            DB::statement('PRAGMA foreign_keys=off;');
            
            DB::statement("
                CREATE TABLE users_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    email_verified_at TIMESTAMP NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'customer_service',
                    status VARCHAR(50) NOT NULL DEFAULT 'active',
                    remember_token VARCHAR(100) NULL,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL
                )
            ");
            
            DB::statement("
                INSERT INTO users_old (id, name, email, email_verified_at, password, role, status, remember_token, created_at, updated_at)
                SELECT id, name, email, email_verified_at, password, 
                       CASE WHEN role = 'trainer' THEN 'customer_service' ELSE role END,
                       status, remember_token, created_at, updated_at
                FROM users
            ");
            
            Schema::dropIfExists('users');
            DB::statement('ALTER TABLE users_old RENAME TO users');
            
            DB::statement('CREATE INDEX idx_users_role ON users(role)');
            DB::statement('CREATE INDEX idx_users_status ON users(status)');
            
            DB::statement('PRAGMA foreign_keys=on;');
        } else {
            // MySQL: Revert ENUM
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'customer_service', 'finance') NOT NULL DEFAULT 'customer_service'");
        }
    }
};
