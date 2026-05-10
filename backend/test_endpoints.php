<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

try {
    $request = Illuminate\Http\Request::create('/api/students?page=1', 'GET');
    $user = App\Models\User::first();
    $request->setUserResolver(function () use ($user) { return $user; });
    Auth::login($user);
    
    $response = $kernel->handle($request);
    echo "Index Status: " . $response->getStatusCode() . "\n";
    $content = json_decode($response->getContent(), true);
    if (isset($content['data']) && is_array($content['data'])) {
        echo "Found " . count($content['data']) . " students on first page.\n";
    } else {
        echo "Failed to get students array.\n";
        echo mb_substr($response->getContent(), 0, 200) . "\n";
    }

    $student = App\Models\Student::first();
    if ($student) {
        $request2 = Illuminate\Http\Request::create('/api/students/' . $student->id . '/profile', 'GET');
        $request2->setUserResolver(function () use ($user) { return $user; });
        Auth::login($user);
        $response2 = $kernel->handle($request2);
        echo "Profile Status: " . $response2->getStatusCode() . "\n";
        
        $request3 = Illuminate\Http\Request::create('/api/students/' . $student->id . '/notes', 'POST', [
            'note' => 'test assessment from cli',
            'type' => 'interest'
        ]);
        $request3->setUserResolver(function () use ($user) { return $user; });
        Auth::login($user);
        $response3 = $kernel->handle($request3);
        echo "AddNote Status: " . $response3->getStatusCode() . "\n";
    }
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n";
}
