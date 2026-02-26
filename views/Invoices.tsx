

import React, { useState, useEffect, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Invoice, InvoiceStatus, Client } from '../types';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, CheckCircle, Clock, Trash2, Edit, FilePlus, Printer } from 'lucide-react';
import { formatCurrency, formatJalali, getStatusColor, toPersianDigits } from '../utils';

const InvoicesView = () => {
  const { user, showToast, confirmAction } = useContext(AuthContext);
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [invData, clientData] = await Promise.all([
        api.invoices.getAll(),
        api.clients.getAll()
    ]);
    setInvoices(invData.reverse());
    setClients(clientData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const initiateDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    confirmAction({
        title: 'حذف فاکتور',
        description: 'آیا از حذف این فاکتور اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
        confirmText: 'حذف فاکتور',
        isDestructive: true,
        onConfirm: async () => {
            try {
                await api.invoices.delete(id, user!.id);
                setInvoices(prev => prev.filter(i => i.id !== id));
                showToast('فاکتور با موفقیت حذف شد', 'success');
            } catch (e) {
                console.error(e);
                showToast('خطا در حذف فاکتور', 'error');
            }
        }
    });
  };

  const getClientName = (id: string) => {
      const c = clients.find(cl => cl.id === id);
      return c ? c.name : 'مشتری حذف شده';
  };

  const filteredInvoices = invoices.filter(inv => 
      inv.number.includes(searchTerm) || 
      getClientName(inv.clientId).includes(searchTerm)
  );

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">فاکتورها</h2>
                <p className="text-gray-500">مدیریت فاکتورهای فروش و پیش‌فاکتورها</p>
            </div>
            {invoices.length > 0 && (
                <button 
                    onClick={() => navigate('/invoices/new')} 
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition"
                >
                    <Plus size={20} />
                    <span>فاکتور جدید</span>
                </button>
            )}
        </div>

        {invoices.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 mb-6 shadow-sm">
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="جستجو بر اساس شماره فاکتور یا نام مشتری..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border-none outline-none focus:ring-2 focus:ring-primary-500/50 transition"
                    />
                </div>
            </div>
        )}

        {loading ? (
             <div className="text-center py-10 text-gray-400">در حال بارگذاری...</div>
        ) : invoices.length === 0 ? (
            /* EMPTY STATE */
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                <div className="w-24 h-24 bg-primary-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6">
                    <FilePlus size={48} className="text-primary-500"/>
                </div>
                <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2">هنوز هیچ فاکتوری ایجاد نکرده‌اید</h3>
                <p className="text-gray-500 mb-8 max-w-md text-center">برای صدور فاکتور یا پیش‌فاکتور برای مشتریان خود، اولین فاکتور را ایجاد کنید.</p>
                <button 
                    onClick={() => navigate('/invoices/new')} 
                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-primary-500/30 flex items-center gap-3 transition-transform hover:scale-105"
                >
                    <Plus size={24} />
                    <span>ایجاد اولین فاکتور</span>
                </button>
            </div>
        ) : filteredInvoices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInvoices.map(invoice => (
                    <div 
                        key={invoice.id} 
                        onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 hover:shadow-lg transition cursor-pointer group relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-gray-800 dark:text-white">#{toPersianDigits(invoice.number)}</span>
                                <span className="text-xs text-gray-400">{invoice.type === 'Proforma' ? 'پیش‌فاکتور' : 'فاکتور فروش'}</span>
                                {invoice.title && (
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-2 block">{invoice.title}</span>
                                )}
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getStatusColor(invoice.status)}`}>
                                {invoice.status}
                            </span>
                        </div>
                        
                        <div className="space-y-3 mb-4">
                             <div className="flex justify-between text-sm">
                                 <span className="text-gray-500">مشتری:</span>
                                 <span className="font-bold">{getClientName(invoice.clientId)}</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                 <span className="text-gray-500">تاریخ:</span>
                                 <span>{formatJalali(invoice.date)}</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                 <span className="text-gray-500">مبلغ نهایی:</span>
                                 <span className="font-bold text-primary-600 text-base">{formatCurrency(invoice.finalAmount)} <span className="text-[10px]">{invoice.currency}</span></span>
                             </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-gray-100 dark:border-slate-700 pt-4 flex justify-between items-center">
                            <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> {toPersianDigits(invoice.items.length)} آیتم</span>
                            <div className="flex gap-2">
                                <button onClick={(e) => {e.stopPropagation(); navigate(`/invoices/${invoice.id}/print`)}} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition" title="چاپ و دانلود"><Printer size={16}/></button>
                                <button onClick={(e) => {e.stopPropagation(); navigate(`/invoices/edit/${invoice.id}`)}} className="p-2 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition"><Edit size={16}/></button>
                                <button onClick={(e) => initiateDelete(e, invoice.id)} className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="col-span-full text-center py-20 text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-20"/>
                <p>هیچ فاکتوری با این مشخصات یافت نشد.</p>
            </div>
        )}
    </div>
  );
};

export default InvoicesView;
