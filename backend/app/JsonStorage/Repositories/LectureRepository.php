<?php
/**
 * Lecture Repository - Data access for lectures
 */

namespace App\JsonStorage\Repositories;

use App\JsonStorage\JsonRepository;

class LectureRepository extends JsonRepository
{
    protected string $collection = 'lectures';

    /**
     * Get all lectures
     */
    public function all(): array
    {
        return $this->readAll($this->collection);
    }

    /**
     * Find lecture by ID
     */
    public function find(int $id): ?array
    {
        return $this->findById($this->collection, $id);
    }

    /**
     * Get lectures for a specific course
     */
    public function getByCourse(int $courseId): array
    {
        $lectures = $this->findWhere($this->collection, ['course_id' => $courseId]);
        
        // Sort by lecture_number
        usort($lectures, function ($a, $b) {
            return ($a['lecture_number'] ?? 0) <=> ($b['lecture_number'] ?? 0);
        });
        
        return array_values($lectures);
    }

    /**
     * Generate lecture schedule for a course
     * 
     * @param int $courseId
     * @param string $startDate Course start date (Y-m-d)
     * @param array $days Days of the week (e.g. ['Sunday', 'Tuesday'])
     * @param int $totalLectures Total number of lectures
     */
    public function generateSchedule(int $courseId, string $startDate, array $days, int $totalLectures): array
    {
        // Map day names to day numbers
        $dayMap = [
            'Sunday' => 0, 'الأحد' => 0,
            'Monday' => 1, 'الإثنين' => 1,
            'Tuesday' => 2, 'الثلاثاء' => 2,
            'Wednesday' => 3, 'الأربعاء' => 3,
            'Thursday' => 4, 'الخميس' => 4,
            'Friday' => 5, 'الجمعة' => 5,
            'Saturday' => 6, 'السبت' => 6,
        ];

        $scheduleDays = [];
        foreach ($days as $day) {
            if (isset($dayMap[$day])) {
                $scheduleDays[] = $dayMap[$day];
            }
        }

        if (empty($scheduleDays)) {
            $scheduleDays = [0, 2]; // Default to Sunday, Tuesday
        }

        $lectures = [];
        $currentDate = new \DateTime($startDate);
        $lectureNumber = 1;

        while ($lectureNumber <= $totalLectures) {
            $dayOfWeek = (int) $currentDate->format('w');
            
            if (in_array($dayOfWeek, $scheduleDays)) {
                $lecture = $this->insert($this->collection, [
                    'course_id' => $courseId,
                    'lecture_number' => $lectureNumber,
                    'date' => $currentDate->format('Y-m-d'),
                    'attendance' => 'pending',
                    'activity' => null,
                    'homework' => null,
                    'notes' => null,
                    'payment_status' => 'unpaid',
                    'is_postponed' => false,
                    'postponed_from' => null,
                ]);
                
                $lectures[] = $lecture;
                $lectureNumber++;
            }
            
            $currentDate->modify('+1 day');
        }

        return $lectures;
    }

    /**
     * Update lecture
     */
    public function updateLecture(int $id, array $data): ?array
    {
        $lecture = $this->find($id);
        
        if (!$lecture) {
            return null;
        }

        // Handle postponement logic
        if (isset($data['attendance'])) {
            $attendance = $data['attendance'];
            
            // If Excused or Postponed_by_me, we might need to add a new lecture
            if (in_array($attendance, ['Excused', 'Postponed_by_me'])) {
                $data['is_postponed'] = true;
                $data['postponed_at'] = date('Y-m-d H:i:s');
            }
        }

        return $this->update($this->collection, $id, $data);
    }

    /**
     * Add postponed lecture at the end of the schedule
     * 
     * @param int $courseId
     * @param int $postponedFromLecture The lecture number that was postponed
     * @return array|null The new lecture or null if max postponements reached
     */
    public function addPostponedLecture(int $courseId, int $postponedFromLecture): ?array
    {
        $courseLectures = $this->getByCourse($courseId);
        
        // Count existing postponed lectures
        $postponedCount = 0;
        foreach ($courseLectures as $lecture) {
            if ($lecture['is_postponed'] ?? false) {
                $postponedCount++;
            }
        }

        $maxPostponements = config('json_storage.rules.max_postponements', 3);
        
        if ($postponedCount >= $maxPostponements) {
            return null; // Max postponements reached
        }

        // Get last lecture date and calculate new date
        $lastLecture = end($courseLectures);
        $lastDate = new \DateTime($lastLecture['date'] ?? date('Y-m-d'));
        $lastDate->modify('+7 days'); // Add a week

        $newLectureNumber = count($courseLectures) + 1;

        return $this->insert($this->collection, [
            'course_id' => $courseId,
            'lecture_number' => $newLectureNumber,
            'date' => $lastDate->format('Y-m-d'),
            'attendance' => 'pending',
            'activity' => null,
            'homework' => null,
            'notes' => "Makeup for postponed lecture #{$postponedFromLecture}",
            'payment_status' => 'unpaid',
            'is_postponed' => false,
            'postponed_from' => $postponedFromLecture,
        ]);
    }

    /**
     * Get completed lectures count for a course
     */
    public function getCompletedCount(int $courseId): int
    {
        $lectures = $this->getByCourse($courseId);
        
        return count(array_filter($lectures, function ($lecture) {
            $attendance = $lecture['attendance'] ?? 'pending';
            return in_array($attendance, ['Present', 'Partially']);
        }));
    }

    /**
     * Get postponement count for a course
     */
    public function getPostponementCount(int $courseId): int
    {
        $lectures = $this->getByCourse($courseId);
        
        return count(array_filter($lectures, function ($lecture) {
            return $lecture['is_postponed'] ?? false;
        }));
    }

    /**
     * Bulk update lectures for a course
     */
    public function bulkUpdate(int $courseId, array $updates): array
    {
        $updatedLectures = [];
        
        foreach ($updates as $lectureUpdate) {
            if (!isset($lectureUpdate['id'])) {
                continue;
            }
            
            $updated = $this->updateLecture($lectureUpdate['id'], $lectureUpdate);
            if ($updated) {
                $updatedLectures[] = $updated;
            }
        }
        
        return $updatedLectures;
    }
}





















