<?php
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $req = Illuminate\Http\Request::create('/api/trainer-payroll/mark-paid', 'POST', [
        'trainer_id' => 1,
        'month' => 4,
        'year' => 2026
    ]);
    $user = App\Models\User::where('role', 'admin')->first();
    Illuminate\Support\Facades\Auth::login($user);
    $req->setUserResolver(function() use ($user) { return $user; });
    $res = app(App\Http\Controllers\Api\FinanceController::class)->markTrainerPaid($req);
    echo $res->getStatusCode() . "\n" . $res->getContent();
} catch (\Exception $e) {
    echo $e->getMessage() . "\n" . $e->getTraceAsString();
}
