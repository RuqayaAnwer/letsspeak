import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowRight, ArrowLeft, Clock, User, FileText } from 'lucide-react';
import { formatDateForLogs } from '../../utils/dateFormat';

const ActivityLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/activity-logs');
      if (response.data.success) {
        // Parse old_values and new_values if they are strings
        const parsedLogs = response.data.data.map(log => {
          let oldValues = log.old_values;
          let newValues = log.new_values;
          
          // If old_values is a string, parse it
          if (typeof oldValues === 'string') {
            try {
              oldValues = JSON.parse(oldValues);
            } catch (e) {
              console.error('Error parsing old_values:', e);
              oldValues = null;
            }
          }
          
          // If new_values is a string, parse it
          if (typeof newValues === 'string') {
            try {
              newValues = JSON.parse(newValues);
            } catch (e) {
              console.error('Error parsing new_values:', e);
              newValues = null;
            }
          }
          
          return {
            ...log,
            old_values: oldValues,
            new_values: newValues,
          };
        });
        
        setLogs(parsedLogs);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(logs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const currentLogs = logs.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };


  const getActionColor = (action) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'update':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'delete':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'lecture_update':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'create':
        return 'إنشاء';
      case 'update':
        return 'تعديل';
      case 'delete':
        return 'حذف';
      case 'lecture_update':
        return 'تعديل محاضرة';
      default:
        return action;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-base sm:text-2xl font-bold text-gray-800 dark:text-white pr-2 sm:pr-20">
          سجل التعديلات
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          رجوع
        </button>
      </div>

      {/* Activity Logs List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {currentLogs.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
            <p className="text-xs sm:text-base">لا توجد تعديلات مسجلة</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-2 p-2">
              {currentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 max-w-full overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                        <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getActionColor(
                            log.action
                          )}`}
                        >
                          {getActionLabel(log.action)}
                        </span>
                        {log.model_type && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[60%]">
                            {log.model_type.replace('App\\Models\\', '')} #{log.model_id}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="min-w-0">
                      <p className="text-xs text-gray-800 dark:text-white leading-relaxed break-words">
                        {log.description}
                      </p>
                    </div>
                    
                    {log.old_values && log.new_values && typeof log.old_values === 'object' && typeof log.new_values === 'object' && (
                      <div className="mt-1.5 space-y-1">
                        {Object.keys(log.new_values).map((key) => {
                          const oldValue = log.old_values[key];
                          const newValue = log.new_values[key];
                          const oldValueStr = oldValue !== null && oldValue !== undefined ? String(oldValue) : '';
                          const newValueStr = newValue !== null && newValue !== undefined ? String(newValue) : '';
                          
                          return (
                            <div key={key} className="text-[10px] text-gray-600 dark:text-gray-400 break-words">
                              <span className="font-medium">{key}:</span>{' '}
                              <span className="text-red-500 line-through">
                                {oldValueStr.length > 20 ? oldValueStr.substring(0, 20) + '...' : oldValueStr}
                              </span>{' '}
                              →{' '}
                              <span className="text-green-500">
                                {newValueStr.length > 20 ? newValueStr.substring(0, 20) + '...' : newValueStr}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    <div className="pt-1.5 border-t border-gray-200 dark:border-gray-600 space-y-1">
                      <div className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatDateForLogs(log.created_at)}
                      </div>
                      {log.user && (
                        <div className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-gray-400">
                          <User className="w-3 h-3" />
                          {log.user.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block divide-y divide-gray-200 dark:divide-gray-700">
              {currentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                              log.action
                            )}`}
                          >
                            {getActionLabel(log.action)}
                          </span>
                          {log.model_type && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {log.model_type} #{log.model_id}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800 dark:text-white">
                          {log.description}
                        </p>
                        {log.old_values && log.new_values && typeof log.old_values === 'object' && typeof log.new_values === 'object' && (
                          <div className="mt-2 text-sm">
                            <div className="flex flex-wrap gap-4">
                              {Object.keys(log.new_values).map((key) => {
                                const oldValue = log.old_values[key];
                                const newValue = log.new_values[key];
                                const oldValueStr = oldValue !== null && oldValue !== undefined ? String(oldValue) : '';
                                const newValueStr = newValue !== null && newValue !== undefined ? String(newValue) : '';
                                
                                return (
                                  <div key={key} className="text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">{key}:</span>{' '}
                                    <span className="text-red-500 line-through">
                                      {oldValueStr}
                                    </span>{' '}
                                    →{' '}
                                    <span className="text-green-500">
                                      {newValueStr}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        {formatDateForLogs(log.created_at)}
                      </div>
                      {log.user && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <User className="w-4 h-4" />
                          {log.user.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {logs.length > logsPerPage && (
          <div className="flex items-center justify-between p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                currentPage >= totalPages
                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              التالي
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <span className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400">
              صفحة {currentPage} من {totalPages}
            </span>

            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                currentPage <= 1
                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              السابق
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;

