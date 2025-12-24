<?php
/**
 * Student Repository - Data access for students
 */

namespace App\JsonStorage\Repositories;

use App\JsonStorage\JsonRepository;

class StudentRepository extends JsonRepository
{
    protected string $collection = 'students';

    /**
     * Get all students
     */
    public function all(): array
    {
        return $this->readAll($this->collection);
    }

    /**
     * Get active students only
     */
    public function getActive(): array
    {
        return array_values(array_filter($this->all(), function ($student) {
            return ($student['status'] ?? 'active') === 'active';
        }));
    }

    /**
     * Find student by ID
     */
    public function find(int $id): ?array
    {
        return $this->findById($this->collection, $id);
    }

    /**
     * Find student by name
     */
    public function findByName(string $name): ?array
    {
        $students = $this->all();
        
        foreach ($students as $student) {
            if (($student['name'] ?? '') === $name) {
                return $student;
            }
        }
        
        return null;
    }

    /**
     * Search students by name or phone
     */
    public function search(string $query): array
    {
        $students = $this->all();
        $query = mb_strtolower($query);
        
        return array_values(array_filter($students, function ($student) use ($query) {
            $name = mb_strtolower($student['name'] ?? '');
            $phone = $student['phone'] ?? '';
            
            return str_contains($name, $query) || str_contains($phone, $query);
        }));
    }

    /**
     * Create new student
     */
    public function create(array $data): array
    {
        $student = [
            'name' => $data['name'],
            'phone' => $data['phone'] ?? '',
            'notes' => $data['notes'] ?? '',
            'status' => 'active',
        ];

        return $this->insert($this->collection, $student);
    }

    /**
     * Update student
     */
    public function updateStudent(int $id, array $data): ?array
    {
        return $this->update($this->collection, $id, $data);
    }

    /**
     * Archive student (soft delete)
     */
    public function archive(int $id): ?array
    {
        return $this->softDelete($this->collection, $id, 'Student archived');
    }

    /**
     * Get student with their courses count
     */
    public function getWithCoursesCount(int $id): ?array
    {
        $student = $this->find($id);
        
        if (!$student) {
            return null;
        }

        // Get courses for this student
        $courseRepo = new CourseRepository();
        $courses = $courseRepo->all();
        
        $studentCourses = array_filter($courses, function ($course) use ($student) {
            return ($course['student_name'] ?? '') === $student['name'];
        });

        $student['courses_count'] = count($studentCourses);
        $student['courses'] = array_values($studentCourses);

        return $student;
    }
}




















