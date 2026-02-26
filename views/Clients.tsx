
import React, { useState, useEffect, useContext, useRef } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Client, ClientType, Project, Transaction } from '../types';
import { Search, Plus, Edit2, Trash2, User, Phone, Tag, Image as ImageIcon, ArrowRight, Briefcase } from 'lucide-react';
import { generateId, formatJalaliShort, toPersianDigits, formatCurrency } from '../utils';
import { Modal } from '../components/Shared';

const ClientsView = () => {
  const { user, showToast, confirmAction } = useContext(AuthContext);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  
  // Detail View State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    phone: '',
    type: ClientType.Client,
    notes: '',
    avatarUrl: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [c, p, t] = await Promise.all([
        api.clients.getAll(),
        api.projects.getAll(),
        api.transactions.getAll()
    ]);
    setClients(c);
    setProjects(p);
    setTransactions(t);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Paste Logic
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isModalOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => setFormData(prev => ({...prev, avatarUrl: event.target?.result as string}));
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    try {
      if (editingId) {
        const updatedClient = { ...formData, id: editingId } as Client;
        await api.clients.update(updatedClient, user!.id);
        setClients(prev => prev.map(c => c.id === editingId ? updatedClient : c));
        showToast('مشتری با موفقیت ویرایش شد', 'success');
      } else {
        const newClient = {
          ...formData,
          id: generateId(),
          createdAt: new Date().toISOString()
        } as Client;
        await api.clients.create(newClient, user!.id);
        setClients(prev => [...prev, newClient]);
        showToast('مشتری جدید اضافه شد', 'success');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      showToast('خطا در ذخیره‌سازی', 'error');
    }
  };

  // --- FINAL FIX DELETE HANDLER ---
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    // Ultimate Stop Propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
    }
    
    confirmAction({
        description: 'آیا از حذف این مشتری اطمینان دارید؟ (دسترسی قطع خواهد شد)',
        onConfirm: async () => {
          try {
            await api.clients.delete(id, user!.id);
            // Force state update with new array reference
            setClients(prev => [...prev.filter(c => c.id !== id)]);
            showToast('مشتری با موفقیت حذف شد', 'success');
            
            if(selectedClient?.id === id) {
                setSelectedClient(null);
            }
          } catch(err) {
            console.error(err);
            showToast('خطا در حذف مشتری', 'error');
          }
        }
    });
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', type: ClientType.Client, notes: '', avatarUrl: '' });
    setEditingId(null);
  };

  const openEdit = (e: React.MouseEvent, client: Client) => {
    if(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    setFormData(client);
    setEditingId(client.id);
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
       const reader = new FileReader();
       reader.onloadend = () => setFormData(prev => ({...prev, avatarUrl: reader.result as string}));
       reader.readAsDataURL(file);
     }
  };

  const getClientStats = (clientId: string) => {
      const clientProjects = projects.filter(p => p.sourceId === clientId || p.sourceType === 'Client');
      const clientTrans = transactions.filter(t => t.clientId === clientId && t.type === 'Income');
      const totalIncome = clientTrans.reduce((sum, t) => sum + t.amount, 0);
      const activeP = clientProjects.filter(p => p.status === 'Active').length;
      const completedP = clientProjects.filter(p => p.status === 'Completed').length;
      return { totalIncome, activeP, completedP, totalProjects: clientProjects.length };
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.includes(searchTerm) || c.phone.includes(searchTerm);
    const matchesFilter = filterType === 'All' ? true : c.type === filterType || (c.type === ClientType.Both);
    return matchesSearch && matchesFilter;
  });

  // --- DETAIL VIEW ---
  if (selectedClient) {
      const stats = getClientStats(selectedClient.id);
      const clientProjects = projects.filter(p => p.sourceId === selectedClient.id);

      return (
          <div className="animate-in fade-in slide-in-from-right duration-300">
              <button onClick={() => setSelectedClient(null)} className="flex items-center gap-2 text-gray-500 hover:text-primary-600 mb-6 transition">
                  <ArrowRight size={20} /> بازگشت به لیست
              </button>
              
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm mb-8">
                  <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                      <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden border-4 border-white dark:border-slate-600 shadow-lg">
                          {selectedClient.avatarUrl ? <img src={selectedClient.avatarUrl} className="w-full h-full object-cover"/> : <User className="w-full h-full p-6 text-gray-400"/>}
                      </div>
                      <div className="flex-1 text-center md:text-right">
                          <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">{selectedClient.name}</h1>
                          <div className="flex gap-4 justify-center md:justify-start text-gray-500 mb-4">
                              <span className="flex items-center gap-1"><Phone size={16}/> {selectedClient.phone}</span>
                              <span className="flex items-center gap-1"><Tag size={16}/> {selectedClient.type === 'Client' ? 'مشتری' : 'کانکشن'}</span>
                          </div>
                          <p className="text-gray-400 text-sm max-w-2xl">{selectedClient.notes || 'بدون یادداشت'}</p>
                      </div>
                      <div className="flex gap-2">
                           <button onClick={(e) => openEdit(e, selectedClient)} className="px-4 py-2 bg-primary-50 text-primary-600 rounded-xl font-bold hover:bg-primary-100">ویرایش پروفایل</button>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <span className="text-xs text-gray-400 block mb-1">درآمد کل</span>
                      <span className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalIncome)}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <span className="text-xs text-gray-400 block mb-1">پروژه‌ها</span>
                      <span className="text-xl font-bold text-blue-600">{toPersianDigits(stats.activeP)}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <span className="text-xs text-gray-400 block mb-1">تکمیل شده</span>
                      <span className="text-xl font-bold text-gray-600 dark:text-gray-300">{toPersianDigits(stats.completedP)}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <span className="text-xs text-gray-400 block mb-1">امتیاز ریسک</span>
                      <span className="text-xl font-bold text-amber-500">{toPersianDigits(selectedClient.riskScore || 0)}%</span>
                  </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Briefcase size={20}/> تاریخچه پروژه‌ها</h3>
                  {clientProjects.length > 0 ? (
                      <div className="space-y-3">
                          {clientProjects.map(p => (
                              <div key={p.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
                                  <div>
                                      <h4 className="font-bold">{p.title}</h4>
                                      <span className="text-xs text-gray-400">{formatJalaliShort(p.createdAt)}</span>
                                  </div>
                                  <div className="text-left">
                                      <span className={`text-xs px-2 py-1 rounded-md ${p.status === 'Active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{p.status === 'Active' ? 'فعال' : p.status}</span>
                                      <div className="font-bold text-sm mt-1">{formatCurrency(p.totalBudget)}</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : <p className="text-gray-400 text-center py-4">هنوز پروژه‌ای ثبت نشده است.</p>}
              </div>
          </div>
      );
  }

  // --- LIST VIEW ---
  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">مدیریت مشتریان</h2>
          <p className="text-gray-500">لیست مشتریان و کانکشن‌ها</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-500/30 flex items-center gap-2 transition"
        >
          <Plus size={20} />
          <span>مشتری جدید</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 mb-6 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="جستجو نام یا شماره..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border-none outline-none focus:ring-2 focus:ring-primary-500/50 transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-500">در حال بارگذاری...</p>
        ) : filteredClients.map(client => {
          const stats = getClientStats(client.id);
          return (
          <div 
             key={client.id} 
             onClick={() => setSelectedClient(client)}
             className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 hover:shadow-lg transition-all group relative cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-500 overflow-hidden border-2 border-white dark:border-slate-600 shadow-sm">
                  {client.avatarUrl ? <img src={client.avatarUrl} className="w-full h-full object-cover" /> : <User size={28} />}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">{client.name}</h3>
                  <div className="flex gap-1 mt-1">
                     {(client.type === 'Client' || client.type === 'Both') && <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">مشتری</span>}
                     {(client.type === 'Connection' || client.type === 'Both') && <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">کانکشن</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats on Card */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 dark:bg-slate-900 p-2 rounded-lg text-center">
                    <span className="block text-[10px] text-gray-400">درآمد کل</span>
                    <span className="text-xs font-bold text-emerald-600">{formatCurrency(stats.totalIncome)}</span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900 p-2 rounded-lg text-center">
                    <span className="block text-[10px] text-gray-400">پروژه‌ها</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{toPersianDigits(stats.totalProjects)} ({toPersianDigits(stats.activeP)} فعال)</span>
                </div>
            </div>
            
            {/* EVENT FIREWALL WRAPPER */}
            <div 
              className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 relative mt-2" 
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            >
              <button 
                type="button"
                onClick={(e) => openEdit(e, client)}
                className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer z-30"
              >
                <Edit2 size={16} className="pointer-events-none"/> ویرایش
              </button>
              <button 
                type="button"
                onClick={(e) => handleDelete(e, client.id)}
                className="w-10 flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded-xl transition cursor-pointer z-30"
              >
                <Trash2 size={18} className="pointer-events-none" />
              </button>
            </div>
          </div>
        )})}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'ویرایش مشتری' : 'افزودن مشتری جدید'}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Content */}
              <div className="flex justify-center mb-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-primary-500 transition"
                  >
                      {formData.avatarUrl ? <img src={formData.avatarUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-400" size={32} />}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium mb-1">نام کامل</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700"/>
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">شماره تماس</label>
                   <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dir-ltr text-right"/>
                 </div>
                 <div>
                     <label className="block text-sm font-medium mb-1">نوع</label>
                     <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700">
                         <option value={ClientType.Client}>مشتری</option>
                         <option value={ClientType.Connection}>کانکشن</option>
                         <option value={ClientType.Both}>هر دو</option>
                     </select>
                 </div>
                 <div className="col-span-2 grid grid-cols-2 gap-4 border-t pt-4 dark:border-slate-700">
                    <input placeholder="نام کاربری (اختیاری)" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-sm"/>
                    <input placeholder="رمز عبور" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-sm"/>
                 </div>
                 <div className="col-span-2">
                   <textarea placeholder="یادداشت..." rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700"/>
                 </div>
              </div>
              <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold">ذخیره</button>
            </form>
      </Modal>
    </div>
  );
};

export default ClientsView;
