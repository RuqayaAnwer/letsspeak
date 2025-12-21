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
        setLogs(response.data.data);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white pr-20">
          سجل التعديلات
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          رجوع
        </button>
      </div>

      {/* Activity Logs List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {currentLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد تعديلات مسجلة</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
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
                      {log.old_values && log.new_values && (
                        <div className="mt-2 text-sm">
                          <div className="flex gap-4">
                            {Object.keys(log.new_values).map((key) => (
                              <div key={key} className="text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{key}:</span>{' '}
                                <span className="text-red-500 line-through">
                                  {log.old_values[key]}
                                </span>{' '}
                                →{' '}
                                <span className="text-green-500">
                                  {log.new_values[key]}
                                </span>
                              </div>
                            ))}
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
        )}

        {/* Pagination */}
        {logs.length > logsPerPage && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage >= totalPages
                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              التالي
              <ArrowLeft className="w-4 h-4" />
            </button>

            <span className="text-gray-600 dark:text-gray-400">
              صفحة {currentPage} من {totalPages}
            </span>

            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage <= 1
                  ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              السابق
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;

