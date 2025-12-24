# 📋 ملخص نظام JSON Storage

تم تحويل النظام من SQL إلى JSON مع الحفاظ على البنية والوظائف الأصلية.

---

## 📁 الملفات التي تم إنشاؤها/تحديثها

### 1. طبقة تخزين JSON (JSON Storage Layer)

| الملف | الوصف |
|-------|-------|
| `app/JsonStorage/JsonRepository.php` | Repository الأساسي للتعامل مع ملفات JSON |
| `app/JsonStorage/Repositories/UserRepository.php` | Repository للمستخدمين (CS + Finance) |
| `app/JsonStorage/Repositories/TrainerRepository.php` | Repository للمدربين |
| `app/JsonStorage/Repositories/CourseRepository.php` | Repository للكورسات |
| `app/JsonStorage/Repositories/LectureRepository.php` | Repository للمحاضرات |
| `app/JsonStorage/Repositories/PaymentRepository.php` | Repository للمدفوعات |

### 2. طبقة الخدمات (Services Layer)

| الملف | الوصف |
|-------|-------|
| `app/Services/AuthService.php` | خدمة المصادقة لجميع الأدوار |
| `app/Services/CourseService.php` | خدمة إدارة الكورسات والمحاضرات |
| `app/Services/FinanceService.php` | خدمة الحسابات المالية والرواتب |

### 3. وحدات API Controllers

| الملف | الوصف |
|-------|-------|
| `app/Http/Controllers/Api/AuthController.php` | API المصادقة |
| `app/Http/Controllers/Api/TrainerController.php` | API وحدة المدرب |
| `app/Http/Controllers/Api/CustomerServiceController.php` | API وحدة خدمة العملاء |
| `app/Http/Controllers/Api/FinanceController.php` | API وحدة المالية |

### 4. ملفات الإعدادات

| الملف | الوصف |
|-------|-------|
| `config/json_storage.php` | إعدادات نظام JSON |
| `routes/api.php` | مسارات API الجديدة |

### 5. البيانات الوهمية

| الملف | الوصف |
|-------|-------|
| `storage/json_data/dummy/users.json` | مستخدمو النظام |
| `storage/json_data/dummy/trainers.json` | المدربون |
| `storage/json_data/dummy/courses.json` | الكورسات |
| `storage/json_data/dummy/lectures.json` | المحاضرات |
| `storage/json_data/dummy/payments.json` | المدفوعات |

---

## 🔌 مسارات API الجديدة

### المصادقة
```
POST /api/auth/login          - تسجيل الدخول
POST /api/auth/dev-login      - دخول سريع للتطوير
GET  /api/auth/user           - الحصول على المستخدم الحالي
POST /api/auth/logout         - تسجيل الخروج
```

### وحدة المدرب
```
GET  /api/trainer/dashboard              - لوحة التحكم
GET  /api/trainer/courses/active         - الكورسات النشطة
GET  /api/trainer/courses/finished       - الكورسات المنتهية
GET  /api/trainer/courses/paused         - الكورسات الموقوفة
GET  /api/trainer/courses/{id}           - تفاصيل الكورس
PUT  /api/trainer/lectures/{id}          - تحديث المحاضرة
GET  /api/trainer/financial              - الملخص المالي
```

### وحدة خدمة العملاء
```
GET  /api/cs/dashboard                   - لوحة التحكم
GET  /api/cs/trainers                    - قائمة المدربين
GET  /api/cs/trainers/{id}/courses       - كورسات مدرب معين
POST /api/cs/trainers                    - إضافة مدرب
PUT  /api/cs/trainers/{id}/password      - تغيير كلمة مرور مدرب
GET  /api/cs/courses/{status}            - الكورسات حسب الحالة
GET  /api/cs/course/{id}                 - تفاصيل الكورس
PUT  /api/cs/course/{id}                 - تحديث الكورس
PUT  /api/cs/course/{id}/status          - تغيير حالة الكورس
PUT  /api/cs/lectures/{id}               - تحديث المحاضرة
GET  /api/cs/search                      - البحث
GET  /api/cs/reports/quick               - التقارير السريعة
```

### وحدة المالية
```
GET  /api/finance/dashboard              - لوحة التحكم
GET  /api/finance/payroll                - الرواتب الشهرية
GET  /api/finance/payroll/trainer/{id}   - راتب مدرب معين
GET  /api/finance/course/{id}            - البيانات المالية للكورس
PUT  /api/finance/lectures/{id}/payment  - تحديث حالة دفع المحاضرة
POST /api/finance/payments               - إضافة دفعة
PUT  /api/finance/payments/{id}          - تحديث دفعة
GET  /api/finance/years                  - السنوات المتاحة
GET  /api/finance/history                - الأرشيف
```

---

## 💰 حسابات الرواتب

```
المحاضرة الواحدة = 4,000 IQD
مكافأة التجديد = 5,000 IQD لكل تجديد

مكافأة الحجم:
- 60 محاضرة = 30,000 IQD
- 80 محاضرة = 80,000 IQD (تحل محل 30k)

مكافأة المنافسة:
- أفضل 3 مدربين في التجديدات = 20,000 IQD لكل واحد
```

---

## 🔧 كيفية التبديل بين البيانات الوهمية والحقيقية

### 1. في ملف .env

```env
# للتطوير (بيانات وهمية)
JSON_USE_DUMMY_DATA=true

# للإنتاج (بيانات حقيقية)
JSON_USE_DUMMY_DATA=false
```

### 2. موقع الملفات

- بيانات وهمية: `storage/json_data/dummy/`
- بيانات حقيقية: `storage/json_data/live/`

---

## 🔐 بيانات الدخول للاختبار

كلمة المرور لجميع الحسابات: `password`

| الدور | اسم المستخدم |
|-------|--------------|
| خدمة العملاء | cs_admin |
| المالية | finance_admin |
| مدرب | mohammed |
| مدرب | fatima |
| مدرب | ali |

---

## ⚠️ ملاحظات مهمة

### 1. الحذف من Google Sheets
عند حذف صف من Google Sheets، لا يتم حذفه من JSON، بل يتم تغيير الحالة:
```json
{
    "status": "archived",
    "archived_at": "2024-01-01 10:00:00",
    "archive_reason": "stopped in Google Sheets"
}
```

### 2. التأجيلات
- الحد الأقصى للتأجيلات = 3 مرات لكل كورس
- عند اختيار "Excused" أو "Postponed_by_me" يتم إضافة محاضرة تعويضية تلقائياً

### 3. التنبيهات
- تنبيه عند 75% من إكمال الكورس
- تنبيه عند آخر محاضرة

---

## 📝 TODO (للتطوير المستقبلي)

- [ ] إضافة مزامنة مع Google Sheets API
- [ ] إضافة نظام Backup للملفات JSON
- [ ] إضافة Validation أكثر صرامة
- [ ] إضافة Logging للعمليات
- [ ] تحديث الواجهة الأمامية لدعم الـ API الجديد




















