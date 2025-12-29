-- =====================================================
-- LetSpeak Database Schema
-- MySQL Database Design
-- Created: December 2024
-- =====================================================

-- تعطيل فحص المفاتيح الخارجية مؤقتاً
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- 1. جدول المستخدمين (users)
-- =====================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL COMMENT 'اسم المستخدم',
    `email` VARCHAR(255) NOT NULL COMMENT 'البريد الإلكتروني',
    `email_verified_at` TIMESTAMP NULL DEFAULT NULL,
    `password` VARCHAR(255) NOT NULL COMMENT 'كلمة المرور المشفرة',
    `role` ENUM('admin', 'customer_service', 'finance') NOT NULL DEFAULT 'customer_service' COMMENT 'دور المستخدم',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT 'حالة الحساب',
    `remember_token` VARCHAR(100) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `users_email_unique` (`email`),
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول مستخدمي النظام (خدمة العملاء، المالية، المدير)';

-- =====================================================
-- 2. جدول المدربين (trainers)
-- =====================================================
DROP TABLE IF EXISTS `trainers`;
CREATE TABLE `trainers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'ربط بحساب المستخدم (اختياري)',
    `name` VARCHAR(255) NOT NULL COMMENT 'اسم المدرب',
    `username` VARCHAR(100) NOT NULL COMMENT 'اسم المستخدم للدخول',
    `password` VARCHAR(255) NOT NULL COMMENT 'كلمة المرور المشفرة',
    `email` VARCHAR(255) NULL DEFAULT NULL COMMENT 'البريد الإلكتروني',
    `phone` VARCHAR(20) NULL DEFAULT NULL COMMENT 'رقم الهاتف',
    `specialty` VARCHAR(255) NULL DEFAULT NULL COMMENT 'التخصص',
    `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active' COMMENT 'حالة المدرب',
    `notes` TEXT NULL DEFAULT NULL COMMENT 'ملاحظات',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trainers_username_unique` (`username`),
    INDEX `idx_trainers_username` (`username`),
    INDEX `idx_trainers_status` (`status`),
    CONSTRAINT `trainers_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول المدربين';

