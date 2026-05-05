import React, { useState, useEffect } from 'react';
import { X, Plus, Sparkles, Brain, Target, MessageSquare, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const NOTE_TYPES = {
  general: { label: 'عامة', icon: MessageSquare, color: 'gray' },
  strength: { label: 'نقاط القوة', icon: Sparkles, color: 'green' },
  weakness: { label: 'مجالات التحسين', icon: Target, color: 'orange' },
  interest: { label: 'الاهتمامات', icon: Brain, color: 'blue' }
};

const StudentAssessmentModal = ({ isOpen, onClose, studentId, studentName }) => {
  const { user: currentUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Form State
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('strength');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchNotes();
      setShowForm(false);
      setNewNote('');
    }
  }, [isOpen, studentId]);

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      // We can fetch student profile which includes notes
      const response = await api.get(`/students/${studentId}/profile`);
      if (response.data && response.data.notes) {
        setNotes(response.data.notes);
      }
    } catch (err) {
      console.error('Error fetching student notes:', err);
      setError('تعذر تحميل السجل التقييمي للطالب');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmitting(true);
    try {
      const response = await api.post(`/students/${studentId}/notes`, {
        note: newNote,
        type: noteType
      });
      
      // Prepend new note to the list
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const addedNote = {
        id: response.data.note?.id || Date.now(),
        text: newNote,
        type: noteType,
        created_at: formattedDate,
        user: currentUser?.name || 'أنا'
      };
      
      setNotes([addedNote, ...notes]);
      setNewNote('');
      setShowForm(false);
    } catch (err) {
      console.error('Error adding note:', err);
      alert('فشل في إضافة الملاحظة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الملاحظة؟')) return;
    try {
      await api.delete(`/students/notes/${noteId}`);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('فشل في حذف الملاحظة');
    }
  };

  if (!isOpen) return null;

  const filteredNotes = activeTab === 'all' 
    ? notes 
    : notes.filter(n => (n.type || 'general') === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-700">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-l from-blue-50 to-transparent dark:from-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">السجل التقييمي</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">المتدرب: <span className="font-semibold text-gray-700 dark:text-gray-300">{studentName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors dark:hover:text-gray-300 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-gray-50 dark:bg-gray-900">
          
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <LoadingSpinner size="md" />
              <p className="mt-4 text-sm text-gray-500">جاري تحميل السجل...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-center text-sm">{error}</div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                
                {/* Tabs */}
                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto scroller">
                  <button 
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${activeTab === 'all' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    الكل ({notes.length})
                  </button>
                  {Object.entries(NOTE_TYPES).map(([key, type]) => {
                    const count = notes.filter(n => (n.type || 'general') === key).length;
                    return (
                      <button 
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                          activeTab === key 
                            ? `bg-${type.color}-100 dark:bg-${type.color}-900/30 text-${type.color}-700 dark:text-${type.color}-400 shadow-sm` 
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        <type.icon className="w-3.5 h-3.5" />
                        {type.label} ({count})
                      </button>
                    )
                  })}
                </div>

                {/* Add Button */}
                {!showForm && (
                  <button 
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> إضافة تقييم
                  </button>
                )}
              </div>

              {/* Add Form */}
              {showForm && (
                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-primary-200 dark:border-primary-800 shadow-sm animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1 h-full bg-primary-500"></div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">تقييم جديد</h3>
                    <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">نوع التقييم</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(NOTE_TYPES).map(([key, type]) => (
                          <label 
                            key={key}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              noteType === key 
                                ? `border-${type.color}-500 bg-${type.color}-50 dark:bg-${type.color}-900/20` 
                                : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <input 
                              type="radio" 
                              name="noteType" 
                              value={key} 
                              checked={noteType === key} 
                              onChange={() => setNoteType(key)}
                              className="sr-only"
                            />
                            <type.icon className={`w-5 h-5 mb-1 ${noteType === key ? `text-${type.color}-600 dark:text-${type.color}-400` : 'text-gray-400'}`} />
                            <span className={`text-[10px] font-bold ${noteType === key ? `text-${type.color}-700 dark:text-${type.color}-400` : 'text-gray-500'}`}>
                              {type.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <textarea
                        required
                        placeholder="اكتب ملاحظاتك هنا (مثال: يتميز في الاستماع، يحتاج للتركيز على القواعد...)"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      ></textarea>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="submit" 
                        disabled={submitting || !newNote.trim()}
                        className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {submitting ? <LoadingSpinner size="sm" /> : 'حفظ التقييم'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Notes List */}
              <div className="space-y-3">
                {filteredNotes.length === 0 ? (
                  <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">لا توجد تقييمات مسجلة في هذا القسم</p>
                  </div>
                ) : (
                  filteredNotes.map(note => {
                    const typeConfig = NOTE_TYPES[note.type] || NOTE_TYPES.general;
                    const Icon = typeConfig.icon;
                    return (
                      <div key={note.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-4 transition-all hover:shadow-md">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-${typeConfig.color}-100 dark:bg-${typeConfig.color}-900/30 text-${typeConfig.color}-600 dark:text-${typeConfig.color}-400`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className={`text-xs font-bold text-${typeConfig.color}-700 dark:text-${typeConfig.color}-400 mb-0.5`}>
                                {typeConfig.label}
                              </p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                بواسطة: <span className="font-semibold text-gray-700 dark:text-gray-300">{note.user}</span> • {note.created_at}
                              </p>
                            </div>
                            {(currentUser?.role === 'admin' || currentUser?.name === note.user) && (
                              <button 
                                onClick={() => handleDelete(note.id)}
                                className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 mt-2 leading-relaxed whitespace-pre-wrap">
                            {note.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAssessmentModal;
