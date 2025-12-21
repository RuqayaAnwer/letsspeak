<?php
/**
 * Payment Repository - Data access for payments
 */

namespace App\JsonStorage\Repositories;

use App\JsonStorage\JsonRepository;

class PaymentRepository extends JsonRepository
{
    protected string $collection = 'payments';

    /**
     * Get all payments
     */
    public function all(): array
    {
        return $this->readAll($this->collection);
    }

    /**
     * Find payment by ID
     */
    public function find(int $id): ?array
    {
        return $this->findById($this->collection, $id);
    }

    /**
     * Get payments for a course
     */
    public function getByCourse(int $courseId): array
    {
        return array_values($this->findWhere($this->collection, ['course_id' => $courseId]));
    }

    /**
     * Get payments by trainer for a specific month
     */
    public function getByTrainerMonth(int $trainerId, int $month, int $year): array
    {
        $payments = $this->all();
        
        return array_values(array_filter($payments, function ($payment) use ($trainerId, $month, $year) {
            if (($payment['trainer_id'] ?? null) != $trainerId) {
                return false;
            }
            
            $date = $payment['date'] ?? $payment['created_at'] ?? null;
            if (!$date) {
                return false;
            }
            
            $paymentMonth = (int) date('m', strtotime($date));
            $paymentYear = (int) date('Y', strtotime($date));
            
            return $paymentMonth === $month && $paymentYear === $year;
        }));
    }

    /**
     * Create new payment record
     */
    public function create(array $data): array
    {
        $payment = [
            'course_id' => $data['course_id'],
            'trainer_id' => $data['trainer_id'] ?? null,
            'student_name' => $data['student_name'] ?? '',
            'amount' => $data['amount'],
            'payment_method' => $data['payment_method'] ?? '',
            'status' => $data['status'] ?? 'pending',
            'date' => $data['date'] ?? date('Y-m-d'),
            'notes' => $data['notes'] ?? null,
        ];

        return $this->insert($this->collection, $payment);
    }

    /**
     * Update payment
     */
    public function updatePayment(int $id, array $data): ?array
    {
        return $this->update($this->collection, $id, $data);
    }

    /**
     * Get total paid amount for a course
     */
    public function getTotalPaidForCourse(int $courseId): float
    {
        $payments = $this->getByCourse($courseId);
        
        return array_sum(array_map(function ($payment) {
            return ($payment['status'] ?? '') === 'paid' ? (float) ($payment['amount'] ?? 0) : 0;
        }, $payments));
    }

    /**
     * Get monthly summary for finance
     */
    public function getMonthlySummary(int $month, int $year): array
    {
        $payments = $this->all();
        
        $filtered = array_filter($payments, function ($payment) use ($month, $year) {
            $date = $payment['date'] ?? $payment['created_at'] ?? null;
            if (!$date) {
                return false;
            }
            
            $paymentMonth = (int) date('m', strtotime($date));
            $paymentYear = (int) date('Y', strtotime($date));
            
            return $paymentMonth === $month && $paymentYear === $year;
        });

        $totalAmount = 0;
        $paidAmount = 0;
        $pendingAmount = 0;

        foreach ($filtered as $payment) {
            $amount = (float) ($payment['amount'] ?? 0);
            $totalAmount += $amount;
            
            if (($payment['status'] ?? '') === 'paid') {
                $paidAmount += $amount;
            } else {
                $pendingAmount += $amount;
            }
        }

        return [
            'month' => $month,
            'year' => $year,
            'total_amount' => $totalAmount,
            'paid_amount' => $paidAmount,
            'pending_amount' => $pendingAmount,
            'payment_count' => count($filtered),
        ];
    }
}


















