<?php
/**
 * User Repository - Data access for system users (Customer Service, Finance)
 */

namespace App\JsonStorage\Repositories;

use App\JsonStorage\JsonRepository;

class UserRepository extends JsonRepository
{
    protected string $collection = 'users';

    /**
     * Get all users
     */
    public function all(): array
    {
        return $this->readAll($this->collection);
    }

    /**
     * Find user by ID
     */
    public function find(int $id): ?array
    {
        return $this->findById($this->collection, $id);
    }

    /**
     * Find user by username
     */
    public function findByUsername(string $username): ?array
    {
        $users = $this->all();
        
        foreach ($users as $user) {
            if (($user['username'] ?? '') === $username) {
                return $user;
            }
        }
        
        return null;
    }

    /**
     * Get users by role
     */
    public function getByRole(string $role): array
    {
        return array_values($this->findWhere($this->collection, ['role' => $role]));
    }

    /**
     * Create new user
     */
    public function create(array $data): array
    {
        $user = [
            'name' => $data['name'],
            'username' => $data['username'],
            'password' => password_hash($data['password'], PASSWORD_DEFAULT),
            'email' => $data['email'] ?? null,
            'role' => $data['role'], // 'customer_service' or 'finance'
            'status' => 'active',
        ];

        return $this->insert($this->collection, $user);
    }

    /**
     * Update user
     */
    public function updateUser(int $id, array $data): ?array
    {
        unset($data['password']); // Don't update password here
        return $this->update($this->collection, $id, $data);
    }

    /**
     * Update password
     */
    public function updatePassword(int $id, string $newPassword): ?array
    {
        return $this->update($this->collection, $id, [
            'password' => password_hash($newPassword, PASSWORD_DEFAULT),
        ]);
    }

    /**
     * Verify credentials
     */
    public function verifyCredentials(string $username, string $password): ?array
    {
        $user = $this->findByUsername($username);
        
        if ($user && password_verify($password, $user['password'])) {
            unset($user['password']);
            return $user;
        }
        
        return null;
    }
}



















