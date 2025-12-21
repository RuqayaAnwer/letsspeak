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
            return response()->json(['message' => 'غير مصرح - لا يوجد رمز'], 401);
        }

        // Extract user id from token
        preg_match('/(?:dev-)?token-(\d+)-/', $token, $matches);
        
        if (empty($matches[1])) {
            return response()->json(['message' => 'رمز غير صالح'], 401);
        }

        $user = User::find($matches[1]);
        
        if (!$user) {
            return response()->json(['message' => 'مستخدم غير موجود'], 401);
        }

        // Set user on request
        $request->setUserResolver(function () use ($user) {
            return $user;
        });

        return $next($request);
    }
}


















