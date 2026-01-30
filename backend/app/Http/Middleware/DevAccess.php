<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class DevAccess
{
    public function handle(Request $request, Closure $next)
    {
        if (env('DEV_MODE') === true || env('DEV_MODE') === 'true') {

            $token = $request->header('X-DEV-TOKEN');

            if ($token === env('DEV_ACCESS_TOKEN')) {
                return $next($request);
            }

            return response()->json([
                'success' => false,
                'message' => 'Invalid dev token',
            ], 401);
        }

        return $next($request);
    }
}

