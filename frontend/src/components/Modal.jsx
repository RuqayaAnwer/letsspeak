import { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div
          className={`relative w-full ${sizeClasses[size]} bg-[var(--color-bg-primary)] rounded-xl sm:rounded-2xl shadow-2xl transform transition-all animate-slide-up max-h-[95vh] overflow-hidden flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--color-border)] flex-shrink-0">
            <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] truncate pr-2">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text-muted)]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
