<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Trainer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    /**
     * التحقق من أن المستخدم الحالي هو مدير (admin)
     */
    private function requireAdmin(Request $request): ?JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'غير مصرح — هذه الصفحة للمدير فقط'], 403);
        }
        return null;
    }

    /**
     * إحصائيات لوحة تحكم الإدارة
     */
    public function dashboard(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $stats = [
            'users_count'           => User::where('role', '!=', 'trainer')->count(),
            'customer_service_count'=> User::where('role', 'customer_service')->count(),
            'finance_count'         => User::where('role', 'finance')->count(),
            'trainers_count'        => Trainer::count(),
            'active_users'          => User::where('status', 'active')->where('role', '!=', 'trainer')->count(),
            'inactive_users'        => User::where('status', 'inactive')->where('role', '!=', 'trainer')->count(),
        ];

        return response()->json(['success' => true, 'data' => $stats]);
    }

    /**
     * قائمة جميع مستخدمي النظام (بدون المدربين أو معهم حسب الفلتر)
     */
    public function users(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $query = User::query();

        // فلتر حسب الدور
        if ($request->has('role') && $request->role !== '') {
            $query->where('role', $request->role);
        }

        // بحث بالاسم أو الإيميل
        if ($request->has('search') && $request->search !== '') {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            });
        }

        $users = $query->orderBy('created_at', 'desc')->get()
            ->map(fn($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'role'       => $u->role,
                'status'     => $u->status ?? 'active',
                'avatar'     => $u->avatar,
                'job_title'  => $u->job_title,
                'base_salary'=> $u->base_salary,
                'created_at' => $u->created_at?->format('Y-m-d'),
            ]);

        return response()->json(['success' => true, 'data' => $users]);
    }

    /**
     * إضافة موظف جديد (خدمة عملاء أو مالية)
     */
    public function storeUser(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'role'     => 'required|in:customer_service,finance,admin',
            'job_title'=> 'nullable|string|max:255',
            'base_salary' => 'nullable|numeric|min:0',
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => $request->role,
            'status'   => 'active',
            'job_title'=> $request->job_title,
            'base_salary' => $request->base_salary ?? 0,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة الموظف بنجاح',
            'data'    => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'role'  => $user->role,
                'status'=> $user->status,
                'job_title' => $user->job_title,
                'base_salary' => $user->base_salary,
            ],
        ], 201);
    }

    /**
     * تعديل بيانات موظف
     */
    public function updateUser(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $user = User::findOrFail($id);

        // منع تعديل حساب الـ admin الحالي بالكامل
        if ($user->id === $request->user()->id && $request->has('role')) {
            return response()->json(['success' => false, 'message' => 'لا يمكنك تغيير دور حسابك الخاص'], 422);
        }

        if ($user->role === 'trainer' && $request->has('role') && $request->role !== 'trainer') {
            return response()->json(['success' => false, 'message' => 'لا يمكن تغيير دور المدرب إلى دور آخر'], 422);
        }

        $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => 'sometimes|email|unique:users,email,' . $id,
            'password' => 'sometimes|string|min:6',
            'role'     => 'sometimes|in:customer_service,finance,admin,trainer',
            'status'   => 'sometimes|in:active,inactive',
            'job_title'=> 'nullable|string|max:255',
            'base_salary' => 'nullable|numeric|min:0',
        ]);

        if ($request->has('name'))     $user->name   = $request->name;
        if ($request->has('email'))    $user->email  = $request->email;
        if ($request->has('password') && $request->password) {
            $user->password = Hash::make($request->password);
        }
        if ($request->has('role') && $user->role !== 'trainer') {
            $user->role = $request->role;
        }
        if ($request->has('status')) $user->status = $request->status;
        if ($request->has('job_title')) $user->job_title = $request->job_title;
        if ($request->has('base_salary')) $user->base_salary = $request->base_salary;

        $user->save();

        if ($user->role === 'trainer' && $user->trainer) {
            if ($request->has('name')) $user->trainer->name = $request->name;
            if ($request->has('email')) {
                $user->trainer->email = $request->email;
                $user->trainer->username = $request->email;
            }
            if ($request->has('status')) $user->trainer->status = $request->status;
            if ($request->has('password') && $request->password) {
                $user->trainer->password = Hash::make($request->password);
            }
            $user->trainer->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات الموظف',
            'data'    => [
                'id'     => $user->id,
                'name'   => $user->name,
                'email'  => $user->email,
                'role'   => $user->role,
                'status' => $user->status,
                'job_title' => $user->job_title,
                'base_salary' => $user->base_salary,
            ],
        ]);
    }


    /**
     * إعادة تعيين كلمة مرور موظف (للمدير فقط — عند النسيان أو لأغراض أمنية).
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $user = User::findOrFail($id);

        $request->validate([
            'password' => 'required|string|min:6|confirmed',
        ], [
            'password.min'       => 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
            'password.confirmed' => 'تأكيد كلمة المرور غير مطابق.',
        ]);

        $user->password = Hash::make($request->password);
        $user->save();

        if ($user->role === 'trainer' && $user->trainer) {
            $user->trainer->password = Hash::make($request->password);
            $user->trainer->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تعيين كلمة المرور الجديدة. يرجى إبلاغ الموظف بها بشكل آمن.',
        ]);
    }

    /**
     * تعطيل/تفعيل حساب موظف
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $user = User::findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'لا يمكنك تعطيل حسابك الخاص'], 422);
        }

        $user->status = $user->status === 'active' ? 'inactive' : 'active';
        $user->save();

        if ($user->role === 'trainer' && $user->trainer) {
            $user->trainer->status = $user->status;
            $user->trainer->save();
        }

        return response()->json([
            'success' => true,
            'message' => $user->status === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
            'status'  => $user->status,
        ]);
    }

    /**
     * حذف حساب موظف
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $user = User::findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'لا يمكنك حذف حسابك الخاص'], 422);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الموظف بنجاح',
        ]);
    }
}
