<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Dev login - دخول مباشر بدون كلمة مرور للتطوير
     */
    public function devLogin(Request $request)
    {
        $request->validate([
            'role' => 'required|in:customer_service,trainer,accounting',
        ]);

        $user = User::where('role', $request->role)->first();

        if (!$user) {
            return response()->json(['message' => 'لم يتم العثور على مستخدم لهذا القسم'], 404);
        }

        // Load trainer relation if user is a trainer
        if ($user->role === 'trainer') {
            $user->load('trainer');
        }

        return response()->json([
            'user' => $user,
            'token' => 'dev-token-' . $user->id . '-' . time(),
        ]);
    }

    /**
     * Login with email and password
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'بيانات الدخول غير صحيحة',
            ], 401);
        }

        if ($user->role === 'trainer') {
            $user->load('trainer');
        }

        return response()->json([
            'user' => $user,
            'token' => 'token-' . $user->id . '-' . time(),
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
     * Register a new user
     */
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|in:customer_service,trainer,accounting',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
        ]);

        return response()->json([
            'user' => $user,
            'token' => 'token-' . $user->id . '-' . time(),
        ], 201);
    }
}
