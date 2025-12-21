import { Inbox } from 'lucide-react';

const EmptyState = ({ 
  title = 'لا توجد بيانات', 
  description = 'لا توجد عناصر للعرض', 
  icon: Icon = Inbox,
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[var(--color-text-muted)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-muted)] text-center max-w-sm mb-4">
        {description}
      </p>
      {action}
    </div>
  );
};

export default EmptyState;
