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
        // Try system users first (by email) - this includes trainers who have a linked User account
        $user = User::where('email', $username)
            ->where('status', 'active')
            ->first();
        
        // If not found by email, try searching by username in Trainer,
        // then find the corresponding User.
        if (!$user) {
            $trainer = Trainer::where('username', $username)
                ->where('status', 'active')
                ->first();
            
            if ($trainer && $trainer->user_id) {
                $user = User::find($trainer->user_id);
            }
        }
        
        if ($user && Hash::check($password, $user->password) && $user->status === 'active') {
            
            // Generate Sanctum token
            $tokenResult = $user->createToken('auth-token');
            
            // Format standard response
            return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    // Load trainer info if role is trainer
                    'trainer' => $user->role === 'trainer' ? $user->trainer : null,
                ],
                'type' => 'user',
                'role' => $user->role,
                'token' => $tokenResult->plainTextToken,
            ];
        }

        return null;
    }

    /**
     * Dev login - direct access by role (for development)
     */
    public function devLogin(string $role): ?array
    {
        $user = null;
        
        if ($role === 'trainer') {
            $trainer = Trainer::where('status', 'active')->first();
            if ($trainer && $trainer->user_id) {
                $user = User::find($trainer->user_id);
            }
        } else {
            // For customer_service or finance
            $user = User::where('role', $role)
                ->where('status', 'active')
                ->first();
        }

        if ($user) {
            $tokenResult = $user->createToken('dev-token');
            return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'trainer' => $user->role === 'trainer' ? $user->trainer : null,
                ],
                'type' => 'user',
                'role' => $user->role,
                'token' => $tokenResult->plainTextToken,
            ];
        }

        return null;
    }

    /**
     * Validate token and get user
     */
    public function validateToken(string $token): ?array
    {
        // Not used anymore since we use auth:sanctum middleware,
        // but kept for backward compatibility if any controller calls it.
        $accessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
        if (!$accessToken) {
            return null;
        }

        $user = $accessToken->tokenable;
        if ($user && $user->status === 'active') {
             return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'trainer' => $user->role === 'trainer' ? $user->trainer : null,
                ],
                'type' => 'user',
                'role' => $user->role,
            ];
        }
        
        return null;
    }

    /**
     * Generate simple token
     */
    protected function generateToken(int $userId, string $type): string
    {
        // No longer used since we use Sanctum
        return '';
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
