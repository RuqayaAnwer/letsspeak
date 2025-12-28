<?php
/**
 * Trainer Repository - Data access for trainers
 */

namespace App\JsonStorage\Repositories;

use App\JsonStorage\JsonRepository;

class TrainerRepository extends JsonRepository
{
    protected string $collection = 'trainers';

    /**
     * Get all trainers
     */
    public function all(): array
    {
        return $this->readAll($this->collection);
    }

    /**
     * Get active trainers only
     */
    public function getActive(): array
    {
        return array_values(array_filter($this->all(), function ($trainer) {
            return ($trainer['status'] ?? 'active') === 'active';
        }));
    }

    /**
     * Find trainer by ID
     */
    public function find(int $id): ?array
    {
        return $this->findById($this->collection, $id);
    }

    /**
     * Find trainer by username (for login)
     */
    public function findByUsername(string $username): ?array
    {
        $trainers = $this->all();
        
        foreach ($trainers as $trainer) {
            if (($trainer['username'] ?? '') === $username) {
                return $trainer;
            }
        }
        
        return null;
    }

    /**
     * Create new trainer
     */
    public function create(array $data): array
    {
        $trainer = [
            'name' => $data['name'],
            'username' => $data['username'],
            'password' => password_hash($data['password'], PASSWORD_DEFAULT),
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'specialty' => $data['specialty'] ?? null,
            'status' => 'active',
            'notes' => $data['notes'] ?? null,
        ];

        return $this->insert($this->collection, $trainer);
    }

    /**
     * Update trainer
     */
    public function updateTrainer(int $id, array $data): ?array
    {
        // Don't allow updating password directly here
        unset($data['password']);
        
        return $this->update($this->collection, $id, $data);
    }

    /**
     * Update trainer password
     */
    public function updatePassword(int $id, string $newPassword): ?array
    {
        return $this->update($this->collection, $id, [
            'password' => password_hash($newPassword, PASSWORD_DEFAULT),
        ]);
    }

    /**
     * Verify trainer credentials
     */
    public function verifyCredentials(string $username, string $password): ?array
    {
        $trainer = $this->findByUsername($username);
        
        if ($trainer && password_verify($password, $trainer['password'])) {
            // Don't return password in response
            unset($trainer['password']);
            return $trainer;
        }
        
        return null;
    }

    /**
     * Archive trainer (soft delete)
     */
    public function archive(int $id): ?array
    {
        return $this->softDelete($this->collection, $id, 'Trainer archived');
    }
}





















