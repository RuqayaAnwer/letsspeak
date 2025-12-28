<?php
/**
 * Course Repository - Data access for courses
 */

namespace App\JsonStorage\Repositories;

use App\JsonStorage\JsonRepository;

class CourseRepository extends JsonRepository
{
    protected string $collection = 'courses';

    /**
     * Get all courses
     */
    public function all(): array
    {
        return $this->readAll($this->collection);
    }

    /**
     * Find course by ID
     */
    public function find(int $id): ?array
    {
        return $this->findById($this->collection, $id);
    }

    /**
     * Get courses by trainer ID
     */
    public function getByTrainer(int $trainerId, ?string $status = null): array
    {
        $courses = $this->all();
        
        return array_values(array_filter($courses, function ($course) use ($trainerId, $status) {
            $matchTrainer = ($course['trainer_id'] ?? null) == $trainerId;
            $matchStatus = $status === null || ($course['course_status'] ?? '') === $status;
            
            return $matchTrainer && $matchStatus;
        }));
    }

    /**
     * Get courses by status
     */
    public function getByStatus(string $status): array
    {
        return array_values($this->findWhere($this->collection, ['course_status' => $status]));
    }

    /**
     * Get active courses
     */
    public function getActive(): array
    {
        return $this->getByStatus('Active');
    }

    /**
     * Get finished courses
     */
    public function getFinished(): array
    {
        $courses = $this->all();
        
        return array_values(array_filter($courses, function ($course) {
            $status = $course['course_status'] ?? '';
            return in_array($status, ['Finished', 'Paid']);
        }));
    }

    /**
     * Get paused courses
     */
    public function getPaused(): array
    {
        return $this->getByStatus('Paused');
    }

    /**
     * Get courses ending soon (>= 75% completion)
     */
    public function getEndingSoon(): array
    {
        $courses = $this->getActive();
        
        return array_values(array_filter($courses, function ($course) {
            $progress = $this->calculateProgress($course);
            return $progress >= 75;
        }));
    }

    /**
     * Get courses finished recently (last 7 days)
     */
    public function getRecentlyFinished(int $days = 7): array
    {
        $courses = $this->getFinished();
        $cutoffDate = date('Y-m-d', strtotime("-{$days} days"));
        
        return array_values(array_filter($courses, function ($course) use ($cutoffDate) {
            $finishedDate = $course['finished_date'] ?? $course['updated_at'] ?? null;
            return $finishedDate && $finishedDate >= $cutoffDate;
        }));
    }

    /**
     * Get courses started recently (last 7 days)
     */
    public function getRecentlyStarted(int $days = 7): array
    {
        $courses = $this->all();
        $cutoffDate = date('Y-m-d', strtotime("-{$days} days"));
        
        return array_values(array_filter($courses, function ($course) use ($cutoffDate) {
            $startDate = $course['course_start_date'] ?? null;
            return $startDate && $startDate >= $cutoffDate;
        }));
    }

    /**
     * Search courses by student name or trainer name
     */
    public function search(string $query, ?string $dateFrom = null, ?string $dateTo = null): array
    {
        $courses = $this->all();
        $query = mb_strtolower($query);
        
        return array_values(array_filter($courses, function ($course) use ($query, $dateFrom, $dateTo) {
            // Search in student name
            $studentName = mb_strtolower($course['student_name'] ?? '');
            $secondStudent = mb_strtolower($course['second_student_name'] ?? '');
            $trainerName = mb_strtolower($course['trainer_name'] ?? '');
            
            $matchQuery = empty($query) || 
                str_contains($studentName, $query) || 
                str_contains($secondStudent, $query) ||
                str_contains($trainerName, $query);
            
            // Date filter
            $startDate = $course['course_start_date'] ?? null;
            $matchDateFrom = !$dateFrom || ($startDate && $startDate >= $dateFrom);
            $matchDateTo = !$dateTo || ($startDate && $startDate <= $dateTo);
            
            return $matchQuery && $matchDateFrom && $matchDateTo;
        }));
    }

