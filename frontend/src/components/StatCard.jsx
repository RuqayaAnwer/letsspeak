const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle, trend }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    teal: 'from-teal-500 to-teal-600',
    pink: 'from-pink-500 to-pink-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-2 sm:p-6 hover:shadow-xl transition-shadow max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">{title}</p>
          <p className="text-sm sm:text-3xl font-bold text-gray-800 dark:text-white truncate">{value}</p>
          {subtitle && (
            <p className="text-[9px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 sm:mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span>{trend > 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-8 h-8 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-4 h-4 sm:w-7 sm:h-7 text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