-- =====================================================
-- 3. جدول الطلاب (students)
-- =====================================================
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL COMMENT 'اسم الطالب',
    `phone` VARCHAR(20) NULL DEFAULT NULL COMMENT 'رقم الهاتف',
    `level` ENUM('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8') NOT NULL DEFAULT 'L1' COMMENT 'مستوى الطالب',
    `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active' COMMENT 'حالة الطالب',
    `notes` TEXT NULL DEFAULT NULL COMMENT 'ملاحظات',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_students_name` (`name`),
    INDEX `idx_students_phone` (`phone`),
    INDEX `idx_students_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول الطلاب';

-- =====================================================
-- 4. جدول أنواع الكورسات (course_types)
-- =====================================================
DROP TABLE IF EXISTS `course_types`;
CREATE TABLE `course_types` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL COMMENT 'اسم النوع (بمزاجي، التوازن، السرعة)',
    `name_en` VARCHAR(100) NULL DEFAULT NULL COMMENT 'الاسم بالإنجليزية',
    `lectures_count` INT UNSIGNED NOT NULL COMMENT 'عدد المحاضرات (8، 12، 20)',
    `default_price` DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'السعر الافتراضي',
    `description` TEXT NULL DEFAULT NULL COMMENT 'وصف النوع',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'هل النوع مفعل؟',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='أنواع الكورسات (بمزاجي=8، التوازن=12، السرعة=20)';

-- =====================================================
-- 5. جدول الكورسات (courses)
-- =====================================================
DROP TABLE IF EXISTS `courses`;
CREATE TABLE `courses` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `trainer_id` BIGINT UNSIGNED NOT NULL COMMENT 'المدرب',
    `course_type_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'نوع الكورس',
    `title` VARCHAR(255) NULL DEFAULT NULL COMMENT 'عنوان الكورس',
    `lectures_count` INT UNSIGNED NOT NULL COMMENT 'عدد المحاضرات',
    `start_date` DATE NOT NULL COMMENT 'تاريخ البدء',
    `lecture_time` TIME NOT NULL COMMENT 'وقت المحاضرة',
    `lecture_days` JSON NOT NULL COMMENT 'أيام المحاضرات ["Sunday","Tuesday","Thursday"]',
    `status` ENUM('active', 'paused', 'finished', 'paid', 'cancelled') NOT NULL DEFAULT 'active' COMMENT 'حالة الكورس',
    `payment_method` VARCHAR(100) NULL DEFAULT NULL COMMENT 'طريقة الدفع',
    `subscription_source` VARCHAR(100) NULL DEFAULT NULL COMMENT 'مصدر الاشتراك',
    `renewed_with_trainer` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'هل جدد مع نفس المدرب؟',
    `amount_updates` VARCHAR(255) NULL DEFAULT NULL COMMENT 'تحديثات المبلغ (خصومات)',
    `total_amount` DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'المبلغ الإجمالي',
    `amount_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT 'المبلغ المدفوع',
    `notes` TEXT NULL DEFAULT NULL COMMENT 'ملاحظات',
    `finished_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'تاريخ الانتهاء',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_courses_trainer` (`trainer_id`),
    INDEX `idx_courses_status` (`status`),
    INDEX `idx_courses_start_date` (`start_date`),
    INDEX `idx_courses_renewed` (`renewed_with_trainer`),
    CONSTRAINT `courses_trainer_id_foreign` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `courses_course_type_id_foreign` FOREIGN KEY (`course_type_id`) REFERENCES `course_types` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول الكورسات';

-- =====================================================
-- 6. جدول ربط الطلاب بالكورسات (course_students)
-- =====================================================
DROP TABLE IF EXISTS `course_students`;
CREATE TABLE `course_students` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `course_id` BIGINT UNSIGNED NOT NULL COMMENT 'الكورس',
    `student_id` BIGINT UNSIGNED NOT NULL COMMENT 'الطالب',
    `is_primary` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'هل هو الطالب الرئيسي؟',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_course_student` (`course_id`, `student_id`),
    INDEX `idx_cs_student` (`student_id`),
    CONSTRAINT `course_students_course_id_foreign` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `course_students_student_id_foreign` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول ربط الطلاب بالكورسات (many-to-many)';

