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
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value');
            $table->string('description', 255)->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        // Insert default settings
        DB::table('settings')->insert([
            [
                'key' => 'lecture_rate',
                'value' => '4000',
                'description' => 'سعر المحاضرة الواحدة بالدينار العراقي',
                'updated_at' => now(),
            ],
            [
                'key' => 'renewal_bonus',
                'value' => '5000',
                'description' => 'مكافأة التجديد لكل طالب بالدينار العراقي',
                'updated_at' => now(),
            ],
            [
                'key' => 'volume_bonus_60',
                'value' => '30000',
                'description' => 'مكافأة إكمال 60 محاضرة بالدينار العراقي',
                'updated_at' => now(),
            ],
            [
                'key' => 'volume_bonus_80',
                'value' => '80000',
                'description' => 'مكافأة إكمال 80 محاضرة بالدينار العراقي (تحل محل مكافأة 60)',
                'updated_at' => now(),
            ],
            [
                'key' => 'competition_bonus',
                'value' => '20000',
                'description' => 'مكافأة المنافسة لأفضل 3 مدربين بالتجديدات',
                'updated_at' => now(),
            ],
            [
                'key' => 'max_postponements',
                'value' => '3',
                'description' => 'الحد الأقصى للتأجيلات المسموحة لكل كورس',
                'updated_at' => now(),
            ],
            [
                'key' => 'completion_alert_percent',
                'value' => '75',
                'description' => 'نسبة الإكمال لعرض تنبيه قرب الانتهاء',
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
























