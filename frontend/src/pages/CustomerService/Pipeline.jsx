import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Search, Plus, Calendar, Phone, Trash2, ChevronRight, ChevronLeft, MoreVertical, Edit2, UserPlus, BookOpen } from 'lucide-react';
import Modal from '../../components/Modal';

const columns = {
  all: { name: 'الكل', color: 'bg-teal-600/20 text-teal-600 dark:text-teal-400 border-teal-500/30' },
  new: { name: 'المسجلين الجدد', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' },
  contacted: { name: 'تم التواصل', color: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' },
  waiting_intro: { name: 'بانتظار المحاضرة', color: 'bg-amber-600/20 text-amber-400 border-amber-500/30' },
  attended_intro: { name: 'وصل التعريفية', color: 'bg-purple-600/20 text-purple-400 border-purple-500/30' },
  confirmed: { name: 'مؤكدون', color: 'bg-green-600/20 text-green-400 border-green-500/30' },
  rejected: { name: 'مرفوض', color: 'bg-red-600/20 text-red-400 border-red-500/30' }
};

const Pipeline = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [counts, setCounts] = useState({ all: 0, new: 0, attended_intro: 0, confirmed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone_whatsapp: '', status: 'new', notes: '', intro_date: '', intro_time: '', trainer_name: '', package_selected: '', governorate: '',
    email: '', telegram_id: '', age: '', gender: '', preferred_time: '', current_level: '', source: ''
  });

  useEffect(() => {
    fetchLeads(1, activeTab, search);
  }, [activeTab]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLeads(1, activeTab, search);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const fetchLeads = async (page = 1, status = 'all', searchQuery = search) => {
    setLoading(true);
    try {
      const res = await api.get('/leads', {
        params: {
          page: page,
          status: status === 'all' ? 'all' : status,
          search: searchQuery || ''
        }
      });
      setLeads(res.data.leads.data);
      setPagination({
        current_page: res.data.leads.current_page,
        last_page: res.data.leads.last_page,
        total: res.data.leads.total
      });
      setCounts(res.data.counts || { all: 0, new: 0, attended_intro: 0, confirmed: 0 });
    } catch (err) {
      console.error('Error fetching leads', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (lead = null) => {
    setEditingLead(lead);
    if (lead) {
      setFormData({
        name: lead.name || '', phone_whatsapp: lead.phone_whatsapp || '', status: lead.status || 'new',
        notes: lead.notes || '', intro_date: lead.intro_date ? lead.intro_date.split('T')[0] : '',
        intro_time: lead.intro_time || '', trainer_name: lead.trainer_name || '',
        package_selected: lead.package_selected || '', governorate: lead.governorate || '',
        email: lead.email || '', telegram_id: lead.telegram_id || '', age: lead.age || '',
        gender: lead.gender || '', preferred_time: lead.preferred_time || '',
        current_level: lead.current_level || '', source: lead.source || ''
      });
    } else {
      setFormData({ 
        name: '', phone_whatsapp: '', status: 'new', notes: '', intro_date: '', intro_time: '', 
        trainer_name: '', package_selected: '', governorate: '', email: '', telegram_id: '', 
        age: '', gender: '', preferred_time: '', current_level: '', source: '' 
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLead) {
        await api.put(`/leads/${editingLead.id}`, formData);
      } else {
        await api.post('/leads', formData);
      }
      setIsModalOpen(false);
      fetchLeads(pagination.current_page, activeTab);
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async (id) => {
    if(!confirm('تأكيد الحذف؟')) return;
    try {
      await api.delete(`/leads/${id}`);
      fetchLeads(pagination.current_page, activeTab);
      setIsModalOpen(false);
    } catch(err) {
      alert('خطأ بالحذف');
    }
  };

  const updateLeadStatus = async (id, newStatus) => {
    try {
      await api.patch(`/leads/${id}/status`, { status: newStatus });
      fetchLeads(pagination.current_page, activeTab);
    } catch (err) {
      console.error('Error updating status', err);
    }
  };

  const convertLeadToStudent = async (lead) => {
    if(!confirm(`هل أنت متأكد من تحويل "${lead.name}" إلى طالب رسمي؟`)) return;
    try {
      const res = await api.post(`/leads/${lead.id}/convert`);
      fetchLeads(pagination.current_page, activeTab);
      
      if (confirm('تمت إضافة الطالب بنجاح! هل تريد الانتقال لإنشاء كورس له الآن؟')) {
        navigate('/customer-service/create-course');
      }
    } catch(err) {
      alert(err.response?.data?.message || err.message || 'خطأ أثناء تحويل العميل');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative z-0 min-h-screen font-sans text-right" dir="rtl">
      
      {/* Top Header & Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-2">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${activeTab === 'all' ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400 border-teal-500/50' : 'bg-white dark:bg-[#0f172a] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-[#1e293b] hover:bg-white dark:bg-[#1e293b]'} transition-all`}>
            الكل ({counts.all})
          </button>
          <button onClick={() => setActiveTab('new')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${activeTab === 'new' ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white dark:bg-[#0f172a] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-[#1e293b] hover:bg-white dark:bg-[#1e293b]'} transition-all`}>
            المسجلين الجدد ({counts.new})
          </button>
          <button onClick={() => setActiveTab('contacted')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${activeTab === 'contacted' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50' : 'bg-white dark:bg-[#0f172a] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-[#1e293b] hover:bg-white dark:bg-[#1e293b]'} transition-all`}>
            تم التواصل ({counts.contacted || 0})
          </button>
          <button onClick={() => setActiveTab('waiting_intro')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${activeTab === 'waiting_intro' ? 'bg-amber-600/20 text-amber-400 border-amber-500/50' : 'bg-white dark:bg-[#0f172a] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-[#1e293b] hover:bg-white dark:bg-[#1e293b]'} transition-all`}>
            بانتظار المحاضرة ({counts.waiting_intro || 0})
          </button>
          <button onClick={() => setActiveTab('attended_intro')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${activeTab === 'attended_intro' ? 'bg-purple-600/20 text-purple-400 border-purple-500/50' : 'bg-white dark:bg-[#0f172a] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-[#1e293b] hover:bg-white dark:bg-[#1e293b]'} transition-all`}>
            وصل التعريفية ({counts.attended_intro})
          </button>
          <button onClick={() => setActiveTab('confirmed')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${activeTab === 'confirmed' ? 'bg-green-600/20 text-green-400 border-green-500/50' : 'bg-white dark:bg-[#0f172a] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-[#1e293b] hover:bg-white dark:bg-[#1e293b]'} transition-all`}>
            مؤكدون ({counts.confirmed})
          </button>
          <button onClick={() => setActiveTab('rejected')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${activeTab === 'rejected' ? 'bg-red-600/20 text-red-400 border-red-500/50' : 'bg-white dark:bg-[#0f172a] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-[#1e293b] hover:bg-white dark:bg-[#1e293b]'} transition-all`}>
            مرفوض ({counts.rejected || 0})
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الرقم..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] text-gray-800 dark:text-slate-200 text-sm rounded-lg pr-10 pl-3 py-2 w-full xl:w-64 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/customer-service/create-course')} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-2 transition-colors" title="إنشاء كورس سريع">
              <BookOpen className="w-5 h-5" />
            </button>
            <button onClick={() => openModal()} className="bg-teal-600 hover:bg-teal-500 text-white rounded-lg p-2 transition-colors" title="إضافة عميل">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-2xl overflow-hidden shadow-xl ring-1 ring-gray-200 dark:ring-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right text-gray-700 dark:text-slate-300">
            <thead className="text-xs text-teal-600 dark:text-teal-400/90 whitespace-nowrap uppercase bg-gray-50 dark:bg-[#0b1221] border-b border-gray-200 dark:border-[#1e293b]">
              <tr>
                <th className="px-4 py-4 w-12 text-center border-l border-gray-200 dark:border-[#1e293b]">#</th>
                <th className="px-4 py-4 border-l border-gray-200 dark:border-[#1e293b]">الاسم</th>
                <th className="px-4 py-4 text-center border-l border-gray-200 dark:border-[#1e293b]">الحزمة / المستوى</th>
                <th className="px-4 py-4 text-center border-l border-gray-200 dark:border-[#1e293b]">جهة الاتصال</th>
                <th className="px-4 py-4 text-center border-l border-gray-200 dark:border-[#1e293b]">المرحلة الحالية</th>
                <th className="px-4 py-4 border-l border-gray-200 dark:border-[#1e293b]">التسجيل</th>
                <th className="px-4 py-4 border-l border-gray-200 dark:border-[#1e293b]">التعريفية & التفاصيل</th>
                <th className="px-4 py-4 text-center"><MoreVertical className="w-4 h-4 inline-block opacity-50" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
              {loading ? (
                <tr><td colSpan="8" className="py-20 text-center"><LoadingSpinner size="lg" /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan="8" className="py-20 text-center text-gray-500 dark:text-slate-500">لا يوجد بيانات مطابقة</td></tr>
              ) : (
                leads.map((lead, index) => (
                  <tr key={lead.id} className="hover:bg-white dark:bg-[#1e293b]/40 transition-colors group">
                    <td className="px-4 py-4 text-center text-gray-500 dark:text-slate-500 font-mono border-l border-gray-200 dark:border-[#1e293b]">
                      {((pagination.current_page - 1) * 30) + index + 1}
                    </td>
                    
                    <td className="px-4 py-4 border-l border-gray-200 dark:border-[#1e293b]">
                      <div className="font-bold text-gray-900 dark:text-slate-100 text-[14px] mb-1">{lead.name}</div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400 font-medium opacity-80">
                        {lead.governorate ? lead.governorate : 'بدون محافظة'} 
                        {lead.age ? ` • ${lead.age} سنة` : ''}
                        {lead.gender ? ` • ${lead.gender}` : ''}
                        <br /> {lead.created_at.split('T')[0]}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center border-l border-gray-200 dark:border-[#1e293b]">
                      {lead.package_selected ? (
                        <span className="inline-block border border-[#334155] bg-white dark:bg-[#1e293b]/50 text-gray-700 dark:text-slate-300 text-[11px] px-3 py-1 rounded-full">
                          {lead.package_selected}
                        </span>
                      ) : <span className="text-slate-600">-</span>}
                    </td>

                    <td className="px-4 py-4 text-center border-l border-gray-200 dark:border-[#1e293b]">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-mono text-xs" dir="ltr">
                          <Phone className="w-3.5 h-3.5 opacity-80" /> {lead.phone_whatsapp}
                        </div>
                        {lead.telegram_id && <div className="text-[10px] text-blue-400 font-mono" dir="ltr">@{lead.telegram_id.replace('@', '')}</div>}
                        {lead.source && <div className={`text-[10px] font-bold ${lead.source.includes('انستا') || lead.source.includes('الانستغرام') ? 'text-pink-400' : 'text-gray-500 dark:text-slate-400'}`}>{lead.source}</div>}
                        {lead.email && <div className="text-[10px] text-indigo-300 truncate max-w-[120px]" title={lead.email}>{lead.email}</div>}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center border-l border-gray-200 dark:border-[#1e293b]">
                      <select 
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded border appearance-none outline-none cursor-pointer text-center ${columns[lead.status]?.color || columns['new'].color}`}
                      >
                        {Object.entries(columns).filter(([k]) => k !== 'all').map(([k, v]) => (
                          <option key={k} value={k} className="bg-white dark:bg-[#0f172a] text-gray-800 dark:text-slate-200">{v.name}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-4 border-l border-gray-200 dark:border-[#1e293b]">
                      <div className="flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                        <Calendar className="w-3.5 h-3.5 opacity-60" />
                        <span className="font-mono text-[11px]">{new Date(lead.created_at).toLocaleDateString('en-CA')}</span>
                      </div>
                      {lead.preferred_time && (
                        <div className="text-[10px] text-teal-600 dark:text-teal-400/90 font-medium mb-1 truncate max-w-[150px]" title={lead.preferred_time}>
                           تفضيل الوقت: {lead.preferred_time}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-500 dark:text-slate-500/80 max-w-[150px] truncate leading-relaxed" title={lead.notes}>
                        {lead.notes || 'لا يوجد ملاحظات'}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-l border-gray-200 dark:border-[#1e293b]">
                      {(lead.intro_date || lead.trainer_name || lead.intro_time) ? (
                        <div className="flex flex-col gap-1.5">
                          {lead.trainer_name && (
                            <div className="text-[12px] font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                              <span className="text-amber-500">👤</span> {lead.trainer_name}
                            </div>
                          )}
                          {lead.intro_date ? (
                            <div className="text-[11px] text-amber-500/90 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              مجدولة: <span className="font-mono">{lead.intro_date.split('T')[0]}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px]">- لم يحدد التاريخ -</span>
                          )}
                          {lead.intro_time && (
                            <div className="text-[10px] text-amber-500/70 font-mono">
                              الوقت: {(() => {
                                try {
                                  const [h, m] = lead.intro_time.split(':');
                                  const d = new Date(); d.setHours(h, m);
                                  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                } catch { return lead.intro_time; }
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">- بانتظار التحديد -</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button onClick={() => convertLeadToStudent(lead)} className="text-gray-500 dark:text-slate-500 hover:text-blue-400 transition-colors p-2 bg-white dark:bg-[#1e293b]/50 hover:bg-white dark:bg-[#1e293b] rounded-lg" title="تحويل إلى طالب رسمي">
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button onClick={() => openModal(lead)} className="text-gray-500 dark:text-slate-500 hover:text-teal-600 dark:text-teal-400 transition-colors p-2 bg-white dark:bg-[#1e293b]/50 hover:bg-white dark:bg-[#1e293b] rounded-lg" title="تعديل أو عرض التفاصيل">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && pagination.last_page > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-[#1e293b] bg-gray-50 dark:bg-[#0b1221]">
            <span className="text-sm text-gray-500 dark:text-slate-500">
              إجمالي السجلات: <span className="font-semibold text-teal-600 dark:text-teal-400">{pagination.total}</span>
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchLeads(pagination.current_page - 1, activeTab)}
                disabled={pagination.current_page === 1}
                className="p-1.5 rounded bg-white dark:bg-[#1e293b] text-gray-500 dark:text-slate-400 hover:text-teal-600 dark:text-teal-400 hover:bg-gray-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-white dark:bg-[#1e293b] transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="text-xs font-mono bg-white dark:bg-[#1e293b]/50 border border-gray-200 dark:border-[#1e293b] text-gray-700 dark:text-slate-300 px-4 py-1.5 rounded">
                الصفحة <span className="font-bold text-teal-600 dark:text-teal-400 mx-1">{pagination.current_page}</span> من {pagination.last_page}
              </div>
              <button 
                onClick={() => fetchLeads(pagination.current_page + 1, activeTab)}
                disabled={pagination.current_page === pagination.last_page}
                className="p-1.5 rounded bg-white dark:bg-[#1e293b] text-gray-500 dark:text-slate-400 hover:text-teal-600 dark:text-teal-400 hover:bg-gray-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-white dark:bg-[#1e293b] transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLead ? "تعديل و عرض البيانات" : "إضافة عميل جديد"}>
         <form onSubmit={handleSubmit} className="space-y-4 text-right">
           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input" required />
            </div>
            <div>
               <label className="label">حالة العميل (المسار)</label>
               <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="select w-full">
                 {Object.entries(columns).filter(([k]) => k !== 'all').map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
               </select>
            </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">رقم الهاتف (الواتساب)</label>
              <input type="tel" value={formData.phone_whatsapp} onChange={e => setFormData({...formData, phone_whatsapp: e.target.value})} className="input" dir="ltr" required />
            </div>
            <div>
              <label className="label">المحافظة</label>
              <input type="text" value={formData.governorate} onChange={e => setFormData({...formData, governorate: e.target.value})} className="input" />
            </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الباقة المختارة</label>
              <input type="text" value={formData.package_selected} onChange={e => setFormData({...formData, package_selected: e.target.value})} className="input" />
            </div>
            <div>
              <label className="label">موعد المحاضرة (إن وُجد)</label>
              <div className="flex gap-2">
                <input type="date" value={formData.intro_date} onChange={e => setFormData({...formData, intro_date: e.target.value})} className="input flex-[2]" />
                <input type="time" value={formData.intro_time} onChange={e => setFormData({...formData, intro_time: e.target.value})} className="input flex-[1]" title="وقت المحاضرة" />
              </div>
            </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">اسم المدرب</label>
              <input type="text" value={formData.trainer_name} onChange={e => setFormData({...formData, trainer_name: e.target.value})} className="input" placeholder="اسم المدرب أو المعرف..." />
            </div>
            <div>
              <label className="label">المستوى الحالي</label>
              <input type="text" value={formData.current_level} onChange={e => setFormData({...formData, current_level: e.target.value})} className="input" placeholder="مستوى الطالب الحالي..." />
            </div>
           </div>

           <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input" dir="ltr" placeholder="example@email.com" />
            </div>
            <div>
              <label className="label">معرف التليجرام</label>
              <input type="text" value={formData.telegram_id} onChange={e => setFormData({...formData, telegram_id: e.target.value})} className="input" dir="ltr" placeholder="@username" />
            </div>
            <div>
              <label className="label">المصدر (Source)</label>
              <input type="text" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="input" placeholder="كيف عرف عنا؟" />
            </div>
           </div>

           <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">العمر</label>
              <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="input" placeholder="سنة" />
            </div>
            <div>
              <label className="label">الجنس</label>
              <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="select w-full">
                <option value="">غير محدد</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div>
              <label className="label">الوقت المفضل</label>
              <input type="text" value={formData.preferred_time} onChange={e => setFormData({...formData, preferred_time: e.target.value})} className="input" placeholder="صباحي، مسائي..." />
            </div>
           </div>

           <div>
              <label className="label">ملاحظات فريق المبيعات</label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="input min-h-[80px]" placeholder="ملاحظات حول مستوى العميل واستجابته..."></textarea>
           </div>

           <div className="flex justify-between items-center pt-4 border-t border-[var(--color-border)]">
              {editingLead ? (
                <button type="button" onClick={() => handleDelete(editingLead.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1">
                   <Trash2 className="w-4 h-4" /> حذف العميل
                </button>
              ) : <span />}

             <div className="flex gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">إلغاء</button>
                <button type="submit" className="btn-primary">{editingLead ? 'حفظ التغييرات' : 'إضافة إلى المسار'}</button>
             </div>
           </div>
         </form>
      </Modal>

    </div>
  );
};

export default Pipeline;

