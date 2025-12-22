<?php

namespace Database\Seeders;

use App\Models\CoursePackage;
use Illuminate\Database\Seeder;

class CoursePackageSeeder extends Seeder
{
    public function run(): void
    {
        CoursePackage::truncate();

        CoursePackage::create([
            'name' => 'بمزاجي',
            'lectures_count' => 8,
            'description' => 'باقة مرنة مكونة من 8 محاضرات',
            'price' => 100000,
        ]);

        CoursePackage::create([
            'name' => 'التوازن',
            'lectures_count' => 12,
            'description' => 'باقة متوازنة مكونة من 12 محاضرة',
            'price' => 150000,
        ]);

        CoursePackage::create([
            'name' => 'السرعة',
            'lectures_count' => 20,
            'description' => 'باقة مكثفة مكونة من 20 محاضرة للتعلم السريع',
            'price' => 250000,
        ]);
    }
}

