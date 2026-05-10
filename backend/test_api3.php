<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $request = Illuminate\Http\Request::create('/api/students/1/notes', 'POST', [
        'note' => 'test note',
        'type' => 'strength'
    ]);
    $user = App\Models\User::find(1);
    $request->setUserResolver(function () use ($user) {
        return $user;
    });
    // also mock auth()->id()
    Auth::login($user);
    
    $controller = new App\Http\Controllers\StudentController();
    $student = App\Models\Student::first();
    $response = $controller->addNote($request, $student);
    echo $response->getContent();
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString();
} catch (\Error $e) {
    echo "Error: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
