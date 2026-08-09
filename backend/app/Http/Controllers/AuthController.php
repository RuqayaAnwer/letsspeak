<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Trainer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    public function devLogin(Request $request)
    {
        $request->validate([
            'role' => 'required|in:admin,customer_service,trainer,accounting,finance',
            'email' => 'nullable|email',
        ]);

        $role = $request->role;
        $email = $request->email;

        if ($role === 'admin' || $role === 'finance' || $role === 'accounting') {
            if (empty($email)) {
                return response()->json(['message' => 'البريد الإلكتروني مطلوب للدخول السريع لهذا القسم'], 400);
            }

            $allowedEmails = ['admin@letspeak.online', 'eng.ruqayaanwar@gmail.com'];
            if (!in_array(strtolower(trim($email)), $allowedEmails)) {
                return response()->json(['message' => 'غير مصرح لك بالدخول السريع لهذه الصلاحية'], 403);
            }

            $user = User::where('email', trim($email))->first();
        } else {
            $user = User::where('role', $role)->first();
        }

        if (!$user) {
            return response()->json(['message' => 'لم يتم العثور على مستخدم لهذا القسم أو البريد الإلكتروني غير مسجل'], 404);
        }

        // Load trainer relation if user is a trainer
        if ($user->role === 'trainer') {
            $user->load('trainer');
        }

        $tokenResult = $user->createToken('dev-token');

        return response()->json([
            'user' => $user,
            'role' => $user->role,
            'token' => $tokenResult->plainTextToken,
        ]);
    }

    /**
     * Login with email and password.
     * المدربون: يدخلون بالإيميل المسجّل لهم في نظام المدربين (خدمة العملاء) ويُوجّهون لصفحتهم.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        // إذا لم يُوجد مستخدم بهذا الإيميل في users، ابحث في جدول المدربين
        // (يحدث عند اختلاف trainers.email عن users.email بسبب عدم المزامنة)
        if (!$user) {
            $trainer = Trainer::where('email', $request->email)
                ->orWhere('username', $request->email)
                ->first();
            if ($trainer?->user_id) {
                $user = User::find($trainer->user_id);
            }
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'بيانات الدخول غير صحيحة',
            ], 401);
        }

        if (($user->status ?? '') !== 'active') {
            return response()->json([
                'message' => 'الحساب غير مفعّل. يرجى التواصل مع الإدارة.',
            ], 403);
        }

        // إذا كان لديه ملف مدرب فدوره دائماً trainer (ونصلح الجدول إن كان خاطئاً)
        $user->load('trainer');
        if ($user->trainer) {
            if ($user->role !== 'trainer') {
                $user->role = 'trainer';
                $user->save();
            }
            $role = 'trainer';
        } else {
            $role = $user->role ?: null;
        }

        $tokenResult = $user->createToken('auth-token');

        return response()->json([
            'user' => $user,
            'role' => $role,
            'token' => $tokenResult->plainTextToken,
        ]);
    }

    /**
     * Get authenticated user
     */
    public function user(Request $request)
    {
        $token = $request->bearerToken();
        
        if (!$token) {
            return response()->json(['message' => 'غير مصرح'], 401);
        }

        // Extract user id from token (format: token-{id}-{timestamp} or dev-token-{id}-{timestamp})
        preg_match('/(?:dev-)?token-(\d+)-/', $token, $matches);
        
        if (empty($matches[1])) {
            return response()->json(['message' => 'رمز غير صالح'], 401);
        }

        $user = User::find($matches[1]);
        
        if (!$user) {
            return response()->json(['message' => 'مستخدم غير موجود'], 401);
        }

        if ($user->role === 'trainer') {
            $user->load('trainer');
        }

        return response()->json($user);
    }

    /**
     * Logout
     */
    public function logout(Request $request)
    {
        return response()->json(['message' => 'تم تسجيل الخروج بنجاح']);
    }

    /**
     * تغيير كلمة مرور المستخدم الحالي (يتطلب تسجيل دخول)
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'غير مصرح'], 401);
        }

        $request->validate([
            'current_password' => 'required|string',
            'new_password'     => 'required|string|min:6|confirmed',
        ], [
            'new_password.min'       => 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.',
            'new_password.confirmed' => 'تأكيد كلمة المرور غير مطابق.',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'كلمة المرور الحالية غير صحيحة'], 422);
        }

        if (Hash::check($request->new_password, $user->password)) {
            return response()->json(['message' => 'كلمة المرور الجديدة يجب أن تختلف عن الحالية'], 422);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json(['message' => 'تم تغيير كلمة المرور بنجاح']);
    }

    /**
     * تحديث الملف الشخصي (الاسم، الصورة، وبشكل إضافي كلمة المرور)
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'غير مصرح'], 401);
        }

        $rules = [
            'name' => 'nullable|string|max:255',
            'avatar' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ];

        // Validate password update if provided
        if ($request->filled('current_password')) {
            $rules['current_password'] = 'required|string';
            $rules['new_password'] = 'required|string|min:6';
        }

        $request->validate($rules);

        // Update password if provided
        if ($request->filled('current_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json(['message' => 'كلمة المرور الحالية غير صحيحة'], 422);
            }
            if (Hash::check($request->new_password, $user->password)) {
                return response()->json(['message' => 'كلمة المرور الجديدة يجب أن تختلف عن الحالية'], 422);
            }
            $user->password = Hash::make($request->new_password);
        }

        // Update name
        if ($request->filled('name')) {
            $user->name = $request->name;
            // إبقاء اسم المدرب محدثاً إن أمكن
            if ($user->trainer) {
                $user->trainer->name = $request->name;
                $user->trainer->save();
            }
        }

        // Update avatar
        if ($request->hasFile('avatar')) {
            // Delete old avatar if exists
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            // Store new avatar
            $path = $request->file('avatar')->store('avatars', 'public');
            $user->avatar = $path;
        }

        $user->save();

        if ($user->role === 'trainer') {
            $user->load('trainer');
        }

        return response()->json([
            'message' => 'تم تحديث الملف الشخصي بنجاح',
            'user' => $user
        ]);
    }

    /**
     * Register a new user
     */
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|in:customer_service,trainer,accounting,finance',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
        ]);

        $tokenResult = $user->createToken('auth-token');

        return response()->json([
            'user' => $user,
            'token' => $tokenResult->plainTextToken,
        ], 201);
    }
}
