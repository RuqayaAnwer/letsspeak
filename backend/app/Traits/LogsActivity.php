<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;

trait LogsActivity
{
    /**
     * Boot the trait.
     */
    public static function bootLogsActivity()
    {
        static::created(function (Model $model) {
            self::logAction('create', $model);
        });

        static::updated(function (Model $model) {
            // Only log if attributes actually changed
            if ($model->wasChanged()) {
                self::logAction('update', $model);
            }
        });

        static::deleted(function (Model $model) {
            self::logAction('delete', $model);
        });
    }

    /**
     * Log the action to the database
     */
    protected static function logAction(string $action, Model $model)
    {
        // Don't log if running in console (e.g. migrations, seeders) unless we want to
        if (app()->runningInConsole() && !app()->runningUnitTests()) {
            return;
        }

        $userId = auth()->id() ?? null;
        
        // Ensure we only store changed attributes for updates
        $oldValues = [];
        $newValues = [];
        $changes = [];

        if ($action === 'update') {
            $changedAttributes = $model->getChanges();
            
            // Remove 'updated_at' from changes as it's not meaningful to log
            unset($changedAttributes['updated_at']);
            
            if (empty($changedAttributes)) {
                return; // Nothing meaningful changed
            }

            foreach ($changedAttributes as $key => $newValue) {
                $oldValue = $model->getOriginal($key);
                $oldValues[$key] = $oldValue;
                $newValues[$key] = $newValue;
                
                $changes[$key] = [
                    'old' => $oldValue,
                    'new' => $newValue
                ];
            }
        } elseif ($action === 'create') {
            $newValues = $model->getAttributes();
            unset($newValues['created_at'], $newValues['updated_at']);
        } elseif ($action === 'delete') {
            $oldValues = $model->getAttributes();
        }

        $description = self::generateDescription($action, $model);

        ActivityLog::create([
            'user_id' => $userId,
            'action' => $action,
            'model_type' => class_basename($model),
            'model_id' => $model->id,
            'old_values' => empty($oldValues) ? null : $oldValues,
            'new_values' => empty($newValues) ? null : $newValues,
            'changes' => empty($changes) ? null : json_encode($changes, JSON_UNESCAPED_UNICODE),
            'description' => $description,
            'ip_address' => request()->ip(),
        ]);
    }

    /**
     * Generate a human-readable description for the action
     */
    protected static function generateDescription(string $action, Model $model): string
    {
        $modelName = class_basename($model);
        $modelArName = self::getArabicModelName($modelName);
        $actionArName = self::getArabicActionName($action);
        
        // Trying to get a specific identifier for the model, like 'name' or 'id'
        $identifier = $model->name ?? $model->title ?? "#" . $model->id;

        return "تم {$actionArName} {$modelArName} ({$identifier})";
    }

    protected static function getArabicModelName(string $modelName): string
    {
        $names = [
            'Course' => 'الكورس',
            'Lecture' => 'المحاضرة',
            'Payment' => 'الدفعة المالية',
            'Student' => 'الطالب',
            'Trainer' => 'المدرب',
            'User' => 'المستخدم',
            'CoursePackage' => 'الباقة',
        ];

        return $names[$modelName] ?? $modelName;
    }

    protected static function getArabicActionName(string $action): string
    {
        $actions = [
            'create' => 'إنشاء',
            'update' => 'تعديل',
            'delete' => 'حذف',
        ];

        return $actions[$action] ?? $action;
    }
}
