import { Component, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// تشخيص: Error Boundary يسجل أي خطأ في الـ render إلى Console
class DiagnosticErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.group('%c[تشخيص] خطأ أثناء عرض المكوّن — الشاشة السوداء قد تكون بسبب هذا', 'color: #dc2626; font-weight: bold; font-size: 14px;');
    console.error('الخطأ:', error);
    console.error('الرسالة:', error.message);
    console.error('المكوّن الذي توقف:', errorInfo.componentStack);
    console.error('كامل errorInfo:', errorInfo);
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          <p className="font-bold">حدث خطأ في الصفحة. افتح Console (F12) لرؤية التفاصيل.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Components
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy Loaded Pages
const Login = lazy(() => import('./pages/Login'));
const CustomerServiceDashboard = lazy(() => import('./pages/CustomerService/Dashboard'));
const Students = lazy(() => import('./pages/CustomerService/Students'));
const Trainers = lazy(() => import('./pages/CustomerService/Trainers'));
const Pipeline = lazy(() => import('./pages/CustomerService/Pipeline'));
const CreateCourse = lazy(() => import('./pages/CustomerService/CreateCourse'));
const CoursePackages = lazy(() => import('./pages/shared/CoursePackages'));
const FindTrainingTime = lazy(() => import('./pages/CustomerService/FindTrainingTime'));
const TrainerDashboard = lazy(() => import('./pages/Trainer/Dashboard'));
const FinanceDashboard = lazy(() => import('./pages/Accounting/Dashboard'));
const Payments = lazy(() => import('./pages/Accounting/Payments'));
const TrainerPayroll = lazy(() => import('./pages/Accounting/TrainerPayroll'));
const Courses = lazy(() => import('./pages/shared/Courses'));
const CourseDetailsShared = lazy(() => import('./pages/shared/CourseDetails'));
const StudentProfile = lazy(() => import('./pages/shared/StudentProfile'));
const StaffProfile = lazy(() => import('./pages/shared/StaffProfile'));
const ActivityLogs = lazy(() => import('./pages/CustomerService/ActivityLogs'));
const CourseAlerts = lazy(() => import('./pages/CustomerService/CourseAlerts'));
const CourseDetails = lazy(() => import('./pages/CustomerService/CourseDetails'));
const MyTimes = lazy(() => import('./pages/Trainer/MyTimes'));
const Achievements = lazy(() => import('./pages/Trainer/Achievements'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/Admin/Users'));
const ChangePassword = lazy(() => import('./pages/shared/ChangePassword'));

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// App Routes
const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();

  const getDefaultRoute = () => {
    switch (user?.role) {
      case 'admin': return '/admin';
      case 'customer_service': return '/customer-service';
      case 'trainer': return '/trainer';
      case 'finance': return '/finance';
      default: return '/login';
    }
  };

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to={getDefaultRoute()} replace /> : <Login />} 
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/packages"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CoursePackages />
          </ProtectedRoute>
        }
      />

      {/* Customer Service Routes */}
      <Route
        path="/customer-service"
        element={
          <ProtectedRoute allowedRoles={['customer_service']}>
            <CustomerServiceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-service/students"
        element={
          <ProtectedRoute allowedRoles={['customer_service']}>
            <Students />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-service/trainers"
        element={
          <ProtectedRoute allowedRoles={['customer_service']}>
            <Trainers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-service/pipeline"
        element={
          <ProtectedRoute allowedRoles={['customer_service', 'admin']}>
            <Pipeline />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-service/create-course"
        element={
          <ProtectedRoute allowedRoles={['customer_service']}>
            <CreateCourse />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-service/packages"
        element={
          <ProtectedRoute allowedRoles={['customer_service']}>
            <CoursePackages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-service/find-time"
        element={
          <ProtectedRoute allowedRoles={['customer_service']}>
            <FindTrainingTime />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-service/activity-logs"
        element={
          <ProtectedRoute allowedRoles={['customer_service']}>
            <ActivityLogs />
          </ProtectedRoute>
        }
      />
        <Route
          path="/customer-service/alerts"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <CourseAlerts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer-service/course-details"
          element={
            <ProtectedRoute allowedRoles={['customer_service']}>
              <CourseDetails />
            </ProtectedRoute>
          }
        />

      {/* Trainer Routes */}
      <Route
        path="/trainer"
        element={
          <ProtectedRoute allowedRoles={['trainer']}>
            <TrainerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trainer/my-times"
        element={
          <ProtectedRoute allowedRoles={['trainer']}>
            <MyTimes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trainer/achievements"
        element={
          <ProtectedRoute allowedRoles={['trainer']}>
            <Achievements />
          </ProtectedRoute>
        }
      />

      {/* Finance Routes */}
      <Route
        path="/finance"
        element={
          <ProtectedRoute allowedRoles={['finance']}>
            <FinanceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance/payments"
        element={
          <ProtectedRoute allowedRoles={['finance']}>
            <DiagnosticErrorBoundary>
              <Payments />
            </DiagnosticErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance/payroll"
        element={
          <ProtectedRoute allowedRoles={['finance']}>
            <TrainerPayroll />
          </ProtectedRoute>
        }
      />

      {/* Shared Routes */}
      <Route
        path="/courses"
        element={
          <ProtectedRoute allowedRoles={['customer_service', 'trainer', 'finance']}>
            <Courses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/:id"
        element={
          <ProtectedRoute allowedRoles={['customer_service', 'trainer', 'finance']}>
            <CourseDetailsShared />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'customer_service', 'trainer', 'finance']}>
            <StudentProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff-profile/:type/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'customer_service', 'finance']}>
            <StaffProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowedRoles={['admin', 'customer_service', 'trainer', 'finance']}>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Default Redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><LoadingSpinner size="lg" /></div>}>
            <AppRoutes />
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
