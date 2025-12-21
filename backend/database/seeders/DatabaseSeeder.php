<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Trainer;
use App\Models\Student;
use App\Models\CourseType;
use App\Models\Course;
use App\Models\CourseStudent;
use App\Models\Lecture;
use App\Models\Payment;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // ========================================
        // 1. System Users
        // ========================================
        
        $adminUser = User::create([
            'name' => 'مدير النظام',
            'email' => 'admin@letspeak.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $csUser = User::create([
            'name' => 'أحمد خدمة العملاء',
            'email' => 'cs@letspeak.com',
            'password' => Hash::make('password'),
            'role' => 'customer_service',
            'status' => 'active',
        ]);

        $financeUser = User::create([
            'name' => 'سارة المالية',
            'email' => 'finance@letspeak.com',
            'password' => Hash::make('password'),
            'role' => 'finance',
            'status' => 'active',
        ]);

        // ========================================
        // 2. Trainers
        // ========================================
        
        // Create trainer users first
        $trainerUser1 = User::create([
            'name' => 'محمد أحمد',
            'email' => 'mohammed@letspeak.com',
            'password' => Hash::make('password'),
            'role' => 'trainer',
            'status' => 'active',
        ]);

        $trainerUser2 = User::create([
            'name' => 'فاطمة علي',
            'email' => 'fatima@letspeak.com',
            'password' => Hash::make('password'),
            'role' => 'trainer',
            'status' => 'active',
        ]);

        $trainerUser3 = User::create([
            'name' => 'علي حسن',
            'email' => 'ali@letspeak.com',
            'password' => Hash::make('password'),
            'role' => 'trainer',
            'status' => 'active',
        ]);
        
        $trainer1 = Trainer::create([
            'user_id' => $trainerUser1->id,
            'name' => 'محمد أحمد',
            'username' => 'mohammed',
            'password' => Hash::make('password'),
            'email' => 'mohammed@letspeak.com',
            'phone' => '+964770123456',
            'specialty' => 'محادثة إنجليزية',
            'status' => 'active',
            'notes' => 'مدرب متمرس - 5 سنوات خبرة',
        ]);

        $trainer2 = Trainer::create([
            'user_id' => $trainerUser2->id,
            'name' => 'فاطمة علي',
            'username' => 'fatima',
            'password' => Hash::make('password'),
            'email' => 'fatima@letspeak.com',
            'phone' => '+964770234567',
            'specialty' => 'قواعد وكتابة - IELTS',
            'status' => 'active',
            'notes' => 'متخصصة في اختبارات IELTS',
        ]);

        $trainer3 = Trainer::create([
            'user_id' => $trainerUser3->id,
            'name' => 'علي حسن',
            'username' => 'ali',
            'password' => Hash::make('password'),
            'email' => 'ali@letspeak.com',
            'phone' => '+964770345678',
            'specialty' => 'إنجليزي أعمال',
            'status' => 'active',
            'notes' => 'خبرة في تدريب الشركات',
        ]);

        // ========================================
        // 3. Students
        // ========================================
        
        $students = [
            Student::create(['name' => 'عبدالله كريم', 'phone' => '+964770111111', 'level' => 'L2', 'notes' => 'طالب مجتهد']),
            Student::create(['name' => 'نور الهدى', 'phone' => '+964770222222', 'level' => 'L4', 'notes' => 'كورس ثنائي']),
            Student::create(['name' => 'زينب محمد', 'phone' => '+964770333333', 'level' => 'L4', 'notes' => 'شريكة نور الهدى']),
            Student::create(['name' => 'أمير العتابي', 'phone' => '+964770444444', 'level' => 'L6', 'notes' => 'تحضير IELTS']),
            Student::create(['name' => 'رقية حسين', 'phone' => '+964770555555', 'level' => 'L1', 'notes' => 'مبتدئة']),
            Student::create(['name' => 'حسن العبيدي', 'phone' => '+964770666666', 'level' => 'L5', 'notes' => 'رجل أعمال']),
            Student::create(['name' => 'سجاد كاظم', 'phone' => '+964770777777', 'level' => 'L3', 'notes' => 'موقف مؤقتاً']),
            Student::create(['name' => 'مريم الساعدي', 'phone' => '+964770888888', 'level' => 'L7', 'notes' => 'طالبة متفوقة']),
            Student::create(['name' => 'يوسف الخالدي', 'phone' => '+964770999999', 'level' => 'L1', 'notes' => 'بدأ للتو']),
            Student::create(['name' => 'فاطمة الجبوري', 'phone' => '+964771000000', 'level' => 'L3', 'notes' => 'مستوى متوسط']),
        ];

        // ========================================
        // 4. Course Types
        // ========================================
        
        $typeBasic = CourseType::create([
            'name' => 'بمزاجي',
            'name_en' => 'Basic',
            'lectures_count' => 8,
            'default_price' => 50000,
            'description' => 'كورس أساسي - 8 محاضرات',
            'is_active' => true,
        ]);

        $typeBalance = CourseType::create([
            'name' => 'التوازن',
            'name_en' => 'Balance',
            'lectures_count' => 12,
            'default_price' => 75000,
            'description' => 'كورس متوازن - 12 محاضرة',
            'is_active' => true,
        ]);

        $typeSpeed = CourseType::create([
            'name' => 'السرعة',
            'name_en' => 'Speed',
            'lectures_count' => 20,
            'default_price' => 100000,
            'description' => 'كورس مكثف - 20 محاضرة',
            'is_active' => true,
        ]);

        // ========================================
        // 5. Courses with Students and Lectures
        // ========================================
        
        // Course 1: Active - عبدالله (basic)
        $course1 = Course::create([
            'trainer_id' => $trainer1->id,
            'course_type_id' => $typeBasic->id,
            'title' => 'محادثة للمبتدئين',
            'lectures_count' => 8,
            'start_date' => Carbon::now()->subDays(14),
            'lecture_time' => '18:00',
            'lecture_days' => ['Sunday', 'Tuesday', 'Thursday'],
            'status' => 'active',
            'payment_method' => 'ZainCash',
            'subscription_source' => 'Facebook',
            'renewed_with_trainer' => false,
            'total_amount' => 50000,
            'amount_paid' => 50000,
        ]);
        CourseStudent::create(['course_id' => $course1->id, 'student_id' => $students[0]->id, 'is_primary' => true]);
        $this->generateLectures($course1, 5);

        // Course 2: Active - نور + زينب (balance, dual)
        $course2 = Course::create([
            'trainer_id' => $trainer1->id,
            'course_type_id' => $typeBalance->id,
            'title' => 'كورس ثنائي',
            'lectures_count' => 12,
            'start_date' => Carbon::now()->subDays(21),
            'lecture_time' => '20:00',
            'lecture_days' => ['Monday', 'Wednesday'],
            'status' => 'active',
            'payment_method' => 'نقد',
            'subscription_source' => 'صديق',
            'renewed_with_trainer' => true,
            'amount_updates' => 'خصم 10%',
            'total_amount' => 135000,
            'amount_paid' => 90000,
        ]);
        CourseStudent::create(['course_id' => $course2->id, 'student_id' => $students[1]->id, 'is_primary' => true]);
        CourseStudent::create(['course_id' => $course2->id, 'student_id' => $students[2]->id, 'is_primary' => false]);
        $this->generateLectures($course2, 10);

        // Course 3: Finished - أمير (speed)
        $course3 = Course::create([
            'trainer_id' => $trainer2->id,
            'course_type_id' => $typeSpeed->id,
            'title' => 'تحضير IELTS',
            'lectures_count' => 20,
            'start_date' => Carbon::now()->subDays(60),
            'lecture_time' => '17:00',
            'lecture_days' => ['Sunday', 'Tuesday', 'Thursday'],
            'status' => 'finished',
            'payment_method' => 'تحويل بنكي',
            'subscription_source' => 'Instagram',
            'renewed_with_trainer' => false,
            'total_amount' => 100000,
            'amount_paid' => 100000,
            'finished_at' => Carbon::now()->subDays(10),
        ]);
        CourseStudent::create(['course_id' => $course3->id, 'student_id' => $students[3]->id, 'is_primary' => true]);
        $this->generateLectures($course3, 20, true);

        // Course 4: Active - رقية (basic)
        $course4 = Course::create([
            'trainer_id' => $trainer2->id,
            'course_type_id' => $typeBasic->id,
            'title' => 'أساسيات اللغة',
            'lectures_count' => 8,
            'start_date' => Carbon::now()->subDays(7),
            'lecture_time' => '19:00',
            'lecture_days' => ['Saturday', 'Monday'],
            'status' => 'active',
            'payment_method' => 'ZainCash',
            'subscription_source' => 'Facebook',
            'renewed_with_trainer' => false,
            'total_amount' => 50000,
            'amount_paid' => 25000,
        ]);
        CourseStudent::create(['course_id' => $course4->id, 'student_id' => $students[4]->id, 'is_primary' => true]);
        $this->generateLectures($course4, 3);

        // Course 5: Active - حسن (balance)
        $course5 = Course::create([
            'trainer_id' => $trainer3->id,
            'course_type_id' => $typeBalance->id,
            'title' => 'إنجليزي أعمال',
            'lectures_count' => 12,
            'start_date' => Carbon::now()->subDays(10),
            'lecture_time' => '10:00',
            'lecture_days' => ['Sunday', 'Wednesday'],
            'status' => 'active',
            'payment_method' => 'نقد',
            'subscription_source' => 'LinkedIn',
            'renewed_with_trainer' => true,
            'total_amount' => 75000,
            'amount_paid' => 75000,
        ]);
        CourseStudent::create(['course_id' => $course5->id, 'student_id' => $students[5]->id, 'is_primary' => true]);
        $this->generateLectures($course5, 6);

        // Course 6: Paused - سجاد (basic)
        $course6 = Course::create([
            'trainer_id' => $trainer3->id,
            'course_type_id' => $typeBasic->id,
            'title' => 'محادثة',
            'lectures_count' => 8,
            'start_date' => Carbon::now()->subDays(30),
            'lecture_time' => '15:00',
            'lecture_days' => ['Tuesday', 'Thursday'],
            'status' => 'paused',
            'payment_method' => 'تحويل بنكي',
            'subscription_source' => 'Facebook',
            'renewed_with_trainer' => false,
            'total_amount' => 50000,
            'amount_paid' => 50000,
            'notes' => 'موقف بسبب السفر',
        ]);
        CourseStudent::create(['course_id' => $course6->id, 'student_id' => $students[6]->id, 'is_primary' => true]);
        $this->generateLectures($course6, 4);

        // Course 7: Paid - مريم (balance)
        $course7 = Course::create([
            'trainer_id' => $trainer1->id,
            'course_type_id' => $typeBalance->id,
            'title' => 'متقدم',
            'lectures_count' => 12,
            'start_date' => Carbon::now()->subDays(50),
            'lecture_time' => '16:00',
            'lecture_days' => ['Sunday', 'Tuesday', 'Thursday'],
            'status' => 'paid',
            'payment_method' => 'نقد',
            'subscription_source' => 'صديق',
            'renewed_with_trainer' => true,
            'total_amount' => 75000,
            'amount_paid' => 75000,
            'finished_at' => Carbon::now()->subDays(15),
        ]);
        CourseStudent::create(['course_id' => $course7->id, 'student_id' => $students[7]->id, 'is_primary' => true]);
        $this->generateLectures($course7, 12, true);

        // Course 8: Active - يوسف (basic, new)
        $course8 = Course::create([
            'trainer_id' => $trainer1->id,
            'course_type_id' => $typeBasic->id,
            'title' => 'مبتدئ',
            'lectures_count' => 8,
            'start_date' => Carbon::now()->subDays(2),
            'lecture_time' => '11:00',
            'lecture_days' => ['Thursday', 'Saturday'],
            'status' => 'active',
            'payment_method' => 'ZainCash',
            'subscription_source' => 'TikTok',
            'renewed_with_trainer' => false,
            'total_amount' => 50000,
            'amount_paid' => 50000,
        ]);
        CourseStudent::create(['course_id' => $course8->id, 'student_id' => $students[8]->id, 'is_primary' => true]);
        $this->generateLectures($course8, 1);

        // ========================================
        // 6. Payments
        // ========================================
        
        Payment::create([
            'course_id' => $course1->id,
            'student_id' => $students[0]->id,
            'amount' => 50000,
            'payment_method' => 'ZainCash',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(14),
            'recorded_by' => $csUser->id,
        ]);

        Payment::create([
            'course_id' => $course2->id,
            'student_id' => $students[1]->id,
            'amount' => 45000,
            'payment_method' => 'نقد',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(21),
            'recorded_by' => $csUser->id,
        ]);

        Payment::create([
            'course_id' => $course2->id,
            'student_id' => $students[1]->id,
            'amount' => 45000,
            'payment_method' => 'نقد',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(7),
            'recorded_by' => $financeUser->id,
        ]);

        Payment::create([
            'course_id' => $course3->id,
            'student_id' => $students[3]->id,
            'amount' => 100000,
            'payment_method' => 'تحويل بنكي',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(60),
            'recorded_by' => $csUser->id,
        ]);

        Payment::create([
            'course_id' => $course4->id,
            'student_id' => $students[4]->id,
            'amount' => 25000,
            'payment_method' => 'ZainCash',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(7),
            'notes' => 'دفعة أولى',
            'recorded_by' => $csUser->id,
        ]);

        Payment::create([
            'course_id' => $course5->id,
            'student_id' => $students[5]->id,
            'amount' => 75000,
            'payment_method' => 'نقد',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(10),
            'recorded_by' => $financeUser->id,
        ]);

        Payment::create([
            'course_id' => $course6->id,
            'student_id' => $students[6]->id,
            'amount' => 50000,
            'payment_method' => 'تحويل بنكي',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(30),
            'recorded_by' => $csUser->id,
        ]);

        Payment::create([
            'course_id' => $course7->id,
            'student_id' => $students[7]->id,
            'amount' => 75000,
            'payment_method' => 'نقد',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(50),
            'recorded_by' => $csUser->id,
        ]);

        Payment::create([
            'course_id' => $course8->id,
            'student_id' => $students[8]->id,
            'amount' => 50000,
            'payment_method' => 'ZainCash',
            'status' => 'completed',
            'payment_date' => Carbon::now()->subDays(2),
            'recorded_by' => $csUser->id,
        ]);
    }

    /**
     * Generate lectures for a course.
     */
    private function generateLectures(Course $course, int $completedCount, bool $allCompleted = false): void
    {
        $dayMap = [
            'Sunday' => 0, 'Monday' => 1, 'Tuesday' => 2,
            'Wednesday' => 3, 'Thursday' => 4, 'Friday' => 5, 'Saturday' => 6,
        ];

        $scheduleDays = array_map(fn($day) => $dayMap[$day] ?? 0, $course->lecture_days);
        $currentDate = Carbon::parse($course->start_date);
        $lectureNumber = 1;

        $activities = ['engaged', 'normal', 'not_engaged'];
        $homeworks = ['yes', 'partial', 'no'];

        while ($lectureNumber <= $course->lectures_count) {
            if (in_array($currentDate->dayOfWeek, $scheduleDays)) {
                $isCompleted = $allCompleted || $lectureNumber <= $completedCount;
                
                Lecture::create([
                    'course_id' => $course->id,
                    'lecture_number' => $lectureNumber,
                    'date' => $currentDate->format('Y-m-d'),
                    'attendance' => $isCompleted ? 'present' : 'pending',
                    'activity' => $isCompleted ? $activities[array_rand($activities)] : null,
                    'homework' => $isCompleted ? $homeworks[array_rand($homeworks)] : null,
                    'payment_status' => $isCompleted ? 'paid' : 'unpaid',
                    'is_makeup' => false,
                ]);
                
                $lectureNumber++;
            }
            $currentDate->addDay();
        }
    }
}
