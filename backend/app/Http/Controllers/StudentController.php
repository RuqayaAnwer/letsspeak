<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Student;
use App\Models\Course;
use App\Models\Payment;
use App\Models\StudentNote;
use Illuminate\Support\Facades\Log;

class StudentController extends Controller
{
    /**
     * Get all students with their courses count and status.
     */
    public function index()
    {
        $students = Student::withCount('courses')
            ->orderBy('created_at', 'desc')
            ->get();
            
        return response()->json($students);
    }

    /**
     * Store a newly created student.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'level' => 'nullable|string|max:50',
            'status' => 'required|in:active,inactive',
            'notes' => 'nullable|string',
        ]);

        $student = Student::create($request->all());

        return response()->json([
            'message' => 'تم إضافة الطالب بنجاح',
            'student' => $student
        ], 201);
    }

    /**
     * Display the specified student.
     */
    public function show(Student $student)
    {
        return response()->json($student);
    }

    /**
     * Update the specified student.
     */
    public function update(Request $request, Student $student)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'level' => 'nullable|string|max:50',
            'status' => 'required|in:active,inactive',
            'notes' => 'nullable|string',
        ]);

        $student->update($request->all());

        return response()->json([
            'message' => 'تم تحديث بيانات الطالب بنجاح',
            'student' => $student
        ]);
    }

    /**
     * Remove the specified student.
     */
    public function destroy(Student $student)
    {
        $student->delete();

        return response()->json([
            'message' => 'تم حذف الطالب بنجاح'
        ]);
    }

    /**
     * Get student profile including courses and payments.
     */
    public function profile(Student $student, \App\Services\StudentAnalyticsService $analytics)
    {
        $data = $analytics->getStudentProfile($student);
        
        return response()->json($data);
    }

    /**
     * Add a note to the student's profile.
     */
    public function addNote(Request $request, Student $student)
    {
        try {
            $request->validate([
                'note' => 'required|string',
                'type' => 'nullable|string|in:general,strength,weakness,interest',
            ]);

            $note = $student->studentNotes()->create([
                'user_id' => auth()->id(),
                'type' => $request->type ?? 'general',
                'note' => $request->note,
            ]);

            $note->load('user:id,name');

            return response()->json([
                'message' => 'تم إضافة الملاحظة بنجاح',
                'note' => $note
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error adding student note: ' . $e->getMessage(), [
                'student_id' => $student->id,
                'request' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'حدث خطأ أثناء إضافة الملاحظة', 
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete an administrative note.
     */
    public function deleteNote(StudentNote $note)
    {
        $note->delete();
        return response()->json(['success' => true, 'message' => 'Note deleted successfully']);
    }
}
