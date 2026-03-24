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
        // Fix packages that were incorrectly initialized to 0 postponements
        $packages = DB::table('course_packages')->get();
        foreach ($packages as $pkg) {
            $traineeMax = 3;
            if (str_contains($pkg->name, 'مزاجي') || str_contains($pkg->name, 'توازن') || str_contains($pkg->name, 'التوازن')) {
                $traineeMax = 1;
            }

            if ($pkg->trainee_max_postponements === 0 && $pkg->trainer_max_postponements === 0) {
                DB::table('course_packages')
                    ->where('id', $pkg->id)
                    ->update([
                        'trainee_max_postponements' => $traineeMax,
                        'trainer_max_postponements' => 3
                    ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reversible is not strictly needed as it's just data seeding
    }
};
