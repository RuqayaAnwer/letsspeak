<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\User;
use Symfony\Component\HttpFoundation\Response;

class SimpleAuth
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        
        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح - لا يوجد رمز',
                'debug' => 'No token provided'
            ], 401);
        }

        // Extract user id from token
        // Token format: token-{id}-{timestamp} or dev-token-{id}-{timestamp}
        preg_match('/(?:dev-)?token-(\d+)-/', $token, $matches);
        
        if (empty($matches[1])) {
            return response()->json([
                'success' => false,
                'message' => 'رمز غير صالح',
                'debug' => 'Token format invalid. Token: ' . substr($token, 0, 50)
            ], 401);
        }

        $userId = $matches[1];
        $user = User::find($userId);
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'مستخدم غير موجود',
                'debug' => 'User ID ' . $userId . ' not found'
            ], 401);
        }

        // Set user on request
        $request->setUserResolver(function () use ($user) {
            return $user;
        });

        return $next($request);
    }
}


















