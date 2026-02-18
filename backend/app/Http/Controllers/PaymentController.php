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
        $query = Payment::with(['course.trainer.user', 'course.coursePackage', 'course.students', 'student']);

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

        $perPage = $request->input('per_page', 15);
        $payments = $query->latest('payment_date')->paginate($perPage);
        
        // Ensure payment_method is included from course if not in payment
        $payments->getCollection()->transform(function ($payment) {
            if (!$payment->payment_method && $payment->course) {
                $payment->payment_method = $payment->course->payment_method;
            }
            return $payment;
        });

        return response()->json($payments);
    }

    /**
     * Store a newly created payment.
     */
    public function store(Request $request)
    {
        // Log incoming request for debugging
        \Log::info('Payment Store Request:', [
            'request_data' => $request->all(),
        ]);

        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'student_id' => 'required|exists:students,id',
            'amount' => 'required|numeric|min:0',
            'status' => 'required|in:completed,pending',
            'payment_date' => 'nullable|date',
            'date' => 'nullable|date',
            'notes' => 'nullable|string',
        ], [
            'course_id.required' => 'يجب تحديد الكورس',
            'course_id.exists' => 'الكورس المحدد غير موجود',
            'student_id.required' => 'يجب تحديد الطالب',
            'student_id.exists' => 'الطالب المحدد غير موجود',
            'amount.required' => 'يجب تحديد المبلغ',
            'amount.numeric' => 'المبلغ يجب أن يكون رقماً',
            'amount.min' => 'المبلغ يجب أن يكون أكبر من أو يساوي صفر',
            'status.required' => 'يجب تحديد حالة الدفعة',
            'status.in' => 'حالة الدفعة غير صالحة',
            'payment_date.date' => 'تاريخ الدفع غير صالح',
            'date.date' => 'التاريخ غير صالح',
        ]);

        // Get course to obtain payment_method
        $course = Course::find($request->course_id);
        
        // Prepare payment data
        $paymentData = [
            'course_id' => $request->course_id,
            'student_id' => $request->student_id,
            'amount' => $request->amount,
            'status' => $request->status,
            'notes' => $request->notes ?? '',
        ];

        // Handle date field (payment_date takes priority, then date)
        if ($request->has('payment_date') && !empty($request->payment_date)) {
            $paymentData['payment_date'] = $request->payment_date;
        } elseif ($request->has('date') && !empty($request->date)) {
            $paymentData['payment_date'] = $request->date;
        } else {
            $paymentData['payment_date'] = date('Y-m-d');
        }
        
        // Add payment_method from request or course
        if ($request->has('payment_method') && !empty($request->payment_method)) {
            $paymentData['payment_method'] = $request->payment_method;
        } elseif ($course && $course->payment_method) {
            $paymentData['payment_method'] = $course->payment_method;
        }

        \Log::info('Payment Store Data:', ['payment_data' => $paymentData]);

        $payment = Payment::create($paymentData);

        $course = Course::find($request->course_id);
        if ($course) {
            $course->recalculateAmountPaid();
        }

        $payment->load(['course', 'student']);

        return response()->json($payment, 201);
    }

    /**
     * Display the specified payment.
     */
    public function show(Payment $payment)
    {
        $payment->load(['course.trainer.user', 'student']);
        
        // Ensure payment_method is included from course if not in payment
        if (!$payment->payment_method && $payment->course) {
            $payment->payment_method = $payment->course->payment_method;
        }
        
        return response()->json($payment);
    }

    /**
     * Update the specified payment.
     */
    public function update(Request $request, Payment $payment)
    {
        // Log incoming request for debugging
        \Log::info('Payment Update Request:', [
            'payment_id' => $payment->id,
            'request_data' => $request->all(),
            'has_payment_date' => $request->has('payment_date'),
            'payment_date_value' => $request->payment_date,
        ]);

        try {
            $request->validate([
                'amount' => 'sometimes|numeric|min:0',
                'status' => 'sometimes|in:completed,pending,refunded,cancelled',
                'payment_date' => 'nullable|date',
                'date' => 'nullable|date',
                'notes' => 'nullable|string|max:1000',
                'course_package_id' => 'sometimes|exists:course_packages,id',
            ], [
                'amount.numeric' => 'المبلغ يجب أن يكون رقماً',
                'amount.min' => 'المبلغ يجب أن يكون أكبر من أو يساوي صفر',
                'payment_date.date' => 'تاريخ الدفع غير صالح',
                'date.date' => 'التاريخ غير صالح',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Payment Update Validation Failed:', [
                'errors' => $e->errors(),
                'request_data' => $request->all(),
            ]);
            throw $e;
        }

        // Save old data for logging
        $oldData = $payment->only(['amount', 'status', 'payment_date', 'date', 'notes']);
        
        // Prepare update data - only include fields that are present and valid
        $updateData = [];
        
        if ($request->has('amount')) {
            $amount = $request->amount;
            // Convert to float if it's a string
            if (is_string($amount)) {
                $amount = (float) $amount;
            }
            if (is_numeric($amount) && $amount >= 0) {
                $updateData['amount'] = $amount;
            }
        }
        
        if ($request->has('status') && $request->status !== null && $request->status !== '') {
            $updateData['status'] = $request->status;
        }
        
        if ($request->has('notes')) {
            $updateData['notes'] = $request->notes ?? '';
        }
        
        // Handle payment_method
        if ($request->has('payment_method') && !empty($request->payment_method)) {
            $updateData['payment_method'] = $request->payment_method;
        } elseif (!$payment->payment_method && $payment->course) {
            // If payment doesn't have payment_method, get it from course
            $updateData['payment_method'] = $payment->course->payment_method;
        }
        
        // Handle date field (payment_date takes priority, then date)
        if ($request->has('payment_date') && !empty($request->payment_date) && $request->payment_date !== 'null') {
            $updateData['payment_date'] = $request->payment_date;
        } elseif ($request->has('date') && !empty($request->date) && $request->date !== 'null') {
            $updateData['payment_date'] = $request->date;
        }
        // Note: If no date is provided, we don't update it (keep existing date)
        
        // Ensure we have at least one field to update
        if (empty($updateData)) {
            return response()->json([
                'message' => 'لا توجد بيانات للتحديث',
                'errors' => []
            ], 422);
        }

        \Log::info('Payment Update Data:', ['update_data' => $updateData]);

        $payment->update($updateData);

        if ($payment->course) {
            $payment->course->recalculateAmountPaid();
        }

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
        
        // Ensure payment_method is included from course if not in payment
        if (!$payment->payment_method && $payment->course) {
            $payment->payment_method = $payment->course->payment_method;
        }

        return response()->json($payment);
    }

    /**
     * Remove the specified payment.
     */
    public function destroy(Payment $payment)
    {
        $course = $payment->course;
        $payment->delete();
        if ($course) {
            $course->recalculateAmountPaid();
        }

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


