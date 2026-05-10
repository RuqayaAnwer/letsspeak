<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Enable CORS for all requests
        $middleware->use([
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        // Disable CSRF for API
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);

        // Register custom middleware
        $middleware->alias([
            'simple.auth' => \App\Http\Middleware\SimpleAuth::class,
            'dev.access'  => \App\Http\Middleware\DevAccess::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, $request) {
            \Log::error('Validation Failed: ' . json_encode($e->errors(), JSON_UNESCAPED_UNICODE));
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        });
    })->create();
