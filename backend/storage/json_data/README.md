# JSON Data Storage

هذا المجلد يحتوي على بيانات JSON للنظام.

## هيكل المجلدات

```
json_data/
├── dummy/          # بيانات وهمية للاختبار
│   ├── users.json
│   ├── trainers.json
│   ├── courses.json
│   ├── lectures.json
│   └── payments.json
├── live/           # بيانات حقيقية من Google Sheets
│   └── .gitkeep
└── README.md
```

## التبديل بين الوضعين

### استخدام البيانات الوهمية (للتطوير)
في ملف `.env`:
```
JSON_USE_DUMMY_DATA=true
```

### استخدام البيانات الحقيقية (للإنتاج)
في ملف `.env`:
```
JSON_USE_DUMMY_DATA=false
```

## هيكل البيانات

### users.json
```json
{
    "id": 1,
    "name": "اسم المستخدم",
    "username": "username",
    "password": "hashed_password",
    "email": "email@example.com",
    "role": "customer_service|finance",
    "status": "active|archived"
}
```

### trainers.json
```json
{
    "id": 1,
    "name": "اسم المدرب",
    "username": "trainer_username",
    "password": "hashed_password",
    "email": "trainer@example.com",
    "phone": "+964...",
    "specialty": "التخصص",
    "status": "active|archived",
    "notes": "ملاحظات"
}
```

### courses.json
```json
{
    "id": 1,
    "timestamp": "2024-01-01 10:00:00",
    "student_name": "اسم الطالب",
    "second_student_name": null,
    "trainer_id": 1,
    "trainer_name": "اسم المدرب",
    "time": "18:00",
    "student_level": "L1-L8",
    "payment_method": "ZainCash|نقد|تحويل بنكي",
    "notes": "ملاحظات",
    "course_start_date": "2024-01-01",
    "days": ["الأحد", "الثلاثاء"],
    "course_status": "Active|Paused|Finished|Paid",
    "course_type": "بمزاجي|التوازن|السرعة",
    "total_lectures": 8,
    "completed_lectures": 5,
    "renewed_with_trainer": true|false,
    "amount_updates": "خصم 10%",
    "amount_paid_now": 50000,
    "subscription_source": "Facebook|Instagram|...",
    "google_sheets_row_id": "row_xxx"
}
```

### lectures.json
```json
{
    "id": 1,
    "course_id": 1,
    "lecture_number": 1,
    "date": "2024-01-01",
    "attendance": "Present|Partially|Absent|Excused|Postponed_by_me|pending",
    "activity": "Engaged|Normal|NotEngaged",
    "homework": "Yes|50%|No",
    "notes": "ملاحظات",
    "payment_status": "paid|unpaid|partial",
    "is_postponed": true|false,
    "postponed_from": null|lecture_number
}
```

### payments.json
```json
{
    "id": 1,
    "course_id": 1,
    "trainer_id": 1,
    "student_name": "اسم الطالب",
    "amount": 50000,
    "payment_method": "ZainCash",
    "status": "paid|pending",
    "date": "2024-01-01",
    "notes": "ملاحظات"
}
```

## المزامنة مع Google Sheets

عند إضافة صف جديد في Google Sheets:
- يتم إنشاء سجل جديد في ملف JSON المناسب

عند حذف صف من Google Sheets:
- **لا يتم حذف** السجل من JSON
- يتم تغيير الحالة إلى `"status": "archived"`
- يتم إضافة ملاحظة `"archive_reason": "stopped in Google Sheets"`

## كلمات المرور للاختبار

جميع الحسابات في البيانات الوهمية تستخدم كلمة المرور: `password`

### حسابات الدخول:
| الدور | اسم المستخدم | كلمة المرور |
|-------|--------------|-------------|
| خدمة العملاء | cs_admin | password |
| المالية | finance_admin | password |
| المدرب | mohammed | password |
| المدرب | fatima | password |
| المدرب | ali | password |























