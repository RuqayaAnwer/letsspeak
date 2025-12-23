<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Course;
use App\Models\Student;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    /**
     * Display a listing of payments.
     */
    public function index(Request $request)
    {
        $query = Payment::with(['course.trainer.user', 'course.coursePackage', 'student']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by student
        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        // Filter by course
        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        // Filter by date range
        if ($request->has('from_date')) {
            $query->whereDate('payment_date', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('payment_date', '<=', $request->to_date);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('student', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
        }

        $payments = $query->latest('payment_date')->paginate(15);

        return response()->json($payments);
    }

    /**
     * Store a newly created payment.
     */
    public function store(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'student_id' => 'required|exists:students,id',
            'amount' => 'required|numeric|min:0',
            'status' => 'required|in:completed,pending',
            'date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        $payment = Payment::create($request->only([
            'course_id', 'student_id', 'amount', 'status', 'date', 'notes'
        ]));

        $payment->load(['course', 'student']);

        return response()->json($payment, 201);
    }

    /**
     * Display the specified payment.
     */
    public function show(Payment $payment)
    {
        $payment->load(['course.trainer.user', 'student']);
        
        return response()->json($payment);
    }

    /**
     * Update the specified payment.
     */
    public function update(Request $request, Payment $payment)
    {
        $request->validate([
            'amount' => 'sometimes|required|numeric|min:0',
            'status' => 'sometimes|required|in:completed,pending,refunded,cancelled',
            'payment_date' => 'sometimes|required|date',
            'date' => 'sometimes|required|date',
            'notes' => 'nullable|string',
            'course_package_id' => 'sometimes|exists:course_packages,id',
        ]);

        // Save old data for logging
        $oldData = $payment->only(['amount', 'status', 'payment_date', 'date', 'notes']);
        
        // Prepare update data
        $updateData = $request->only(['amount', 'status', 'notes']);
        
        // Handle date field (payment_date or date)
        if ($request->has('payment_date')) {
            $updateData['payment_date'] = $request->payment_date;
        } elseif ($request->has('date')) {
            $updateData['payment_date'] = $request->date;
        }

        $payment->update($updateData);

        // Log the modification in ActivityLog
        try {
            $changes = [];
            if (isset($updateData['amount']) && $oldData['amount'] != $updateData['amount']) {
                $changes['amount'] = ['old' => $oldData['amount'], 'new' => $updateData['amount']];
            }
            if (isset($updateData['status']) && $oldData['status'] != $updateData['status']) {
                $changes['status'] = ['old' => $oldData['status'], 'new' => $updateData['status']];
            }
            if (isset($updateData['payment_date']) && $oldData['payment_date'] != $updateData['payment_date']) {
                $changes['payment_date'] = ['old' => $oldData['payment_date'], 'new' => $updateData['payment_date']];
            }
            if (isset($updateData['notes']) && $oldData['notes'] != $updateData['notes']) {
                $changes['notes'] = ['old' => $oldData['notes'] ?? '', 'new' => $updateData['notes'] ?? ''];
            }

            if (!empty($changes)) {
                ActivityLog::create([
                    'user_id' => auth()->id(),
                    'action' => 'payment_updated',
                    'model_type' => 'Payment',
                    'model_id' => $payment->id,
                    'old_values' => array_map(fn($c) => $c['old'], $changes),
                    'new_values' => array_map(fn($c) => $c['new'], $changes),
                    'description' => "تم تعديل الدفعة رقم {$payment->id} للطالب " . ($payment->student->name ?? 'غير معروف'),
                    'ip_address' => $request->ip(),
                ]);
            }
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Log::warning('Failed to log payment update: ' . $e->getMessage());
        }

        $payment->load(['course', 'student']);

        return response()->json($payment);
    }

    /**
     * Remove the specified payment.
     */
    public function destroy(Payment $payment)
    {
        $payment->delete();

        return response()->json(null, 204);
    }

    /**
     * Get payment statistics.
     */
    public function statistics(Request $request)
    {
        $query = Payment::query();

        // Filter by date range
        if ($request->has('from_date')) {
            $query->whereDate('date', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('date', '<=', $request->to_date);
        }

        $stats = [
            'total_amount' => (clone $query)->sum('amount'),
            'paid_amount' => (clone $query)->where('status', 'paid')->sum('amount'),
            'partial_amount' => (clone $query)->where('status', 'partial')->sum('amount'),
            'unpaid_count' => (clone $query)->where('status', 'unpaid')->count(),
            'total_payments' => (clone $query)->count(),
        ];

        // Students with unpaid courses
        $stats['students_with_unpaid'] = Student::whereHas('payments', function ($q) {
            $q->whereIn('status', ['unpaid', 'partial']);
        })->count();

        return response()->json($stats);
    }

    /**
     * Get student payment summary.
     */
    public function studentSummary(Student $student)
    {
        $payments = $student->payments()->with('course')->get();
        
        $summary = [
            'student' => $student,
            'total_paid' => $payments->where('status', 'paid')->sum('amount'),
            'total_partial' => $payments->where('status', 'partial')->sum('amount'),
            'total_unpaid' => $payments->where('status', 'unpaid')->count(),
            'payments' => $payments,
        ];

        return response()->json($summary);
    }
}


