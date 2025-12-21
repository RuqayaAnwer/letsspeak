<?php
/**
 * JSON Repository - Core data access layer for JSON file storage
 * This replaces SQL database with JSON files
 * 
 * @author LetSpeak System
 * @version 1.0
 */

namespace App\JsonStorage;

class JsonRepository
{
    protected string $storagePath;
    protected bool $useDummyData;

    public function __construct()
    {
        // Check config for dummy data mode
        $this->useDummyData = config('json_storage.use_dummy_data', true);
        
        // Set storage path based on mode
        $basePath = storage_path('json_data');
        $this->storagePath = $this->useDummyData 
            ? $basePath . '/dummy' 
            : $basePath . '/live';
        
        // Ensure directory exists
        if (!is_dir($this->storagePath)) {
            mkdir($this->storagePath, 0755, true);
        }
    }

    /**
     * Get the full path for a JSON file
     */
    protected function getFilePath(string $filename): string
    {
        return $this->storagePath . '/' . $filename . '.json';
    }

    /**
     * Read all data from a JSON file
     */
    public function readAll(string $collection): array
    {
        $filepath = $this->getFilePath($collection);
        
        if (!file_exists($filepath)) {
            return [];
        }

        $content = file_get_contents($filepath);
        $data = json_decode($content, true);
        
        return is_array($data) ? $data : [];
    }

    /**
     * Write all data to a JSON file
     */
    public function writeAll(string $collection, array $data): bool
    {
        $filepath = $this->getFilePath($collection);
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        return file_put_contents($filepath, $json) !== false;
    }

    /**
     * Find a single record by ID
     */
    public function findById(string $collection, int|string $id): ?array
    {
        $data = $this->readAll($collection);
        
        foreach ($data as $item) {
            if (isset($item['id']) && $item['id'] == $id) {
                return $item;
            }
        }
        
        return null;
    }

    /**
     * Find records matching criteria
     */
    public function findWhere(string $collection, array $criteria): array
    {
        $data = $this->readAll($collection);
        
        return array_filter($data, function ($item) use ($criteria) {
            foreach ($criteria as $key => $value) {
                if (!isset($item[$key]) || $item[$key] != $value) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Insert a new record
     */
    public function insert(string $collection, array $record): array
    {
        $data = $this->readAll($collection);
        
        // Generate new ID
        $maxId = 0;
        foreach ($data as $item) {
            if (isset($item['id']) && $item['id'] > $maxId) {
                $maxId = $item['id'];
            }
        }
        
        $record['id'] = $maxId + 1;
        $record['created_at'] = date('Y-m-d H:i:s');
        $record['updated_at'] = date('Y-m-d H:i:s');
        
        $data[] = $record;
        $this->writeAll($collection, $data);
        
        return $record;
    }

    /**
     * Update a record by ID
     */
    public function update(string $collection, int|string $id, array $updates): ?array
    {
        $data = $this->readAll($collection);
        $updated = null;
        
        foreach ($data as &$item) {
            if (isset($item['id']) && $item['id'] == $id) {
                $item = array_merge($item, $updates);
                $item['updated_at'] = date('Y-m-d H:i:s');
                $updated = $item;
                break;
            }
        }
        
        if ($updated) {
            $this->writeAll($collection, $data);
        }
        
        return $updated;
    }

    /**
     * Soft delete - mark as inactive/archived (for Google Sheets sync)
     * Records are NEVER physically deleted, only marked as inactive
     */
    public function softDelete(string $collection, int|string $id, string $reason = 'stopped in Google Sheets'): ?array
    {
        return $this->update($collection, $id, [
            'status' => 'archived',
            'archived_at' => date('Y-m-d H:i:s'),
            'archive_reason' => $reason,
        ]);
    }

    /**
     * Get next available ID for a collection
     */
    public function getNextId(string $collection): int
    {
        $data = $this->readAll($collection);
        $maxId = 0;
        
        foreach ($data as $item) {
            if (isset($item['id']) && $item['id'] > $maxId) {
                $maxId = $item['id'];
            }
        }
        
        return $maxId + 1;
    }

    /**
     * Check if collection exists
     */
    public function collectionExists(string $collection): bool
    {
        return file_exists($this->getFilePath($collection));
    }

    /**
     * Get storage path info (for debugging)
     */
    public function getStorageInfo(): array
    {
        return [
            'path' => $this->storagePath,
            'using_dummy_data' => $this->useDummyData,
        ];
    }
}


















