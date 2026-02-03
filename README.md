# LetSpeak - Training Management System

A comprehensive web system for managing training courses, featuring three user roles: Customer Service, Trainer, and Accounting.

## 🚀 Tech Stack

### Backend
- **Laravel 12** - PHP Framework
- **MySQL** - Database
- **Laravel Sanctum** - API Authentication

### Frontend
- **React 18** - UI Library
- **Vite** - Build Tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP Client
- **Lucide React** - Icons

## 📋 Features

### 🔵 User Roles

1. **Customer Service**
   - Manage students (CRUD)
   - Manage trainers (CRUD)
   - Create and manage courses
   - Manage course packages
   - View all data

2. **Trainer**
   - View assigned courses only
   - Update lecture details (attendance, activity, homework, notes)
   - Track student progress

3. **Accounting**
   - View all courses and students
   - Manage payments
   - Update payment status
   - Generate financial reports

### 🎨 UI Features
- Light/Dark mode toggle
- Responsive design
- Modern, clean interface
- Animated transitions

## 🗄 Database Schema

- **users** - User accounts with roles
- **students** - Student information
- **trainers** - Trainer profiles linked to users
- **course_packages** - Predefined course packages
- **courses** - Course instances
- **lectures** - Individual lecture sessions
- **payments** - Payment records

## 🛠 Installation

### Prerequisites
- PHP 8.2+
- Composer
- Node.js 18+
- MySQL

### Backend Setup

```bash
cd backend

# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure database in .env
# DB_DATABASE=letspeak
# DB_USERNAME=root
# DB_PASSWORD=

# Run migrations
php artisan migrate

# Seed the database
php artisan db:seed

# Install Sanctum
php artisan install:api

# Start the server
php artisan serve
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔐 Demo Accounts

After seeding, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Customer Service | cs@letspeak.com | password |
| Trainer | trainer1@letspeak.com | password |
| Trainer | trainer2@letspeak.com | password |
| Accounting | accounting@letspeak.com | password |

## 📡 API Endpoints

### Authentication
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/user` - Get current user

### Students
- `GET /api/students` - List students
- `POST /api/students` - Create student
- `GET /api/students/{id}` - Get student
- `PUT /api/students/{id}` - Update student
- `DELETE /api/students/{id}` - Delete student

### Trainers
- `GET /api/trainers` - List trainers
- `POST /api/trainers` - Create trainer
- `GET /api/trainers/{id}` - Get trainer
- `PUT /api/trainers/{id}` - Update trainer
- `DELETE /api/trainers/{id}` - Delete trainer

### Course Packages
- `GET /api/course-packages` - List packages
- `POST /api/course-packages` - Create package
- `PUT /api/course-packages/{id}` - Update package
- `DELETE /api/course-packages/{id}` - Delete package

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course
- `GET /api/courses/{id}` - Get course
- `PUT /api/courses/{id}` - Update course
- `DELETE /api/courses/{id}` - Delete course

### Lectures
- `GET /api/courses/{id}/lectures` - List lectures
- `PUT /api/lectures/{id}` - Update lecture
- `PUT /api/courses/{id}/lectures/bulk` - Bulk update

### Payments
- `GET /api/payments` - List payments
- `POST /api/payments` - Create payment
- `PUT /api/payments/{id}` - Update payment
- `GET /api/payments-statistics` - Get statistics

## 📁 Project Structure

```
letspeak/
├── backend/                 # Laravel Backend
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   └── Middleware/
│   │   └── Models/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/
│       └── api.php
│
├── frontend/                # React Frontend
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   │       ├── CustomerService/
│   │       ├── Trainer/
│   │       ├── Accounting/
│   │       └── shared/
│   └── index.html
│
└── README.md
```

## 🔧 Configuration

### Backend (.env)
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=letspeak
DB_USERNAME=root
DB_PASSWORD=

SANCTUM_STATEFUL_DOMAINS=localhost:5173
```

### CORS (config/cors.php)
Already configured to allow requests from `localhost:5173`

## 📱 Screenshots

The system features:
- Clean, modern dashboard interfaces
- Responsive tables with inline editing
- Modal forms for CRUD operations
- Status badges and progress indicators
- Light and dark theme support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is open-sourced software.
























