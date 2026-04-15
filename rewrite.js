const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/shared/StudentProfile.jsx', 'utf8');

code = code.replace(
  'AlertCircle, CreditCard, ChevronDown, ChevronUp, RefreshCw',
  'AlertCircle, CreditCard, ChevronDown, ChevronUp, RefreshCw, FileText, Plus'
);

code = code.replace(
  'const [submittingPayment, setSubmittingPayment] = useState(false);',
  \const [submittingPayment, setSubmittingPayment] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  
  const getTimelineEvents = () => {
    if (!profileData) return [];
    
    let events = [];
    
    if (profileData.courses_history) {
      profileData.courses_history.forEach(course => {
        events.push({
          id: 'course_' + course.id,
          type: 'course',
          date: course.start_date || '2000-01-01',
          data: course
        });
      });
    }
    
    if (profileData.all_payments) {
      profileData.all_payments.forEach(payment => {
        const relatedCourse = profileData.courses_history?.find(c => c.id === payment.course_id);
        events.push({
          id: 'payment_' + payment.id,
          type: 'payment',
          date: payment.date || '2000-01-01',
          data: { ...payment, course_title: relatedCourse?.title || '??? ????' }
        });
      });
    }
    
    if (profileData.notes) {
      profileData.notes.forEach(note => {
        events.push({
          id: 'note_' + note.id,
          type: 'note',
          date: note.created_at.split(' ')[0],
          full_date: note.created_at,
          data: note
        });
      });
    }
    
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  };
  
  const timelineEvents = getTimelineEvents();
  \
);

