import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Upload, Lock, LogOut, CheckCircle, Camera } from 'lucide-react';
import api from '../api/axios';

const UserSettingsModal = ({ isOpen, onClose }) => {
  const { user, logout, login } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.letspeak.online';
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ? `${apiBase}/storage/${user.avatar}` : null);
  const [avatarFile, setAvatarFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('حجم الصورة يجب ألا يتجاوز 2 ميجابايت.');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      if (name && name !== user.name) formData.append('name', name);
      if (avatarFile) formData.append('avatar', avatarFile);
      
      if (currentPassword || newPassword) {
        if (!currentPassword) throw new Error('يرجى إدخال كلمة المرور الحالية.');
        if (!newPassword || newPassword.length < 6) throw new Error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
        formData.append('current_password', currentPassword);
        formData.append('new_password', newPassword);
      }

      // Check if anything to update
      let hasData = false;
      for (let pair of formData.entries()) { hasData = true; break;}
      if (!hasData) {
        setLoading(false);
        onClose();
        return;
      }

      const res = await api.post('/auth/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('تم حفظ التغييرات بنجاح!');
      
      // Update local storage and context manually to avoid full reload
      const updatedUser = res.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      // Hacky way to update context since we don't have an explicit 'updateUser' in AuthContext:
      // In AuthContext login/checkAuth we set user. We could force a reload or just let the caller deal with it.
      // But it's best to refresh the page or rely on AuthContext if provided.
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء حفظ التغييرات.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center font-cairo">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-fade-in flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-700">
        
        {/* Header (Sticky) */}
        <div className="flex-shrink-0 flex justify-between items-center p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="text-2xl">⚙️</span> إعدادات الحساب
          </h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100/80 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/50 flex items-center gap-2">
              <span className="text-lg">⚠️</span> {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-3 rounded-xl text-sm font-medium border border-green-100 dark:border-green-900/50 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Avatar Section */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-gray-700 shadow-xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex justify-center items-center group-hover:opacity-90 transition-opacity">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-white font-bold">{user?.name?.charAt(0)}</span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 p-2 sm:p-2.5 bg-blue-500 text-white rounded-full shadow-lg border-2 border-white dark:border-gray-800 group-hover:scale-110 transition-transform">
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400 text-center">
                اضغط لتغيير الصورة الشخصية
              </p>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 my-4" />

            {/* General Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
                <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> كلمة المرور (اختياري)
                </h4>
                <input
                  type="password"
                  placeholder="كلمة المرور الحالية"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
                {currentPassword && (
                  <input
                    type="password"
                    placeholder="كلمة المرور الجديدة"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:shadow-blue-500/50 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5" /> حفظ التغييرات
                </>
              )}
            </button>
          </form>

        </div>

        {/* Footer (Sticky Logout) */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 font-bold rounded-xl border border-red-100 dark:border-red-800 transition-all flex items-center justify-center gap-2 group shadow-sm hover:shadow-md hover:border-red-200 dark:hover:border-red-700"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> تسجيل الخروج نهائياً
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserSettingsModal;
