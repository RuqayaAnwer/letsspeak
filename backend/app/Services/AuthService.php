<?php
/**
 * Auth Service - Authentication and authorization logic
 * Uses MySQL database via Eloquent models
 */

namespace App\Services;

use App\Models\User;
use App\Models\Trainer;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    /**
     * Authenticate user (any role)
     */
    public function authenticate(string $username, string $password): ?array
    {
        // Try system users first (by email)
        $user = User::where('email', $username)
            ->where('status', 'active')
            ->first();
        
        if ($user && Hash::check($password, $user->password)) {
            return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
                'type' => 'user',
                'role' => $user->role,
                'token' => $this->generateToken($user->id, 'user'),
            ];
        }

        // Try trainers (by username)
        $trainer = Trainer::where('username', $username)
            ->where('status', 'active')
            ->first();
        
        if ($trainer && Hash::check($password, $trainer->password)) {
            return [
                'user' => [
                    'id' => $trainer->id,
                    'name' => $trainer->name,
                    'username' => $trainer->username,
                    'email' => $trainer->email,
                    'specialty' => $trainer->specialty,
                ],
                'type' => 'trainer',
                'role' => 'trainer',
                'token' => $this->generateToken($trainer->id, 'trainer'),
            ];
        }

        return null;
    }

    /**
     * Dev login - direct access by role (for development)
     */
    public function devLogin(string $role): ?array
    {
        if ($role === 'trainer') {
            $trainer = Trainer::where('status', 'active')->first();
            
            if ($trainer) {
                return [
                    'user' => [
                        'id' => $trainer->id,
                        'name' => $trainer->name,
                        'username' => $trainer->username,
                        'email' => $trainer->email,
                        'specialty' => $trainer->specialty,
                    ],
                    'type' => 'trainer',
                    'role' => 'trainer',
                    'token' => $this->generateToken($trainer->id, 'trainer'),
                ];
            }
            return null;
        }

        // For customer_service or finance
        $user = User::where('role', $role)
            ->where('status', 'active')
            ->first();
        
        if ($user) {
            return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
                'type' => 'user',
                'role' => $user->role,
                'token' => $this->generateToken($user->id, 'user'),
            ];
        }

        return null;
    }

    /**
     * Validate token and get user
     */
    public function validateToken(string $token): ?array
    {
        // Token format: type-id-timestamp-signature
        $parts = explode('-', $token);
        
        if (count($parts) < 3) {
            return null;
        }

        $type = $parts[0];
        $id = (int) $parts[1];

        if ($type === 'trainer') {
            $trainer = Trainer::find($id);
            if ($trainer && $trainer->status === 'active') {
                return [
                    'user' => [
                        'id' => $trainer->id,
                        'name' => $trainer->name,
                        'username' => $trainer->username,
                        'email' => $trainer->email,
                        'specialty' => $trainer->specialty,
                    ],
                    'type' => 'trainer',
                    'role' => 'trainer',
                ];
            }
        } else {
            $user = User::find($id);
            if ($user && $user->status === 'active') {
                return [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'role' => $user->role,
                    ],
                    'type' => 'user',
                    'role' => $user->role,
                ];
            }
        }

        return null;
    }

    /**
     * Generate simple token
     */
    protected function generateToken(int $userId, string $type): string
    {
        $timestamp = time();
        $signature = substr(md5("{$type}-{$userId}-{$timestamp}-secret"), 0, 16);
        
        return "{$type}-{$userId}-{$timestamp}-{$signature}";
    }

    /**
     * Create a new trainer (admin function)
     */
    public function createTrainer(array $data): Trainer
    {
        $data['password'] = Hash::make($data['password']);
        return Trainer::create($data);
    }

    /**
     * Reset trainer password (admin function)
     */
    public function resetTrainerPassword(int $trainerId, string $newPassword): ?Trainer
    {
        $trainer = Trainer::find($trainerId);
        
        if ($trainer) {
            $trainer->password = Hash::make($newPassword);
            $trainer->save();
            return $trainer;
        }
        
        return null;
    }

    /**
     * Get all trainers (for admin)
     */
    public function getAllTrainers(): array
    {
        return Trainer::where('status', 'active')
            ->select(['id', 'name', 'username', 'email', 'phone', 'specialty', 'status', 'created_at'])
            ->get()
            ->toArray();
    }
}
