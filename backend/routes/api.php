<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\TrainerController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\LectureController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\CoursePackageController;
use App\Http\Controllers\Api\CustomerServiceController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\TrainerController as ApiTrainerController;
use App\Http\Controllers\Api\LectureController as ApiLectureController;
use App\Http\Controllers\ActivityLogController;
use App\Models\Trainer;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Auth Routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/dev-login', [AuthController::class, 'devLogin']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

// Dashboard Stats
Route::get('/dashboard/stats', [CustomerServiceController::class, 'dashboardStats']);
Route::get('/statistics', [FinanceController::class, 'statistics']);
Route::get('/payments-statistics', [FinanceController::class, 'paymentStatistics']);

// Students
Route::get('/students', [StudentController::class, 'index']);
Route::post('/students', [StudentController::class, 'store']);
Route::get('/students/{student}', [StudentController::class, 'show']);
Route::put('/students/{student}', [StudentController::class, 'update']);
Route::delete('/students/{student}', [StudentController::class, 'destroy']);

// Trainers
Route::get('/trainers', [TrainerController::class, 'index']);
Route::get('/trainers-list', [TrainerController::class, 'list']);
Route::post('/trainers', [TrainerController::class, 'store']);
Route::get('/trainers/{trainer}', [TrainerController::class, 'show']);
Route::put('/trainers/{trainer}', [TrainerController::class, 'update']);
Route::delete('/trainers/{trainer}', [TrainerController::class, 'destroy']);
Route::get('/trainers/{trainer}/available-times', [TrainerController::class, 'availableTimes']);
Route::post('/trainers/available', [TrainerController::class, 'available']);
Route::post('/trainers/available-monthly', [TrainerController::class, 'availableMonthly']);

// Courses - Protected routes (require authentication)

Route::get('/ping', fn () => response()->json(['ok' => true]));


Route::middleware('simple.auth')->group(function () {
Route::get('/courses', [CourseController::class, 'index']);
Route::post('/courses', [CourseController::class, 'store']);
Route::get('/courses/{course}', [CourseController::class, 'show']);
Route::put('/courses/{course}', [CourseController::class, 'update']);
    Route::put('/courses/{course}/status', [CourseController::class, 'updateStatus']);
    Route::put('/courses/{course}/renewal-alert-status', [CourseController::class, 'updateRenewalAlertStatus']);
    Route::post('/courses/{course}/confirm-evaluation', [CourseController::class, 'confirmEvaluationSent']);
Route::delete('/courses/{course}', [CourseController::class, 'destroy']);
Route::put('/courses/{course}/lectures/bulk', [CourseController::class, 'bulkUpdateLectures']);
});

// Lectures - Protected routes (require authentication)
Route::middleware('simple.auth')->group(function () {
    Route::get('/lectures', [LectureController::class, 'index']);
    Route::get('/lectures/{lecture}', [ApiLectureController::class, 'show']);
    Route::put('/lectures/{lecture}', [LectureController::class, 'update']);
    Route::post('/lectures/{lecture}/postpone', [ApiLectureController::class, 'postpone']);
    Route::post('/lectures/{lecture}/cancel-postponement', [ApiLectureController::class, 'cancelPostponement']);
    Route::post('/lectures/{lecture}/check-conflicts', [ApiLectureController::class, 'checkConflicts']);
    Route::get('/lectures/{lecture}/postponement-stats', [ApiLectureController::class, 'postponementStats']);
});

// Payments
Route::get('/payments', [PaymentController::class, 'index']);
Route::post('/payments', [PaymentController::class, 'store']);
Route::get('/payments/{payment}', [PaymentController::class, 'show']);
Route::put('/payments/{payment}', [PaymentController::class, 'update']);
Route::delete('/payments/{payment}', [PaymentController::class, 'destroy']);

// Course Packages
Route::get('/course-packages', [CoursePackageController::class, 'index']);
Route::post('/course-packages', [CoursePackageController::class, 'store']);
Route::put('/course-packages/{id}', [CoursePackageController::class, 'update']);
Route::delete('/course-packages/{id}', [CoursePackageController::class, 'destroy']);

// Trainer Payroll
Route::get('/trainer-payroll', [FinanceController::class, 'trainerPayroll']);
Route::put('/trainer-payroll/bonus-deduction', [FinanceController::class, 'updateBonusDeduction']);
Route::put('/trainer-payroll/bonus-selection', [FinanceController::class, 'updateBonusSelection']);
Route::put('/trainer-payroll/bonus-inclusion', [FinanceController::class, 'updateBonusInclusion']);
Route::put('/trainer-payroll/payment-method', [FinanceController::class, 'updatePaymentMethod']);
Route::post('/trainer-payroll/mark-paid', [FinanceController::class, 'markTrainerPaid']);
Route::put('/trainer-payroll/mark-unpaid', [FinanceController::class, 'markTrainerUnpaid']);

// Find Available Training Times
Route::post('/find-training-time', [CustomerServiceController::class, 'findTrainingTime']);

// Activity Logs
Route::get('/activity-logs', [ActivityLogController::class, 'index']);

// Trainer Dashboard & Unavailability
Route::prefix('trainer')->middleware('simple.auth')->group(function () {
    Route::get('/dashboard', [ApiTrainerController::class, 'dashboard']);
    Route::get('/today-lectures', [ApiTrainerController::class, 'todayLectures']);
    Route::get('/next-week-lectures', [ApiTrainerController::class, 'nextWeekLectures']);
    Route::get('/achievements', [ApiTrainerController::class, 'achievements']);
    Route::get('/unavailability', [ApiTrainerController::class, 'getUnavailability']);
    Route::post('/unavailability', [ApiTrainerController::class, 'saveUnavailability']);
});

// Courses Nearing Completion
Route::get('/courses/nearing-completion', [CourseController::class, 'nearingCompletion']);
