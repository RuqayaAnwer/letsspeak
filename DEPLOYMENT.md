# دليل النشر على السيرفر

## رفع التغييرات الحالية (خطوات سريعة)

التعديلات الأخيرة تشمل: **البونص/الخصم على الموبايل** (Frontend) و**إصلاح إيرادات الشهر** (Backend).

### أ) على جهازك — Git ورفع إلى GitHub

```bash
cd C:\Users\MSI\Desktop\letspeak

# إضافة ملفات الكود فقط (بدون .env أو backups)
git add backend/app/Http/Controllers/Api/FinanceController.php backend/config/app.php
git add frontend/src/pages/Accounting/TrainerPayroll.jsx

# commit و push
git commit -m "Fix: bonus/deduction on mobile + monthly revenue timezone (Asia/Baghdad)"
git push origin production-v1
```

### ب) على سيرفر الـ Backend (Ubuntu — api.letspeak.online)

اتصل عبر SSH ثم:

```bash
cd /var/www/letsspeak/backend
# أو المسار الفعلي لمجلد الـ backend على السيرفر

git pull origin production-v1

# تحديث الـ config والـ cache
php artisan config:clear
php artisan config:cache
php artisan optimize
```

(اختياري) في ملف `.env` على السيرفر يمكنك إضافة للتأكد من توقيت العراق:
```env
APP_BUSINESS_TIMEZONE=Asia/Baghdad
```

### ج) الـ Frontend (sys.letspeak.online)

**على جهازك:**

```bash
cd C:\Users\MSI\Desktop\letspeak\frontend
npm install
npm run build
```

**رفع الملفات:** ارفع **محتويات** مجلد `frontend/dist` إلى المجلد الذي يخدم منه الموقع sys.letspeak.online (عبر FileZilla / SFTP أو لوحة Hostinger — استبدال الملفات القديمة بنفس الأسماء).

---

## 1. إعدادات Backend (Laravel)

### على السيرفر، تأكد من ضبط ملف `.env`:

```bash
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.letspeak.online

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password
```

**ملاحظة مهمة**: عندما يكون `APP_ENV=production`، سيتم تعطيل route الـ `/auth/dev-login` تلقائياً.

### تنفيذ الأوامر على السيرفر:

```bash
cd /path/to/backend

# تحديث المكتبات
composer install --optimize-autoloader --no-dev

# إعداد الصلاحيات
chmod -R 755 storage bootstrap/cache

# تنفيذ الـ migrations
php artisan migrate --force

# مسح الـ cache
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan optimize
```

---

## 2. إعدادات Frontend (React)

### Build للإنتاج:

```bash
cd frontend

# تثبيت المكتبات
npm install

# Build
npm run build
```

سيتم إنشاء مجلد `dist` يحتوي على الملفات الجاهزة للنشر.

### رفع الملفات:

- ارفع محتويات مجلد `dist` إلى `https://sys.letspeak.online`

---

## 3. إعدادات Nginx

### ملف `/etc/nginx/sites-available/api.letspeak.online`:

```nginx
server {
    server_name api.letspeak.online;
    root /path/to/backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        # CORS Headers
        add_header 'Access-Control-Allow-Origin' 'https://sys.letspeak.online' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
        
        # Handle OPTIONS preflight requests
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

### اختبار وإعادة تشغيل Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. تسجيل الدخول

### على السيرفر الحقيقي:

- استخدم **تسجيل الدخول العادي** بالبريد الإلكتروني وكلمة المرور
- زر "دخول سريع" لن يظهر في بيئة الإنتاج

### إنشاء حسابات المستخدمين:

يمكنك إنشاء الحسابات عبر:

1. **Laravel Tinker**:
```bash
php artisan tinker

$user = new \App\Models\User();
$user->name = 'اسم المستخدم';
$user->email = 'user@letspeak.online';
$user->password = bcrypt('password123');
$user->role = 'finance'; // أو 'customer_service' أو 'trainer'
$user->status = 'active';
$user->save();
```

2. **أو عبر endpoint التسجيل** (إذا كان متاحاً)

---

## 5. التحقق من النشر

- Frontend: `https://sys.letspeak.online`
- Backend API: `https://api.letspeak.online/api/`
- تسجيل الدخول: يجب أن يعمل بالبريد الإلكتروني وكلمة المرور فقط

---

## ملاحظات مهمة:

✅ **تم تطبيق CORS headers** في Nginx للسماح بالاتصال من sys.letspeak.online إلى api.letspeak.online

✅ **تم تعطيل dev-login** في بيئة الإنتاج (Frontend + Backend)

✅ **كلمات المرور محفوظة بشكل آمن** باستخدام bcrypt

⚠️ **لا تنسَ**: تحديث `APP_KEY` في `.env` إذا لم يكن موجوداً:
```bash
php artisan key:generate
```
