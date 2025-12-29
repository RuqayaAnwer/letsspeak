# Lecture Postponement System Documentation

## Overview

This document describes the lecture postponement system implemented in LetSpeak Training Management System.

## Core Principle

When a lecture is postponed:
1. The **ORIGINAL lecture is NEVER deleted** - only its status is updated
2. A **NEW makeup lecture is created** with the new date/time
3. This preserves the original schedule for history, reporting, and financial calculations

## Files Modified/Created

### Backend

| File | Description |
|------|-------------|
| `app/Models/Lecture.php` | Updated model with constants, relationships, and scopes |
| `app/Services/LecturePostponementService.php` | **NEW** - Core business logic for postponement |
| `app/Http/Controllers/Api/LectureController.php` | **NEW** - API endpoints for postponement |
| `config/courses.php` | **NEW** - Configuration for max postponements |
| `database/migrations/2025_12_11_*_enhance_lectures_for_postponement.php` | **NEW** - Migration for new fields |
| `routes/api.php` | Updated with new lecture routes |

### Frontend

| File | Description |
|------|-------------|
| `src/pages/shared/CourseDetails.jsx` | Updated with enhanced postponement modal |

## API Endpoints

### 1. Postpone a Lecture

```
POST /api/lectures/{id}/postpone
```

**Request Body:**
```json
{
  "new_date": "2024-01-15",        // Required: Y-m-d format
  "new_time": "14:00",             // Optional: H:i format
  "postponed_by": "trainer",       // Required: trainer|student|customer_service|admin
  "reason": "سبب التأجيل",         // Optional: text
  "force": false                   // Optional: override conflicts (privileged only)
}
```

**Success Response (200):**
```json
{
  "success": true,
  "code": "success",
  "message": "تم تأجيل المحاضرة بنجاح وإنشاء محاضرة تعويضية.",
  "data": {
    "original_lecture": { /* Original lecture data */ },
    "new_lecture": { /* New makeup lecture data */ }
  }
}
```

**Error Response (422):**
```json
{
  "success": false,
  "code": "time_conflict",
  "message": "يوجد تعارض في المواعيد. المدرب لديه محاضرة أخرى في نفس الوقت.",
  "data": {
    "conflicts": [
      {
        "type": "trainer",
        "lecture_id": 123,
        "course_title": "Course Name",
        "date": "2024-01-15",
        "time": "14:00",
        "message": "المدرب لديه محاضرة في نفس الوقت للكورس: Course Name"
      }
    ]
  }
}
```

### 2. Get Postponement Statistics

```
GET /api/lectures/{id}/postponement-stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_postponements": 1,
    "makeup_lectures_created": 1,
    "max_allowed": 3,
    "remaining": 2,
    "can_postpone": true
  }
}
```

### 3. Check Time Conflicts

```
POST /api/lectures/{id}/check-conflicts
```

**Request Body:**
```json
{
  "new_date": "2024-01-15",
  "new_time": "14:00"
}
```

## Business Rules

### 1. Lecture Postponement

- Original lecture is marked as `status = 'postponed'`
- Original lecture's date/time is **NOT modified**
- A new lecture is created with:
  - `is_makeup = true`
  - `original_lecture_id` = original lecture's ID
  - `lecture_number` = next available number (appended at end)
  - New date/time as specified

### 2. Maximum Postponements

- Configurable via `config('courses.max_postponements')` (default: 3)
- Can be set via environment variable: `COURSE_MAX_POSTPONEMENTS`
- When limit is reached, postponement is blocked

### 3. Time Conflict Detection

Conflicts are checked for:
- Same trainer having another lecture at the same date+time
- Only active lectures are considered (not cancelled/postponed)

### 4. Role-Based Permissions

| Role | Can Postpone | Can Override Conflicts |
|------|-------------|----------------------|
| Trainer | Own courses only | ❌ No |
| Customer Service | Any course | ✅ Yes (with force=true) |
| Admin | Any course | ✅ Yes (with force=true) |
| Finance | ❌ No | ❌ No |

## Database Schema

### New Columns in `lectures` Table

| Column | Type | Description |
|--------|------|-------------|
| `status` | ENUM | 'planned', 'completed', 'postponed', 'cancelled' |
| `time` | TIME | Lecture time (separate from date) |
| `original_lecture_id` | FK | Links makeup to original lecture |
| `postponed_by` | ENUM | 'trainer', 'student', 'customer_service', 'admin' |
| `postponed_at` | TIMESTAMP | When the postponement occurred |
| `postpone_reason` | TEXT | Reason for postponement |

## Visual Flow

```
User selects "Postponed"
        ↓
Modal opens with:
  - Date picker (new date)
  - Time picker (new time)
  - Postponement type (trainer/student)
  - Reason text area
        ↓
System checks conflicts
        ↓
If conflict exists:
  - Trainer: BLOCKED
  - Customer Service/Admin: Can override with force=true
        ↓
On save:
  1. Original lecture → status='postponed'
  2. New lecture created → is_makeup=true
        ↓
Course lectures refreshed
(New makeup lecture appears in schedule)
```

## Configuration

Add to `.env` file (optional):

```env
COURSE_MAX_POSTPONEMENTS=3
COURSE_POSTPONEMENT_ADVANCE_DAYS=0
COURSE_ALLOW_CONFLICT_OVERRIDE=true
```

## Usage Example

### Frontend (React)

```javascript
// When user clicks "Postpone"
const handlePostponeSave = async () => {
  const response = await api.post(`/lectures/${lectureId}/postpone`, {
    new_date: '2024-01-15',
    new_time: '14:00',
    postponed_by: 'trainer',
    reason: 'المدرب مشغول',
    force: false
  });
  
  if (response.data.success) {
    // Refresh course data
    fetchCourse();
  }
};
```

### Backend (Laravel)

```php
// In a service or controller
$service = new LecturePostponementService();

$result = $service->postpone(
    $lecture,
    '2024-01-15',
    '14:00',
    'trainer',
    'المدرب مشغول',
    $user,
    false
);

if ($result['success']) {
    // $result['data']['original_lecture'] - the postponed lecture
    // $result['data']['new_lecture'] - the new makeup lecture
}
```

## TODOs / Future Enhancements

1. **Email Notifications**: Send notifications when lecture is postponed
2. **Student Conflict Detection**: Check student's other courses for conflicts
3. **Postponement History**: Track all postponements for a lecture
4. **Bulk Postponement**: Allow postponing multiple lectures at once
5. **Calendar Integration**: Sync with external calendars

## Troubleshooting

### Error: "max_postponements_reached"
The course has reached the maximum allowed postponements. Increase the limit in config or contact admin.

### Error: "time_conflict"
The trainer already has a lecture at the selected time. Choose a different time or ask customer service to override.

### Error: "cannot_postpone"
The lecture may already be completed, cancelled, or previously postponed. Only planned lectures can be postponed.






















