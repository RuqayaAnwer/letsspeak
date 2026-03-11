<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->unsignedInteger('postponements_used')->default(0)->after('renewal_alert_status');
        });

        // Backfill: count existing postponed lectures per course
        $postponed = [
            'postponed_by_trainer',
            'postponed_by_student',
            'postponed_holiday',
        ];
        $results = DB::table('lectures')
            ->whereIn('attendance', $postponed)
            ->selectRaw('course_id, count(*) as cnt')
            ->groupBy('course_id')
            ->get();
        foreach ($results as $row) {
            DB::table('courses')->where('id', $row->course_id)->update(['postponements_used' => $row->cnt]);
        }
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('postponements_used');
        });
    }
};
