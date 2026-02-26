
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Invoice, InvoiceStatus, Currency, InvoiceItem, Client, ClientType, InvoiceOptions } from '../types';
import { ArrowRight, Save, Download, Plus, Trash2, Calculator, Percent, FileText, UserPlus, Image as ImageIcon, PenTool, Check, Eraser, Smartphone, Globe, Moon, Tablet, AlertCircle, Loader2, Printer, MapPin, Mail, Hash, Upload } from 'lucide-react';
import { generateId, toPersianDigits, formatPriceInput, parsePriceInput, formatJalali, numberToWords, formatCurrency, toEnglishDigits } from '../utils';
import { Modal, JalaliDatePicker, CurrencyInput } from '../components/Shared';

const SignaturePad = ({ onSave, onClear, existing }: { onSave: (data: string) => void, onClear: () => void, existing?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if(canvas && !existing) {
            canvas.width = 300;
            canvas.height = 150;
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000';
                ctx.lineCap = 'round';
            }
        }
    }, [existing]);

    const startDrawing = (e: any) => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if(!isDrawing) return;
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if(isDrawing) {
            setIsDrawing(false);
            const canvas = canvasRef.current;
            if(canvas) {
                onSave(canvas.toDataURL());
            }
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if(ev.target?.result) {
                    onSave(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-2 flex flex-col items-center">
            {existing && !isDrawing ? (
                <div className="relative group w-full flex justify-center">
                     <img src={existing} className="max-w-[300px] h-[150px] object-contain" alt="Signature"/>
                     <div className="absolute inset-0 bg-black/5 hidden group-hover:flex items-center justify-center rounded-lg">
                         <button onClick={onClear} className="bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-bold flex items-center gap-1 hover:bg-red-600 transition">
                             <Eraser size={14}/> حذف امضا
                         </button>
                     </div>
                </div>
            ) : (
                <canvas 
                    ref={canvasRef} 
                    className="cursor-crosshair bg-gray-50 rounded-lg touch-none border border-gray-100"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            )}
            
            <div className="flex gap-3 mt-3 w-full justify-center border-t border-gray-100 pt-2">
                <button 
                    type="button" 
                    onClick={() => { 
                        const canvas = canvasRef.current; 
                        const ctx = canvas?.getContext('2d'); 
                        ctx?.clearRect(0,0,300,150); 
                        onClear(); 
                    }} 
                    className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-50 transition"
                >
                    <Eraser size={14}/> پاک کردن پد
                </button>
                <div className="w-px h-6 bg-gray-200"></div>
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 py-1 px-2 rounded hover:bg-primary-50 transition font-bold"
                >
                    <Upload size={14}/> آپلود تصویر (PNG)
                </button>
                <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/png, image/jpeg" 
                    className="hidden" 
                    onChange={handleImageUpload}
                />
            </div>
        </div>
    );
};

const InvoiceEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, showToast } = useContext(AuthContext);

  // Data States
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [config, setConfig] = useState({ extraLangPercent: 30, mobileRespPercent: 20, tabletRespPercent: 15, darkModePercent: 10 });
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [saveAsDefaultSeller, setSaveAsDefaultSeller] = useState(false);
  
  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Invoice State
  const [invoice, setInvoice] = useState<Partial<Invoice>>({
      title: '', // Default
      type: 'Invoice',
      status: InvoiceStatus.Draft,
      currency: Currency.Toman,
      items: [],
      discountType: 'Fixed',
      discountValue: 0,
      taxPercent: 0,
      date: new Date().toLocaleDateString('fa-IR'),
      number: Math.floor(1000 + Math.random() * 9000).toString(),
      projectType: 'Website',
      options: { hasExtraLanguage: false, hasMobileResp: false, hasTabletResp: false, hasDarkMode: false },
      sellerDetails: { address: '', email: '', zipCode: '' }
  });

  // Client Modal State
  const [newClient, setNewClient] = useState({ name: '', phone: '', type: ClientType.Client });

  // Load Data & Handle Draft
  useEffect(() => {
      const init = async () => {
          setLoading(true);
          const [c, p, s] = await Promise.all([api.clients.getAll(), api.projects.getAll(), api.settings.get()]);
          setClients(c);
          setProjects(p);
          setSettings(s);
          if (s.invoiceConfig) setConfig(s.invoiceConfig);

          if (id) {
              const inv = await api.invoices.getById(id);
              if (inv) setInvoice(inv);
              else navigate('/invoices'); // Invalid ID
          } else {
              // Check for local draft for new invoice
              const savedDraft = localStorage.getItem('invoice_draft');
              // Check for default seller info
              const sellerDefaults = JSON.parse(localStorage.getItem('xrm_seller_defaults') || '{}');
              
              if (savedDraft) {
                  try {
                      setInvoice(JSON.parse(savedDraft));
                  } catch (e) { console.error("Bad Draft"); }
              } else {
                  // Defaults from settings
                  setInvoice(prev => ({
                      ...prev,
                      title: 'فاکتور فروش کالا و خدمات',
                      logoUrl: s.defaultLogoUrl,
                      signatureUrl: s.defaultSignatureUrl,
                      providerNote: s.defaultProviderNote,
                      date: new Date().toLocaleDateString('fa-IR'),
                      sellerDetails: sellerDefaults // Pre-fill
                  }));
              }
          }
          setLoading(false);
      };
      init();
  }, [id]);

  // Auto-Save Draft (Only if creating new)
  useEffect(() => {
      if (!id && !loading && invoice) {
          localStorage.setItem('invoice_draft', JSON.stringify(invoice));
      }
  }, [invoice, id, loading]);

  // Calculations
  const subTotal = invoice.items?.reduce((sum, item) => sum + item.total, 0) || 0;
  
  // Calculate Options Add-on
  let optionsPercent = 0;
  if ((invoice.projectType === 'Website' || invoice.projectType === 'Application') && invoice.options) {
      if (invoice.options.hasExtraLanguage) optionsPercent += config.extraLangPercent;
      if (invoice.options.hasMobileResp) optionsPercent += config.mobileRespPercent;
      if (invoice.options.hasTabletResp) optionsPercent += config.tabletRespPercent;
      if (invoice.options.hasDarkMode) optionsPercent += config.darkModePercent;
  }
  const optionsAmount = Math.round(subTotal * (optionsPercent / 100));
  const totalBeforeDiscount = subTotal + optionsAmount;

  const discountAmount = invoice.discountType === 'Percent' 
        ? Math.round(totalBeforeDiscount * ((invoice.discountValue || 0) / 100))
        : (invoice.discountValue || 0);
  
  const afterDiscount = totalBeforeDiscount - discountAmount;
  const taxAmount = Math.round(afterDiscount * ((invoice.taxPercent || 0) / 100));
  const finalAmount = afterDiscount + taxAmount;

  // Handlers
  const handleItemChange = (idx: number, field: keyof InvoiceItem, value: any) => {
      const newItems = [...(invoice.items || [])];
      newItems[idx] = { ...newItems[idx], [field]: value };
      // Recalc total
      newItems[idx].total = newItems[idx].quantity * newItems[idx].unitPrice;
      setInvoice({ ...invoice, items: newItems });
      
      // Clear specific error if fixed
      if (errors[`item-${idx}-${field}`]) {
          const newErrors = {...errors};
          delete newErrors[`item-${idx}-${field}`];
          setErrors(newErrors);
      }
  };

  const addItem = () => {
      const newItem: InvoiceItem = {
          id: generateId(),
          title: '',
          quantity: 1,
          unitPrice: 0,
          total: 0
      };
      setInvoice({ ...invoice, items: [...(invoice.items || []), newItem] });
      // Clear generic items error
      if (errors.items) {
          const newErrors = {...errors};
          delete newErrors.items;
          setErrors(newErrors);
      }
  };

  const removeItem = (idx: number) => {
      const newItems = [...(invoice.items || [])];
      newItems.splice(idx, 1);
      setInvoice({ ...invoice, items: newItems });
  };

  const validateForm = () => {
      const newErrors: Record<string, string> = {};
      let isValid = true;

      if (!invoice.title?.trim()) {
          newErrors.title = 'عنوان فاکتور الزامی است';
          isValid = false;
      }

      if (!invoice.clientId) {
          newErrors.clientId = 'انتخاب مشتری الزامی است';
          isValid = false;
      }

      if (!invoice.items || invoice.items.length === 0) {
          newErrors.items = 'حداقل یک آیتم به فاکتور اضافه کنید';
          isValid = false;
      } else {
          invoice.items.forEach((item, idx) => {
              if (!item.title.trim()) {
                  newErrors[`item-${idx}-title`] = 'عنوان آیتم نمی‌تواند خالی باشد';
                  isValid = false;
              }
          });
      }

      setErrors(newErrors);
      return isValid;
  };

  const saveInvoice = async (redirectAfter = false) => {
      // 1. Validation
      if (!validateForm()) {
          const firstErrorKey = Object.keys(errors)[0];
          if(firstErrorKey === 'clientId') document.getElementById('client-select')?.focus();
          if(firstErrorKey === 'title') document.getElementById('invoice-title')?.focus();
          showToast('فاکتور ذخیره نشد. لطفاً خطاهای فرم را بررسی کنید', 'error');
          return;
      }

      setSaving(true);
      try {
          // Persistence: Save seller info if requested
          if(saveAsDefaultSeller && invoice.sellerDetails) {
              localStorage.setItem('xrm_seller_defaults', JSON.stringify(invoice.sellerDetails));
          }

          const finalInvoice = {
              ...invoice,
              subTotal,
              optionsAmount,
              discountAmount,
              taxAmount,
              finalAmount,
              updatedAt: new Date().toISOString()
          } as Invoice;

          let targetId = finalInvoice.id;

          if (id) {
              await api.invoices.update(finalInvoice, user!.id);
              showToast('فاکتور با موفقیت به‌روزرسانی شد', 'success');
          } else {
              targetId = generateId();
              finalInvoice.id = targetId;
              finalInvoice.createdAt = new Date().toISOString();
              finalInvoice.createdBy = user!.id;
              await api.invoices.create(finalInvoice, user!.id);
              localStorage.removeItem('invoice_draft');
              showToast('فاکتور جدید با موفقیت ایجاد شد', 'success');
          }
          
          if (redirectAfter) {
            // Force a small delay to ensure DB write before navigation read
            setTimeout(() => {
                navigate(`/invoices/${targetId}/print`);
            }, 100);
          } else {
            navigate('/invoices');
          }
      } catch (e) {
          console.error(e);
          showToast('خطا در ذخیره فاکتور', 'error');
      } finally {
          setSaving(false);
      }
  };

  const handleCreateClient = async () => {
      if(!newClient.name || !newClient.phone) return;
      const c: Client = {
          id: generateId(),
          ...newClient,
          createdAt: new Date().toISOString()
      };
      await api.clients.create(c, user!.id);
      setClients(prev => [...prev, c]);
      setInvoice({...invoice, clientId: c.id}); // Select newly created
      setShowClientModal(false);
      setNewClient({ name: '', phone: '', type: ClientType.Client });
      // Clear error
      if(errors.clientId) {
          const newErrors = {...errors};
          delete newErrors.clientId;
          setErrors(newErrors);
      }
      showToast('مشتری جدید اضافه شد', 'success');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(file) {
          const reader = new FileReader();
          reader.onload = (ev) => setInvoice(prev => ({...prev, logoUrl: ev.target?.result as string}));
          reader.readAsDataURL(file);
      }
  };

  if (loading) return <div className="p-10 text-center font-shabnam">در حال بارگذاری موتور فاکتور...</div>;

  return (
    <div className="flex flex-col h-full relative font-shabnam">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between mb-6 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
             <div className="flex items-center gap-4">
                 <button onClick={() => navigate('/invoices')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition">
                     <ArrowRight size={20}/>
                 </button>
                 <h2 className="font-bold text-lg text-gray-800 dark:text-white">
                     {id ? 'ویرایش فاکتور' : 'ایجاد فاکتور جدید'}
                 </h2>
                 <span className="bg-primary-50 text-primary-600 px-3 py-1 rounded-lg text-xs font-bold">
                     {invoice.type === 'Proforma' ? 'پیش‌فاکتور' : 'فاکتور فروش'}
                 </span>
             </div>
             <div className="flex gap-3">
                 <button 
                    type="button" 
                    onClick={() => saveInvoice(true)} 
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition font-bold disabled:opacity-50"
                 >
                     <Printer size={18} />
                     چاپ / PDF
                 </button>
                 <button 
                    type="button" 
                    onClick={() => saveInvoice(false)} 
                    disabled={saving} 
                    className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-500/30 disabled:opacity-70 font-bold"
                 >
                     <Save size={18}/> {saving ? 'در حال ذخیره...' : 'ذخیره فاکتور'}
                 </button>
             </div>
        </div>

        {/* Global Error Banner */}
        {Object.keys(errors).length > 0 && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={20} />
                <span className="font-bold text-sm">لطفاً خطاهای فرم را بررسی کنید.</span>
            </div>
        )}

        {/* Main Form Grid */}
        <div className="grid grid-cols-12 gap-6 pb-20">
            {/* Left Column: Settings */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
                 {/* 1. Basic Info */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                     <h3 className="font-bold mb-4 flex items-center gap-2"><FileText size={18} className="text-primary-600"/> اطلاعات پایه</h3>
                     <div className="space-y-4">
                         {/* Title Input */}
                         <div>
                             <label className="block text-sm font-medium mb-1">عنوان فاکتور <span className="text-red-500">*</span></label>
                             <input 
                                id="invoice-title"
                                type="text" 
                                value={invoice.title || ''} 
                                onChange={e => {
                                    setInvoice({...invoice, title: e.target.value});
                                    if(errors.title) {
                                        const newErr = {...errors};
                                        delete newErr.title;
                                        setErrors(newErr);
                                    }
                                }}
                                placeholder="مثلاً: فاکتور طراحی سایت"
                                className={`w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border outline-none font-shabnam transition ${errors.title ? 'border-red-500' : 'border-gray-200 dark:border-slate-700'}`}
                             />
                             {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
                         </div>

                         <div>
                             <label className="block text-sm font-medium mb-1">نوع سند</label>
                             <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                                 <button onClick={() => setInvoice({...invoice, type: 'Invoice'})} className={`flex-1 py-2 text-sm rounded-lg transition ${invoice.type === 'Invoice' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>فاکتور فروش</button>
                                 <button onClick={() => setInvoice({...invoice, type: 'Proforma'})} className={`flex-1 py-2 text-sm rounded-lg transition ${invoice.type === 'Proforma' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>پیش‌فاکتور</button>
                             </div>
                         </div>
                         <div>
                             <label className="block text-sm font-medium mb-1">وضعیت</label>
                             <select value={invoice.status} onChange={e => setInvoice({...invoice, status: e.target.value as any})} className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam cursor-pointer">
                                 {Object.values(InvoiceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-sm font-medium mb-1">شماره</label>
                                 <input type="text" value={invoice.number} onChange={e => setInvoice({...invoice, number: e.target.value})} className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none text-center font-bold font-shabnam"/>
                             </div>
                             <div>
                                 <JalaliDatePicker label="تاریخ" value={invoice.date} onChange={(d: string) => setInvoice({...invoice, date: d})} />
                             </div>
                         </div>
                         <div>
                             <label className="block text-sm font-medium mb-1">واحد پول</label>
                             <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                                 <button onClick={() => setInvoice({...invoice, currency: Currency.Toman})} className={`flex-1 py-2 text-sm rounded-lg transition ${invoice.currency === Currency.Toman ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>تومان</button>
                                 <button onClick={() => setInvoice({...invoice, currency: Currency.Rial})} className={`flex-1 py-2 text-sm rounded-lg transition ${invoice.currency === Currency.Rial ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>ریال</button>
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* Seller Details - New Section */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                     <h3 className="font-bold mb-4 flex items-center gap-2"><MapPin size={18} className="text-primary-600"/> اطلاعات تکمیلی فروشنده</h3>
                     <div className="space-y-3">
                         <div>
                             <label className="block text-xs font-bold mb-1 text-gray-500">آدرس (جهت نمایش در فاکتور)</label>
                             <input 
                                value={invoice.sellerDetails?.address || ''} 
                                onChange={e => setInvoice({...invoice, sellerDetails: {...invoice.sellerDetails, address: e.target.value}})}
                                className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam text-sm"
                                placeholder="مثال: تهران، خیابان..."
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                             <div>
                                 <label className="block text-xs font-bold mb-1 text-gray-500">ایمیل</label>
                                 <input 
                                    value={invoice.sellerDetails?.email || ''} 
                                    onChange={e => setInvoice({...invoice, sellerDetails: {...invoice.sellerDetails, email: e.target.value}})}
                                    className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam text-sm dir-ltr text-right"
                                    placeholder="info@..."
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold mb-1 text-gray-500">کد پستی</label>
                                 <input 
                                    value={invoice.sellerDetails?.zipCode || ''} 
                                    onChange={e => setInvoice({...invoice, sellerDetails: {...invoice.sellerDetails, zipCode: e.target.value}})}
                                    className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam text-sm dir-ltr text-center"
                                    placeholder="1234567890"
                                 />
                             </div>
                         </div>
                         
                         <label className="flex items-center gap-2 cursor-pointer pt-2">
                             <input 
                                type="checkbox" 
                                checked={saveAsDefaultSeller} 
                                onChange={e => setSaveAsDefaultSeller(e.target.checked)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                             />
                             <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">ذخیره به عنوان اطلاعات پیشنهادی</span>
                         </label>
                     </div>
                 </div>
                 
                 {/* Project Type & Smart Options */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                     <h3 className="font-bold mb-4 flex items-center gap-2"><Smartphone size={18} className="text-primary-600"/> نوع پروژه / فاکتور</h3>
                     <div className="space-y-4">
                         <select 
                            value={invoice.projectType} 
                            onChange={e => setInvoice({...invoice, projectType: e.target.value as any})} 
                            className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam cursor-pointer text-sm"
                         >
                             <option value="Website">وب‌سایت</option>
                             <option value="Application">اپلیکیشن</option>
                             <option value="Other">سایر</option>
                         </select>

                         {/* Smart Checkboxes (Only for Web/App) */}
                         {(invoice.projectType === 'Website' || invoice.projectType === 'Application') && (
                             <div className="space-y-3 pt-2">
                                 <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition">
                                     <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-gray-300"
                                        checked={invoice.options?.hasExtraLanguage || false}
                                        onChange={e => setInvoice({...invoice, options: {...invoice.options!, hasExtraLanguage: e.target.checked}})}
                                     />
                                     <span className="flex items-center gap-2 text-sm"><Globe size={16} className="text-gray-400"/> طراحی زبان اضافه (انگلیسی...)</span>
                                 </label>
                                 <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition">
                                     <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-gray-300"
                                        checked={invoice.options?.hasMobileResp || false}
                                        onChange={e => setInvoice({...invoice, options: {...invoice.options!, hasMobileResp: e.target.checked}})}
                                     />
                                     <span className="flex items-center gap-2 text-sm"><Smartphone size={16} className="text-gray-400"/> ریسپانسیو موبایل</span>
                                 </label>
                                 <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition">
                                     <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-gray-300"
                                        checked={invoice.options?.hasTabletResp || false}
                                        onChange={e => setInvoice({...invoice, options: {...invoice.options!, hasTabletResp: e.target.checked}})}
                                     />
                                     <span className="flex items-center gap-2 text-sm"><Tablet size={16} className="text-gray-400"/> ریسپانسیو تبلت</span>
                                 </label>
                                 <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition">
                                     <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-gray-300"
                                        checked={invoice.options?.hasDarkMode || false}
                                        onChange={e => setInvoice({...invoice, options: {...invoice.options!, hasDarkMode: e.target.checked}})}
                                     />
                                     <span className="flex items-center gap-2 text-sm"><Moon size={16} className="text-gray-400"/> تم رنگی متفاوت (Dark Mode)</span>
                                 </label>
                             </div>
                         )}
                     </div>
                 </div>

                 {/* 2. Client */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                     <h3 className="font-bold mb-4 flex items-center gap-2"><UserPlus size={18} className="text-primary-600"/> مشتری و پروژه</h3>
                     <div className="space-y-4">
                         <div>
                             <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium">مشتری <span className="text-red-500">*</span></label>
                                <button onClick={() => setShowClientModal(true)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus size={12}/> مشتری جدید</button>
                             </div>
                             <select 
                                id="client-select"
                                value={invoice.clientId || ''} 
                                onChange={e => {
                                    setInvoice({...invoice, clientId: e.target.value});
                                    if(errors.clientId) {
                                        const newErr = {...errors};
                                        delete newErr.clientId;
                                        setErrors(newErr);
                                    }
                                }} 
                                className={`w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border outline-none font-shabnam cursor-pointer transition ${errors.clientId ? 'border-red-500 ring-1 ring-red-500/20' : 'border-gray-200 dark:border-slate-700'}`}
                             >
                                 <option value="">انتخاب مشتری...</option>
                                 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                             </select>
                             {errors.clientId && <p className="text-xs text-red-500 mt-1">{errors.clientId}</p>}
                         </div>
                         <div>
                             <label className="block text-sm font-medium mb-1">پروژه مرتبط (اختیاری)</label>
                             <select value={invoice.projectId || ''} onChange={e => setInvoice({...invoice, projectId: e.target.value})} className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam cursor-pointer">
                                 <option value="">انتخاب پروژه...</option>
                                 {projects.filter(p => !invoice.clientId || p.sourceId === invoice.clientId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                             </select>
                         </div>
                     </div>
                 </div>

                 {/* 3. Branding */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                     <h3 className="font-bold mb-4 flex items-center gap-2"><ImageIcon size={18} className="text-primary-600"/> برندینگ و امضا</h3>
                     <div className="space-y-4">
                         <div>
                             <label className="block text-sm font-medium mb-2">لوگو فاکتور</label>
                             <div className="flex items-center gap-4">
                                 <div className="w-16 h-16 bg-gray-50 border rounded-lg flex items-center justify-center overflow-hidden">
                                     {invoice.logoUrl ? <img src={invoice.logoUrl} className="w-full h-full object-contain"/> : <ImageIcon className="text-gray-300"/>}
                                 </div>
                                 <label className="cursor-pointer bg-gray-100 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition font-bold text-gray-600">
                                     آپلود لوگو
                                     <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                                 </label>
                             </div>
                         </div>
                         <div>
                             <label className="block text-sm font-medium mb-2">امضای دیجیتال (رسم یا آپلود)</label>
                             <SignaturePad 
                                onSave={(data) => setInvoice({...invoice, signatureUrl: data})} 
                                onClear={() => setInvoice({...invoice, signatureUrl: undefined})}
                                existing={invoice.signatureUrl}
                             />
                         </div>
                     </div>
                 </div>
            </div>

            {/* Right Column: Items & Calc */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
                <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border ${errors.items ? 'border-red-500' : 'border-gray-100 dark:border-slate-700'} min-h-[500px] flex flex-col transition-colors`}>
                    <h3 className="font-bold mb-4 flex items-center gap-2"><PenTool size={18} className="text-primary-600"/> آیتم‌های فاکتور</h3>
                    {errors.items && <p className="text-xs text-red-500 mb-2">{errors.items}</p>}
                    
                    {/* Items Table */}
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500">
                                <tr>
                                    <th className="p-3 text-right rounded-r-xl">شرح کالا / خدمات</th>
                                    <th className="p-3 w-20 text-center">تعداد</th>
                                    <th className="p-3 w-40 text-center">مبلغ واحد</th>
                                    <th className="p-3 w-40 text-center">مبلغ کل</th>
                                    <th className="p-3 w-10 rounded-l-xl"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {invoice.items?.map((item, idx) => (
                                    <tr key={item.id} className="group">
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col gap-2">
                                                <input 
                                                    type="text"
                                                    className={`w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition font-shabnam font-bold text-sm text-gray-800 dark:text-gray-200 placeholder:font-normal placeholder:text-gray-400 ${errors[`item-${idx}-title`] ? 'border-red-500 ring-1 ring-red-500/20' : 'border-gray-200 dark:border-slate-700'}`}
                                                    placeholder="عنوان کالا / خدمات"
                                                    value={item.title}
                                                    onChange={e => handleItemChange(idx, 'title', e.target.value)}
                                                />
                                                {errors[`item-${idx}-title`] && <span className="text-xs text-red-500">{errors[`item-${idx}-title`]}</span>}
                                                <textarea 
                                                    rows={2}
                                                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition font-shabnam text-xs text-gray-600 dark:text-gray-400 placeholder:text-gray-400 resize-none leading-relaxed" 
                                                    placeholder="توضیحات تکمیلی (اختیاری) - مثلاً رنگ، سایز یا شرایط..."
                                                    value={item.description || ''}
                                                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <input 
                                                type="number"
                                                className="w-full px-2 py-2.5 text-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:border-primary-500 transition font-shabnam"
                                                value={item.quantity}
                                                onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="p-4 align-top">
                                             <CurrencyInput value={item.unitPrice} onChange={(v: number) => handleItemChange(idx, 'unitPrice', v)}/>
                                        </td>
                                        <td className="p-4 align-top text-center font-bold text-gray-700 dark:text-gray-300 font-shabnam text-base pt-5">
                                            {formatPriceInput(item.total.toString())}
                                        </td>
                                        <td className="p-4 align-top text-center pt-5">
                                            <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={addItem} className="mt-4 flex items-center gap-2 text-primary-600 text-sm font-bold hover:bg-primary-50 px-3 py-1.5 rounded-lg transition">
                            <Plus size={16}/> افزودن آیتم جدید
                        </button>
                    </div>

                    {/* Final Calculations */}
                    <div className="mt-8 border-t border-gray-100 dark:border-slate-700 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium mb-2">یادداشت برای مشتری</label>
                            <textarea 
                                rows={3}
                                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam"
                                placeholder="مثلاً شرایط پرداخت یا تشکر..."
                                value={invoice.notes || ''}
                                onChange={e => setInvoice({...invoice, notes: e.target.value})}
                            />
                            <label className="block text-sm font-medium mt-4 mb-2">اطلاعات پرداخت / حساب</label>
                            <textarea 
                                rows={2}
                                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none text-xs font-shabnam"
                                placeholder="شماره شبا یا کارت..."
                                value={invoice.providerNote || ''}
                                onChange={e => setInvoice({...invoice, providerNote: e.target.value})}
                            />
                        </div>
                        <div className="bg-gray-50 dark:bg-slate-900/50 p-6 rounded-2xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">جمع اقلام</span>
                                <span className="font-bold">{formatCurrency(subTotal)} {invoice.currency}</span>
                            </div>
                            
                            {/* Options Amount */}
                            {optionsAmount > 0 && (
                                <div className="flex justify-between text-sm text-blue-600">
                                    <span className="">آپشن‌های اضافی ({toPersianDigits(optionsPercent)}٪)</span>
                                    <span className="font-bold">{formatCurrency(optionsAmount)} +</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">تخفیف</span>
                                    <select 
                                        value={invoice.discountType} 
                                        onChange={e => setInvoice({...invoice, discountType: e.target.value as any})}
                                        className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs outline-none font-shabnam cursor-pointer focus:border-primary-500 transition h-[42px]"
                                    >
                                        <option value="Fixed">مبلغ</option>
                                        <option value="Percent">درصد</option>
                                    </select>
                                </div>
                                <div className="w-32">
                                     {invoice.discountType === 'Fixed' ? (
                                         <CurrencyInput value={invoice.discountValue} onChange={(v: number) => setInvoice({...invoice, discountValue: v})} placeholder="مبلغ"/>
                                     ) : (
                                         <input 
                                            type="text"
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-center font-shabnam outline-none focus:border-primary-500 transition"
                                            value={invoice.discountValue ? `${toPersianDigits(invoice.discountValue)} ٪` : ''}
                                            onChange={e => {
                                                const raw = toEnglishDigits(e.target.value).replace(/\D/g, '');
                                                const val = Number(raw);
                                                if (val <= 100) setInvoice({...invoice, discountValue: val});
                                            }}
                                            placeholder="درصد"
                                         />
                                     )}
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">مالیات (%)</span>
                                <div className="w-20">
                                     <input 
                                        type="text"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-2 py-2.5 text-center font-shabnam outline-none focus:border-primary-500 transition"
                                        value={toPersianDigits(invoice.taxPercent || 0)}
                                        onChange={e => {
                                            const val = Number(toEnglishDigits(e.target.value));
                                            if(!isNaN(val) && val <= 100) setInvoice({...invoice, taxPercent: val});
                                        }}
                                     />
                                </div>
                            </div>
                            <div className="border-t border-gray-200 dark:border-slate-600 my-2"></div>
                            
                            {/* Updated Final Amount Section */}
                            <div className="flex justify-between items-end bg-gray-200 dark:bg-slate-700 p-3 rounded-xl">
                                <span className="text-lg font-black text-gray-800 dark:text-white mb-1">مبلغ قابل پرداخت</span>
                                <div className="flex flex-col items-end">
                                    <span className="text-xl font-black text-gray-800 dark:text-white">{formatCurrency(finalAmount)} <span className="text-sm font-normal">{invoice.currency}</span></span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400 font-bold mt-1">{numberToWords(finalAmount, invoice.currency)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Client Modal */}
        <Modal isOpen={showClientModal} onClose={() => setShowClientModal(false)} title="افزودن مشتری جدید" size="sm">
             <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium mb-1">نام کامل</label>
                    <input 
                        value={newClient.name} 
                        onChange={e => setNewClient({...newClient, name: e.target.value})} 
                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam"
                        placeholder="نام مشتری"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">شماره تماس</label>
                    <input 
                        value={newClient.phone} 
                        onChange={e => setNewClient({...newClient, phone: e.target.value})} 
                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam dir-ltr text-right"
                        placeholder="0912..."
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">نوع</label>
                    <select 
                        value={newClient.type} 
                        onChange={e => setNewClient({...newClient, type: e.target.value as any})}
                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none font-shabnam"
                    >
                        <option value={ClientType.Client}>مشتری</option>
                        <option value={ClientType.Connection}>کانکشن</option>
                    </select>
                 </div>
                 <button onClick={handleCreateClient} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition">ثبت مشتری</button>
             </div>
        </Modal>
    </div>
  );
};

export default InvoiceEditor;