code = code.replace(
  '// Render Activity Ring',
  \const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    setSubmittingNote(true);
    try {
      await api.post('/students/'+studentId+'/notes', { note: newNote });
      await fetchProfileData();
      setNoteModal(false);
      setNewNote('');
    } catch (err) {
      console.error('Error adding note:', err);
      alert('??? ????? ????????');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Render Activity Ring\
);

code = code.replace(
  '<X className="w-5 h-5 text-white" />\\n          </button>',
  \<X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute top-6 left-16 sm:left-20 flex gap-2">
           <button 
            onClick={() => setNoteModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-lg text-sm font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> ????? ??????
          </button>\
);

const timelineStart = code.indexOf('{/* Course History Timeline */}');
const timelineEnd = code.indexOf('</div>\\n\\n            </div>\\n          )}\\n        </div>');

const newTimelineCode = \{/* Unified Timeline Feed */}
              <div>
                <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary-500" />
                    ????? ?????? ???????
                  </h3>
                  <button 
                    onClick={() => setNoteModal(true)}
                    className="text-xs flex items-center gap-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-2.5 py-1 rounded-md font-semibold transition-colors"
                  >
                    <Plus className="w-3 h-3" /> ????? ??????
                  </button>
                </div>
                
                {timelineEvents.length === 0 ? (
                  <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500">?? ???? ??? ????? ???? ?????? ??? ????.</p>
                  </div>
                ) : (
                  <div className="relative border-r-2 border-gray-100 dark:border-gray-700 space-y-6 pr-6 mr-3">
                    {timelineEvents.map((event) => {
                      
                      // NOTE ITEM
                      if (event.type === 'note') {
                        return (
                          <div key={event.id} className="relative">
                            <div className="absolute -right-9 mt-1.5 w-6 h-6 rounded-full bg-yellow-100 border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm">
                              <FileText className="w-3 h-3 text-yellow-600" />
                            </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-100 dark:border-yellow-900/50 relative">
                              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{event.data.text}</p>
                              <div className="mt-2 flex items-center gap-3 text-xs text-yellow-600 dark:text-yellow-500/80 font-medium">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" /> ??????: {event.data.user}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {event.full_date || event.date}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // PAYMENT ITEM
                      if (event.type === 'payment') {
                        return (
                          <div key={event.id} className="relative">
                            <div className="absolute -right-9 mt-1.5 w-6 h-6 rounded-full bg-emerald-100 border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm">
                              <CreditCard className="w-3 h-3 text-emerald-600" />
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                                    ????? ???? ?????
                                    <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-xs">{formatCurrency(event.data.amount)}</span>
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-1">????: {event.data.course_title}</p>
                                </div>
                                <div className="text-right">
                                  {getPaymentMethodBadge(event.data.payment_method)}
                                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 justify-end">
                                    <Calendar className="w-3 h-3" /> {event.date}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // COURSE ITEM
                      const course = event.data;
                      return (
                        <div key={event.id} className="relative">
                          <div className="absolute -right-9 mt-1.5 w-6 h-6 rounded-full bg-blue-100 border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm">
                            <BookOpen className="w-3 h-3 text-blue-600" />
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md">
                            <div 
                              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer focus:bg-gray-50 dark:focus:bg-gray-700/50 hover:bg-blue-50/30"
                              onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={\w-1.5 h-10 rounded-full \\}></div>
                                <div>
                                  <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base flex items-center">
                                    {course.title} {getPaymentMethodBadge(course.payment_method)}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span className="flex items-center gap-1"><User className="w-3 h-3"/> ??????: {course.trainer}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {course.start_date || '??? ????'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 mt-3 sm:mt-0 px-5 sm:px-0">
                                <span className={\	ext-xs px-2 py-1 rounded-md font-semibold \\}>
                                  {course.status === 'active' ? '???' : course.status === 'finished' ? '?????' : '?????'}
                                </span>
                                {expandedCourse === course.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                              </div>
                            </div>

                            {expandedCourse === course.id && (
                              <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 animate-fade-in text-sm">
                                <div className={\grid gap-4 mt-2 \\}>
                                  <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <span className="text-xs text-gray-500 block mb-1">?????? ?? ?????????</span>
                                    <span className="font-bold text-gray-700 dark:text-gray-300">{course.completed_lectures} / {course.lectures_count}</span>
                                  </div>
                                  <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <span className="text-xs text-gray-500 block mb-1">???? ??????</span>
                                    <span className="font-bold text-primary-600">{course.attendance_rate}%</span>
                                  </div>
                                  {user?.role !== 'trainer' && (
                                    <>
                                      <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <span className="text-xs text-gray-500 block mb-1">??????? ???? ??????</span>
                                        <span className="font-bold text-emerald-600">{formatCurrencyAmount(course.paid_amount || 0)}</span>
                                      </div>
                                      <div className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                                        <div>
                                          <span className="text-xs text-gray-500 block mb-1">??????? (????)</span>
                                          <span className="font-bold text-rose-600">{formatCurrencyAmount(course.remaining_amount || 0)}</span>
                                        </div>
                                        {course.remaining_amount > 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPaymentModal({
                                                open: true,
                                                courseId: course.id,
                                                amount: course.remaining_amount,
                                                maxAmount: course.remaining_amount,
                                                date: new Date().toISOString().split('T')[0],
                                                payment_method: course.payment_method || 'zain_cash'
                                              });
                                            }}
                                            className="mt-2 text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-1 rounded hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors w-full flex items-center justify-center gap-1"
                                          >
                                            <CreditCard className="w-3 h-3" /> ?????
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>\

code = code.substring(0, timelineStart) + newTimelineCode + code.substring(timelineEnd);

const modalEnd = code.lastIndexOf('</div>\\n  );\\n};');
const noteModalCode = \
      {/* Note Modal */}
      <Modal
        isOpen={noteModal}
        onClose={() => !submittingNote && setNoteModal(false)}
        title="????? ?????? ??????"
        size="md"
        zIndex="z-[200]"
      >
        <form onSubmit={handleNoteSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ?? ????????
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full relative z-[100] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 font-sans dark:bg-gray-700 dark:text-white"
              rows="4"
              placeholder="???? ??????? ???..."
              required
            ></textarea>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              ???? ????? ???????? ????? ?????? ?????.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={submittingNote || !newNote.trim()}
              className="btn flex-1 flex justify-center items-center bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg shadow-sm"
            >
              {submittingNote ? <LoadingSpinner size="sm" /> : '??? ????????'}
            </button>
            <button
              type="button"
              onClick={() => setNoteModal(false)}
              disabled={submittingNote}
              className="btn-secondary flex-1"
            >
              ?????
            </button>
          </div>
        </form>
      </Modal>
\;

code = code.substring(0, modalEnd) + noteModalCode + code.substring(modalEnd);

fs.writeFileSync('frontend/src/pages/shared/StudentProfile.jsx', code);
