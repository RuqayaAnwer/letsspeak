<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\StudentNote;
use Illuminate\Http\Request;


use App\Services\StudentAnalyticsService;

class StudentController extends Controller
{
    /**
     * Display a listing of students.
     */
    public function index(Request $request)
    {
        $query = Student::query();

        // Search by name or phone
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->has('all') && $request->all == 'true') {
            $students = $query->latest()->get();
            return response()->json(['data' => $students]);
        }

        $students = $query->withCount('courses')->latest()->paginate(15);

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
            'level' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        $student = Student::create($request->only(['name', 'phone', 'level', 'notes']));

        return response()->json($student, 201);
    }

    /**
     * Display the specified student.
     */
    public function show(Student $student)
    {
        $student->load(['courses.trainer.user', 'courses.lectures', 'payments']);
        
        return response()->json($student);
    }

    /**
     * Update the specified student.
     */
    public function update(Request $request, Student $student)
    {
        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'sometimes|required|string|max:20',
            'level' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        $student->update($request->only(['name', 'phone', 'level', 'notes']));

        return response()->json($student);
    }

    /**
     * Remove the specified student.
     */
    public function destroy(Student $student)
    {
        $student->delete();

        return response()->json(null, 204);
    }

    /**
     * Get student profile history and analytics.
     */
    public function profile(Student $student, \App\Services\StudentAnalyticsService $analyticsService)
    {
        $data = $analyticsService->getStudentProfileData($student);

        return response()->json($data);
    }

    /**
     * Add a note to the student's profile.
     */
    public function addNote(Request $request, Student $student)
    {
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
