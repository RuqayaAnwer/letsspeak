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
    // Mock user
    $user = App\Models\User::first();
    $request->setUserResolver(function () use ($user) {
        return $user;
    });
    
    $controller = new App\Http\Controllers\StudentController();
    $student = App\Models\Student::first();
    
    if (!$student) {
        echo "No student found.";
        exit;
    }
    
    $response = $controller->addNote($request, $student);
    echo $response->getContent();
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString();
} catch (\Error $e) {
    echo "Error: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
