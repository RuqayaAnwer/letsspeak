import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import CustomerServiceDashboard from './pages/CustomerService/Dashboard';
import Students from './pages/CustomerService/Students';
import Trainers from './pages/CustomerService/Trainers';
import CreateCourse from './pages/CustomerService/CreateCourse';
import CoursePackages from './pages/CustomerService/CoursePackages';
import FindTrainingTime from './pages/CustomerService/FindTrainingTime';
import TrainerDashboard from './pages/Trainer/Dashboard';
import FinanceDashboard from './pages/Accounting/Dashboard';
import Payments from './pages/Accounting/Payments';
import TrainerPayroll from './pages/Accounting/TrainerPayroll';
import Courses from './pages/shared/Courses';
import CourseDetailsShared from './pages/shared/CourseDetails';
import ActivityLogs from './pages/CustomerService/ActivityLogs';
import CourseAlerts from './pages/CustomerService/CourseAlerts';
import CourseDetails from './pages/CustomerService/CourseDetails';
import MyTimes from './pages/Trainer/MyTimes';
import Achievements from './pages/Trainer/Achievements';

// Components
import Layout from './components/Layout';

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
            <Payments />
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
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
