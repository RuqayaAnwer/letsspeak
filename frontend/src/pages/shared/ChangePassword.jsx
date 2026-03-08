import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '../../api/axios';

const ChangePassword = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [success, setSuccess]           = useState(false);
  const [error, setError]               = useState('');

  const getBackPath = () => {
    switch (user?.role) {
      case 'admin':            return '/admin';
      case 'customer_service': return '/customer-service';
      case 'trainer':          return '/trainer';
      case 'finance':          return '/finance';
      default:                 return '/';
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.new_password !== form.new_password_confirmation) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }
    if (form.new_password.length < 6) {
      setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (form.new_password === form.current_password) {
      setError('كلمة المرور الجديدة يجب أن تختلف عن الحالية');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        current_password:          form.current_password,
        new_password:              form.new_password,
        new_password_confirmation: form.new_password_confirmation,
      });
      setSuccess(true);
      setForm({ current_password: '', new_password: '', new_password_confirmation: '' });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.new_password?.[0] || 'حدث خطأ، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">تم تغيير كلمة المرور بنجاح</h2>
        <p className="text-[var(--color-text-secondary)] text-sm">استخدم كلمة المرور الجديدة في المرة القادمة.</p>
        <button onClick={() => navigate(getBackPath())} className="btn-primary px-6 py-2">
          العودة للوحة التحكم
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary-500" />
          تغيير كلمة المرور
        </h1>
        <p className="page-subtitle">أدخل كلمة مرورك الحالية ثم اختر كلمة مرور جديدة</p>
      </div>

      <div className="card p-5 sm:p-6">
        {/* معلومات الحساب */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-[var(--color-text-primary)]">{user?.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* كلمة المرور الحالية */}
          <div>
            <label className="label">كلمة المرور الحالية *</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                name="current_password"
                value={form.current_password}
                onChange={handleChange}
                className="input pr-4 pl-10"
                placeholder="أدخل كلمة مرورك الحالية"
                dir="ltr"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* كلمة المرور الجديدة */}
          <div>
            <label className="label">كلمة المرور الجديدة *</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                className="input pr-4 pl-10"
                placeholder="6 أحرف على الأقل"
                dir="ltr"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.new_password.length > 0 && form.new_password.length < 6 && (
              <p className="text-xs text-amber-500 mt-1">يجب أن تكون 6 أحرف على الأقل ({form.new_password.length}/6)</p>
            )}
          </div>

          {/* تأكيد كلمة المرور الجديدة */}
          <div>
            <label className="label">تأكيد كلمة المرور الجديدة *</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="new_password_confirmation"
                value={form.new_password_confirmation}
                onChange={handleChange}
                className="input pr-4 pl-10"
                placeholder="أعد كتابة كلمة المرور الجديدة"
                dir="ltr"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.new_password_confirmation.length > 0 && form.new_password !== form.new_password_confirmation && (
              <p className="text-xs text-red-500 mt-1">كلمتا المرور غير متطابقتين</p>
            )}
            {form.new_password_confirmation.length > 0 && form.new_password === form.new_password_confirmation && form.new_password.length >= 6 && (
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> متطابقتان
              </p>
            )}
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* أزرار */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(getBackPath())}
              className="btn-secondary flex-1"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || form.new_password !== form.new_password_confirmation || form.new_password.length < 6}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