    /**
     * Calculate course progress percentage
     */
    public function calculateProgress(array $course): float
    {
        $totalLectures = $this->getTotalLectures($course);
        $completedLectures = $course['completed_lectures'] ?? 0;
        
        if ($totalLectures <= 0) {
            return 0;
        }
        
        return round(($completedLectures / $totalLectures) * 100, 1);
    }

    /**
     * Get total lectures for a course based on course_type
     */
    public function getTotalLectures(array $course): int
    {
        // First check if explicitly set
        if (isset($course['total_lectures']) && $course['total_lectures'] > 0) {
            return (int) $course['total_lectures'];
        }
        
        // Get from course_type
        $courseTypes = config('json_storage.course_types', []);
        $courseType = $course['course_type'] ?? '';
        
        return $courseTypes[$courseType] ?? 8; // Default to 8 if unknown
    }

    /**
     * Create new course
     */
    public function create(array $data): array
    {
        $course = [
            'timestamp' => $data['timestamp'] ?? date('Y-m-d H:i:s'),
            'student_name' => $data['student_name'],
            'second_student_name' => $data['second_student_name'] ?? null,
            'trainer_id' => $data['trainer_id'],
            'trainer_name' => $data['trainer_name'] ?? '',
            'time' => $data['time'] ?? '',
            'student_level' => $data['student_level'] ?? 'L1',
            'payment_method' => $data['payment_method'] ?? '',
            'notes' => $data['notes'] ?? '',
            'course_start_date' => $data['course_start_date'],
            'days' => $data['days'] ?? [],
            'course_status' => $data['course_status'] ?? 'Active',
            'course_type' => $data['course_type'] ?? 'بمزاجي',
            'total_lectures' => $this->getTotalLectures($data),
            'completed_lectures' => 0,
            'renewed_with_trainer' => $data['renewed_with_trainer'] ?? false,
            'amount_updates' => $data['amount_updates'] ?? '',
            'amount_paid_now' => $data['amount_paid_now'] ?? 0,
            'subscription_source' => $data['subscription_source'] ?? '',
            'google_sheets_row_id' => $data['google_sheets_row_id'] ?? null,
        ];

        return $this->insert($this->collection, $course);
    }

    /**
     * Update course
     */
    public function updateCourse(int $id, array $data): ?array
    {
        return $this->update($this->collection, $id, $data);
    }

    /**
     * Get courses with renewals by trainer for a specific month
     */
    public function getRenewalsByTrainer(int $trainerId, int $month, int $year): array
    {
        $courses = $this->getByTrainer($trainerId);
        
        return array_values(array_filter($courses, function ($course) use ($month, $year) {
            if (!($course['renewed_with_trainer'] ?? false)) {
                return false;
            }
            
            $startDate = $course['course_start_date'] ?? null;
            if (!$startDate) {
                return false;
            }
            
            $courseMonth = (int) date('m', strtotime($startDate));
            $courseYear = (int) date('Y', strtotime($startDate));
            
            return $courseMonth === $month && $courseYear === $year;
        }));
    }

    /**
     * Get trainer statistics for a month
     */
    public function getTrainerMonthlyStats(int $trainerId, int $month, int $year): array
    {
        $courses = $this->getByTrainer($trainerId);
        $renewals = $this->getRenewalsByTrainer($trainerId, $month, $year);
        
        $completedLectures = 0;
        $activeCourses = 0;
        $finishedCourses = 0;
        
        foreach ($courses as $course) {
            $status = $course['course_status'] ?? '';
            
            if ($status === 'Active') {
                $activeCourses++;
            } elseif (in_array($status, ['Finished', 'Paid'])) {
                $finishedCourses++;
            }
            
            $completedLectures += $course['completed_lectures'] ?? 0;
        }
        
        return [
            'trainer_id' => $trainerId,
            'month' => $month,
            'year' => $year,
            'completed_lectures' => $completedLectures,
            'active_courses' => $activeCourses,
            'finished_courses' => $finishedCourses,
            'renewals_count' => count($renewals),
        ];
    }
}





















