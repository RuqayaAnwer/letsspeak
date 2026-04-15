<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Http\Controllers\CourseController;
use Illuminate\Http\Request;
use App\Models\User;

class TestCourseCreate extends Command
{
    protected $signature = 'test:course';
    protected $description = 'Test course creation';

    public function handle()
    {
        try {
            $user = User::where('role', 'admin')->first();
            $request = Request::create('/api/courses', 'POST', [
                'trainer_id'=>1,
                'student_ids'=>[1],
                'course_package_id'=>1,
                'lectures_count'=>12,
                'start_date'=>'2026-04-16',
                'lecture_time'=>'10:00',
                'lecture_days'=>['mon','wed','fri'],
                'is_dual'=>false,
                'payment_method'=>'zain_cash',
                'is_custom'=>false,
                'paid_amount'=>0,
                'discount'=>0
            ]);
            $request->setUserResolver(function () use ($user) {
                return $user;
            });
            
            $controller = new CourseController();
            $response = $controller->store($request);
            $this->info("Response code: " . $response->getStatusCode());
            $this->info($response->getContent());
        } catch (\Exception $e) {
            $this->error("Exception: " . $e->getMessage());
            $this->error($e->getTraceAsString());
        }
    }
}