-- =====================================================
-- 7. جدول المحاضرات (lectures)
-- =====================================================
DROP TABLE IF EXISTS `lectures`;
CREATE TABLE `lectures` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `course_id` BIGINT UNSIGNED NOT NULL COMMENT 'الكورس',
    `lecture_number` INT UNSIGNED NOT NULL COMMENT 'رقم المحاضرة',
    `date` DATE NOT NULL COMMENT 'تاريخ المحاضرة',
    `attendance` ENUM('pending', 'present', 'partially', 'absent', 'excused', 'postponed_by_trainer') NOT NULL DEFAULT 'pending' COMMENT 'الحضور',
    `activity` ENUM('engaged', 'normal', 'not_engaged') NULL DEFAULT NULL COMMENT 'مستوى التفاعل',
    `homework` ENUM('yes', 'partial', 'no') NULL DEFAULT NULL COMMENT 'حل الواجب',
    `payment_status` ENUM('unpaid', 'paid', 'partial') NOT NULL DEFAULT 'unpaid' COMMENT 'حالة الدفع',
    `is_makeup` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'هل محاضرة تعويضية؟',
    `makeup_for` INT UNSIGNED NULL DEFAULT NULL COMMENT 'رقم المحاضرة المؤجلة الأصلية',
    `notes` TEXT NULL DEFAULT NULL COMMENT 'ملاحظات',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_course_lecture` (`course_id`, `lecture_number`),
    INDEX `idx_lectures_course` (`course_id`),
    INDEX `idx_lectures_date` (`date`),
    INDEX `idx_lectures_attendance` (`attendance`),
    CONSTRAINT `lectures_course_id_foreign` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول المحاضرات';

-- =====================================================
-- 8. جدول المدفوعات (payments)
-- =====================================================
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `course_id` BIGINT UNSIGNED NOT NULL COMMENT 'الكورس',
    `student_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'الطالب',
    `amount` DECIMAL(12, 2) NOT NULL COMMENT 'المبلغ',
    `payment_method` VARCHAR(100) NULL DEFAULT NULL COMMENT 'طريقة الدفع',
    `status` ENUM('pending', 'completed', 'refunded', 'cancelled') NOT NULL DEFAULT 'completed' COMMENT 'حالة الدفع',
    `payment_date` DATE NOT NULL COMMENT 'تاريخ الدفع',
    `receipt_number` VARCHAR(100) NULL DEFAULT NULL COMMENT 'رقم الإيصال',
    `notes` TEXT NULL DEFAULT NULL COMMENT 'ملاحظات',
    `recorded_by` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'المستخدم الذي سجل الدفعة',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_payments_course` (`course_id`),
    INDEX `idx_payments_student` (`student_id`),
    INDEX `idx_payments_date` (`payment_date`),
    CONSTRAINT `payments_course_id_foreign` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `payments_student_id_foreign` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL,
    CONSTRAINT `payments_recorded_by_foreign` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول المدفوعات';

-- =====================================================
-- 9. جدول رواتب المدربين (trainer_payroll)
-- =====================================================
DROP TABLE IF EXISTS `trainer_payroll`;
CREATE TABLE `trainer_payroll` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `trainer_id` BIGINT UNSIGNED NOT NULL COMMENT 'المدرب',
    `month` TINYINT UNSIGNED NOT NULL COMMENT 'الشهر (1-12)',
    `year` SMALLINT UNSIGNED NOT NULL COMMENT 'السنة',
    `completed_lectures` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'المحاضرات المكتملة',
    `lecture_rate` DECIMAL(10, 2) NOT NULL COMMENT 'سعر المحاضرة (4000)',
    `base_pay` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT 'الراتب الأساسي = محاضرات × سعر',
    `renewals_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'عدد التجديدات',
    `renewal_bonus_rate` DECIMAL(10, 2) NOT NULL COMMENT 'مكافأة التجديد (5000)',
    `renewal_total` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT 'إجمالي مكافآت التجديد',
    `volume_bonus` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT 'مكافأة الكمية (30000/80000)',
    `competition_bonus` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT 'مكافأة المنافسة (20000)',
    `total_pay` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT 'إجمالي الراتب',
    `status` ENUM('draft', 'approved', 'paid') NOT NULL DEFAULT 'draft' COMMENT 'حالة الراتب',
    `paid_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'تاريخ الصرف',
    `notes` TEXT NULL DEFAULT NULL COMMENT 'ملاحظات',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_trainer_month` (`trainer_id`, `month`, `year`),
    INDEX `idx_payroll_period` (`year`, `month`),
    CONSTRAINT `trainer_payroll_trainer_id_foreign` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول رواتب المدربين الشهرية';

-- =====================================================
-- 10. جدول سجل تغييرات حالة الكورس (course_status_history)
-- =====================================================
DROP TABLE IF EXISTS `course_status_history`;
CREATE TABLE `course_status_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `course_id` BIGINT UNSIGNED NOT NULL COMMENT 'الكورس',
    `old_status` VARCHAR(50) NULL DEFAULT NULL COMMENT 'الحالة السابقة',
    `new_status` VARCHAR(50) NOT NULL COMMENT 'الحالة الجديدة',
    `changed_by` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'المستخدم الذي غير الحالة',
    `reason` VARCHAR(255) NULL DEFAULT NULL COMMENT 'سبب التغيير',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_status_history_course` (`course_id`),
    CONSTRAINT `course_status_history_course_id_foreign` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `course_status_history_changed_by_foreign` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='سجل تغييرات حالة الكورسات';

