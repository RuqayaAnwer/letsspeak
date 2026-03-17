<?php

namespace App\Observers;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;

class GeneralObserver
{
    /**
     * Handle the Model "created" event.
     */
    public function created(Model $model): void
    {
        $this->logAction('create', $model);
    }

    /**
     * Handle the Model "updated" event.
     */
    public function updated(Model $model): void
    {
        if ($model->wasChanged()) {
            $this->logAction('update', $model);
        }
    }

    /**
     * Handle the Model "deleted" event.
     */
    public function deleted(Model $model): void
    {
        $this->logAction('delete', $model);
    }

    /**
     * Log the action to the database
     */
    protected function logAction(string $action, Model $model)
    {
        // Don't log if running in console (migrations, seeders, tinker) to keep logs clean
        if (app()->runningInConsole() && !app()->runningUnitTests()) {
            // Uncomment to debug in tinker:
            // \Log::info("GeneralObserver prevented logging in console for {$action} on " . class_basename($model));
            return;
        }

        $userId = auth()->id() ?? null;
        
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

        $description = $this->generateDescription($action, $model);

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
    protected function generateDescription(string $action, Model $model): string
    {
        $modelName = class_basename($model);
        $modelArName = $this->getArabicModelName($modelName);
        $actionArName = $this->getArabicActionName($action);
        
        // Trying to get a specific identifier for the model, like 'name' or 'id'
        $identifier = $model->name ?? $model->title ?? "#" . $model->id;

        return "تم {$actionArName} {$modelArName} ({$identifier})";
    }

    protected function getArabicModelName(string $modelName): string
    {
        $names = [
            'Course' => 'الكورس',
            'Lecture' => 'المحاضرة',
            'Payment' => 'الدفعة المالية',
            'Student' => 'الطالب',
            'Trainer' => 'المدرب',
            'User' => 'المستخدم',
            'CoursePackage' => 'الباقة',
            'TrainerUnavailability' => 'أوقات عدم تفرغ مدرب',
            'TrainerPayroll' => 'مسير رواتب مدرب'
        ];

        return $names[$modelName] ?? $modelName;
    }

    protected function getArabicActionName(string $action): string
    {
        $actions = [
            'create' => 'إنشاء',
            'update' => 'تعديل',
            'delete' => 'حذف',
        ];

        return $actions[$action] ?? $action;
    }
}
