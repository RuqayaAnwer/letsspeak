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

        $users = $query->orderBy('role')->orderBy('name')->get()
            ->map(fn($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'role'       => $u->role,
                'status'     => $u->status ?? 'active',
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
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => $request->role,
            'status'   => 'active',
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

        // المدربون يُدارون من صفحة المدربين فقط
        if ($user->role === 'trainer') {
            return response()->json(['success' => false, 'message' => 'تعديل بيانات المدربين من صفحة المدربين فقط'], 403);
        }

        // منع تعديل حساب الـ admin الحالي بالكامل
        if ($user->id === $request->user()->id && $request->has('role')) {
            return response()->json(['success' => false, 'message' => 'لا يمكنك تغيير دور حسابك الخاص'], 422);
        }

        $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => 'sometimes|email|unique:users,email,' . $id,
            'password' => 'sometimes|string|min:6',
            'role'     => 'sometimes|in:customer_service,finance,admin',
            'status'   => 'sometimes|in:active,inactive',
        ]);

        if ($request->has('name'))     $user->name   = $request->name;
        if ($request->has('email'))    $user->email  = $request->email;
        if ($request->has('password') && $request->password) {
            $user->password = Hash::make($request->password);
        }
        if ($request->has('role'))   $user->role   = $request->role;
        if ($request->has('status')) $user->status = $request->status;

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات الموظف',
            'data'    => [
                'id'     => $user->id,
                'name'   => $user->name,
                'email'  => $user->email,
                'role'   => $user->role,
                'status' => $user->status,
            ],
        ]);
    }

    /**
     * إعادة تعيين كلمة مرور موظف (للمدير فقط — عند النسيان أو لأغراض أمنية).
     * كلمات المرور لا تُخزّن قابلة للعرض؛ يمكن تعيين كلمة جديدة فقط.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $user = User::findOrFail($id);

        if ($user->role === 'trainer') {
            return response()->json(['success' => false, 'message' => 'إعادة تعيين كلمة مرور المدربين من صفحة المدربين'], 403);
        }

        $request->validate([
            'password' => 'required|string|min:6|confirmed',
        ], [
            'password.min'       => 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
            'password.confirmed' => 'تأكيد كلمة المرور غير مطابق.',
        ]);

        $user->password = Hash::make($request->password);
        $user->save();

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

        if ($user->role === 'trainer') {
            return response()->json(['success' => false, 'message' => 'تعطيل المدربين من صفحة المدربين فقط'], 403);
        }
        if ($user->id === $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'لا يمكنك تعطيل حسابك الخاص'], 422);
        }

        $user->status = $user->status === 'active' ? 'inactive' : 'active';
        $user->save();

        return response()->json([
            'success' => true,
            'message' => $user->status === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
            'status'  => $user->status,
        ]);
    }
}
