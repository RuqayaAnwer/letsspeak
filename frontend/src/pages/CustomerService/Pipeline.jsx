import { useState, useEffect } from 'react';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Search, Plus, Calendar, Phone, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';

// Temporary fallback simple board if dnd is not installed
const columns = {
  new: { name: 'المسجلين الجدد', color: 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' },
  contacted: { name: 'تم التواصل', color: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' },
  waiting_intro: { name: 'بانتظار المحاضرة', color: 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' },
  attended_intro: { name: 'حضر المحاضرة', color: 'border-teal-500 bg-teal-50 dark:bg-teal-900/10' },
  confirmed: { name: 'اعتمد التسجيل', color: 'border-green-500 bg-green-50 dark:bg-green-900/10' },
  rejected: { name: 'مرفوض/غير مهتم', color: 'border-red-500 bg-red-50 dark:bg-red-900/10' }
};

const Pipeline = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone_whatsapp: '',
    status: 'new',
    notes: '',
    intro_date: '',
    package_selected: '',
    governorate: ''
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await api.get('/leads');
      setLeads(res.data);
    } catch (err) {
      console.error('Error fetching leads', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, lead) => {
    e.dataTransfer.setData('leadId', lead.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;

    // Optimistically update
    const leadIdNum = parseInt(leadId);
    setLeads(prev => prev.map(l => l.id === leadIdNum ? { ...l, status: newStatus } : l));

    try {
      await api.patch(`/leads/${leadId}/status`, { status: newStatus });
    } catch (err) {
      console.error('Error updating status', err);
      // Revert if error
      fetchLeads();
    }
  };

  const getLeadsByStatus = (status) => {
    return leads.filter(l => 
      l.status === status && 
      (l.name.includes(search) || l.phone_whatsapp.includes(search))
    );
  };

  const openModal = (lead = null) => {
    setEditingLead(lead);
    if (lead) {
      setFormData({
        name: lead.name,
        phone_whatsapp: lead.phone_whatsapp,
        status: lead.status,
        notes: lead.notes || '',
        intro_date: lead.intro_date ? lead.intro_date.split('T')[0] : '',
        package_selected: lead.package_selected || '',
        governorate: lead.governorate || ''
      });
    } else {
      setFormData({ name: '', phone_whatsapp: '', status: 'new', notes: '', intro_date: '', package_selected: '', governorate: '' });
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
      fetchLeads();
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async (id) => {
    if(!confirm('تأكيد الحذف؟')) return;
    try {
      await api.delete(`/leads/${id}`);
      fetchLeads();
    } catch(err) {
      alert('خطأ بالحذف');
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in relative z-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">تتبع رحلة العميل (Pipeline)</h1>
          <p className="page-subtitle">مسار العملاء من التسجيل إلى الاعتماد</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" /> عميل جديد
        </button>
      </div>

      <div className="card p-3 w-full sm:max-w-md">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="بحث عن طريق الاسم أو الرقم..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pr-10"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-6 h-[calc(100vh-250px)] min-h-[500px]">
        {Object.entries(columns).map(([statusKey, col]) => (
          <div 
            key={statusKey} 
            className={`flex-shrink-0 w-72 rounded-xl flex flex-col border-t-4 shadow-sm ${col.color}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, statusKey)}
          >
            <div className="p-3 font-bold text-[var(--color-text-primary)] border-b border-gray-200 dark:border-gray-700/50 flex justify-between items-center">
              <span>{col.name}</span>
              <span className="bg-white dark:bg-gray-800 text-xs px-2 py-1 rounded-full shadow-sm text-gray-600 dark:text-gray-300 font-mono">
                {getLeadsByStatus(statusKey).length}
              </span>
            </div>
            <div className="p-2 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {getLeadsByStatus(statusKey).map(lead => (
                <div 
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  onClick={() => openModal(lead)}
                  className="bg-white dark:bg-[var(--color-bg-primary)] p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                >
                  <div className="font-semibold text-sm text-[var(--color-text-primary)] mb-1">
                    {lead.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-2" dir="ltr">
                    <Phone className="w-3 h-3" />
                    {lead.phone_whatsapp}
                  </div>
                  
                  {lead.package_selected && (
                    <div className="mt-2 flex">
                      <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded">
                        {lead.package_selected}
                      </span>
                    </div>
                  )}

                  {lead.intro_date && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded w-fit pb-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(lead.intro_date).toLocaleDateString('ar-IQ')}
                    </div>
                  )}
                </div>
              ))}
              {getLeadsByStatus(statusKey).length === 0 && (
                <div className="text-center text-xs text-gray-400 py-10 opacity-60 pointer-events-none">اسحب وأفلت هنا</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLead ? "بيانات العميل" : "إضافة عميل جديد"}>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الاسم</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input" required />
            </div>
            <div>
               <label className="label">حالة العميل (المسار)</label>
               <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="select w-full">
                 {Object.entries(columns).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
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
              <input type="date" value={formData.intro_date} onChange={e => setFormData({...formData, intro_date: e.target.value})} className="input" />
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