-- =====================================================
-- 11. جدول الإعدادات (settings)
-- =====================================================
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL COMMENT 'مفتاح الإعداد',
    `value` TEXT NOT NULL COMMENT 'قيمة الإعداد',
    `description` VARCHAR(255) NULL DEFAULT NULL COMMENT 'وصف الإعداد',
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `settings_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='جدول إعدادات النظام';

-- =====================================================
-- الإعدادات الافتراضية
-- =====================================================
INSERT INTO `settings` (`key`, `value`, `description`, `updated_at`) VALUES
('lecture_rate', '4000', 'سعر المحاضرة الواحدة بالدينار العراقي', NOW()),
('renewal_bonus', '5000', 'مكافأة التجديد لكل طالب بالدينار العراقي', NOW()),
('volume_bonus_60', '30000', 'مكافأة إكمال 60 محاضرة بالدينار العراقي', NOW()),
('volume_bonus_80', '80000', 'مكافأة إكمال 80 محاضرة بالدينار العراقي (تحل محل مكافأة 60)', NOW()),
('competition_bonus', '20000', 'مكافأة المنافسة لأفضل 3 مدربين بالتجديدات', NOW()),
('max_postponements', '3', 'الحد الأقصى للتأجيلات المسموحة لكل كورس', NOW()),
('completion_alert_percent', '75', 'نسبة الإكمال لعرض تنبيه قرب الانتهاء', NOW());

-- =====================================================
-- أنواع الكورسات الافتراضية
-- =====================================================
INSERT INTO `course_types` (`name`, `name_en`, `lectures_count`, `default_price`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
('بمزاجي', 'Basic', 8, 50000.00, 'كورس أساسي - 8 محاضرات', 1, NOW(), NOW()),
('التوازن', 'Balance', 12, 75000.00, 'كورس متوازن - 12 محاضرة', 1, NOW(), NOW()),
('السرعة', 'Speed', 20, 100000.00, 'كورس مكثف - 20 محاضرة', 1, NOW(), NOW());

-- إعادة تفعيل فحص المفاتيح الخارجية
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- نهاية المخطط
-- =====================================================

/*
=====================================================
ملخص العلاقات (ERD)
=====================================================

users ||--o| trainers : "has profile"
trainers ||--o{ courses : "teaches"
courses ||--o{ course_students : "has"
students ||--o{ course_students : "enrolled in"
course_types ||--o{ courses : "defines"
courses ||--o{ lectures : "contains"
courses ||--o{ payments : "receives"
students ||--o{ payments : "makes"
trainers ||--o{ trainer_payroll : "earns"
courses ||--o{ course_status_history : "tracks"
users ||--o{ payments : "records"
users ||--o{ course_status_history : "changes"

=====================================================
قواعد العمل المدعومة
=====================================================

1. أنواع الكورسات:
   - بمزاجي = 8 محاضرات
   - التوازن = 12 محاضرة
   - السرعة = 20 محاضرة

2. حساب التقدم (COMPUTED - لا يُخزن):
   - نسبة التقدم = (المحاضرات المكتملة / إجمالي المحاضرات) × 100

3. حساب الرواتب:
   - الراتب الأساسي = المحاضرات المكتملة × 4,000 دينار
   - مكافأة التجديد = عدد التجديدات × 5,000 دينار
   - مكافأة الكمية:
     * 60+ محاضرة = 30,000 دينار
     * 80+ محاضرة = 80,000 دينار (تحل محل 30,000)
   - مكافأة المنافسة = 20,000 دينار (أعلى 3 مدربين بالتجديدات)

4. التأجيلات:
   - الحد الأقصى = 3 تأجيلات لكل كورس
   - يتم تتبعها عبر is_makeup و makeup_for في جدول lectures

5. التنبيهات:
   - تنبيه عند 75% من الإكمال
   - تنبيه عند المحاضرة الأخيرة

=====================================================
*/























