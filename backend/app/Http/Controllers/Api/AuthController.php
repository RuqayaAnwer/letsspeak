<?php
/**
 * Auth API Controller
 * Handles authentication for all user types
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    protected AuthService $authService;

    public function __construct()
    {
        $this->authService = new AuthService();
    }

    /**
     * Login with username/email and password (يقبل username أو email)
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);
        $login = $request->input('username') ?? $request->input('email');
        if (empty($login)) {
            return response()->json([
                'success' => false,
                'message' => 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم',
            ], 422);
        }

        $result = $this->authService->authenticate(
            $login,
            $request->input('password')
        );

        if (!$result) {
            return response()->json([
                'success' => false,
                'message' => 'اسم المستخدم أو كلمة المرور غير صحيحة',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'user' => $result['user'],
            'role' => $result['role'],
            'type' => $result['type'],
            'token' => $result['token'],
        ]);
    }

    /**
     * Dev login - quick access by role (for development only)
     */
    public function devLogin(Request $request): JsonResponse
    {
        $request->validate([
            'role' => 'required|in:admin,customer_service,trainer,accounting,finance',
            'email' => 'nullable|email',
        ]);

        $role = $request->role;
        $email = $request->email;

        if ($role === 'admin' || $role === 'finance' || $role === 'accounting') {
            if (empty($email)) {
                return response()->json([
                    'success' => false,
                    'message' => 'البريد الإلكتروني مطلوب للدخول السريع لهذا القسم'
                ], 400);
            }

            $allowedEmails = ['admin@letspeak.online', 'eng.ruqayaanwar@gmail.com'];
            if (!in_array(strtolower(trim($email)), $allowedEmails)) {
                return response()->json([
                    'success' => false,
                    'message' => 'غير مصرح لك بالدخول السريع لهذه الصلاحية'
                ], 403);
            }

            $user = \App\Models\User::where('email', trim($email))->first();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'لم يتم العثور على مستخدم لهذا البريد الإلكتروني'
                ], 404);
            }

            $tokenResult = $user->createToken('dev-token');
            $type = $user->role;
            if ($user->role === 'trainer') {
                $user->load('trainer');
                $type = 'trainer';
            }

            return response()->json([
                'success' => true,
                'user' => $user,
                'role' => $user->role,
                'type' => $type,
                'token' => $tokenResult->plainTextToken,
            ]);
        }

        $result = $this->authService->devLogin($request->input('role'));

        if (!$result) {
            return response()->json([
                'success' => false,
                'message' => 'لا يوجد مستخدم لهذا الدور',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'user' => $result['user'],
            'role' => $result['role'],
            'type' => $result['type'],
            'token' => $result['token'],
        ]);
    }

    /**
     * Get current authenticated user
     */
    public function user(Request $request): JsonResponse
    {
        $token = $request->bearerToken();
        
        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح',
            ], 401);
        }

        $result = $this->authService->validateToken($token);

        if (!$result) {
            return response()->json([
                'success' => false,
                'message' => 'رمز غير صالح',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'user' => $result['user'],
            'role' => $result['role'],
            'type' => $result['type'],
        ]);
    }

    /**
     * Logout (just returns success, token invalidation would be on client side)
     */
    public function logout(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الخروج بنجاح',
        ]);
    }
}
























