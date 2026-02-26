
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Invoice, Client, AppSettings } from '../types';
import { toPersianDigits, formatCurrency, formatJalali, numberToWords, toEnglishDigits } from '../utils';
import { Printer, Download, ArrowRight, Loader2, AlertTriangle, CheckCircle, User, Phone, MapPin, CreditCard, FileText, Calendar, Hash, Mail } from 'lucide-react';

// Declare html2pdf from CDN
declare const html2pdf: any;

const InvoicePrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    // Force re-fetch logic to avoid stale state from navigation
    let isMounted = true;
    const loadData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // Add a small delay/fetch to ensure localstorage is consistent if redirected quickly
        const inv = await api.invoices.getById(id);
        
        if (inv && isMounted) {
          // Fetch fresh client data as well
          const [clientsData, settingsData] = await Promise.all([
            api.clients.getAll(),
            api.settings.get()
          ]);
          const foundClient = clientsData.find(c => c.id === inv.clientId) || null;
          
          setInvoice(inv);
          setClient(foundClient);
          setSettings(settingsData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if(isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [id]);

  const handlePrintBrowser = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const element = document.getElementById('invoice-paper');
    if (!element) {
        alert('خطا: محتوای فاکتور برای چاپ یافت نشد.');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=900,top=50,left=50');
    if (!printWindow) {
        alert('لطفاً اجازه باز شدن پنجره‌های پاپ‌آپ را بدهید.');
        return;
    }

    const content = element.outerHTML;

    const html = `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>چاپ فاکتور - ${invoice?.number ? toPersianDigits(invoice.number) : ''}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/font-face.css" rel="stylesheet" type="text/css" />
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        fontFamily: {
                            shabnam: ['Shabnam', 'sans-serif'], 
                        },
                        colors: {
                            primary: {
                                50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
                                400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
                                800: '#115e59', 900: '#134e4a',
                            }
                        }
                    }
                }
            }
        </script>
        <style>
            @page {
                size: A4;
                margin: 12mm; /* Standard safe print margin */
            }
            html, body {
                background-color: white;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                font-family: 'Shabnam', sans-serif;
            }
            #invoice-paper {
                margin: 0 auto !important;
                padding: 0 !important; /* Margins handled by @page */
                width: 100% !important;
                max-width: 100% !important;
                box-shadow: none !important;
                border: none !important;
                min-height: 0 !important; /* Prevent double-page issue due to fixed height + margins */
            }
            #invoice-paper * {
                box-sizing: border-box !important;
            }
            table { width: 100% !important; }
            img { max-width: 100% !important; }
            .keep-together { break-inside: avoid; }
            
            @media print {
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        </style>
      </head>
      <body>
        ${content}
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.focus();
                    window.print();
                }, 800);
            };
            window.onafterprint = function() {
                window.close();
            };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('invoice-paper');
    if (!element || !invoice) return;

    setGeneratingPdf(true);

    const safeTitle = (invoice.title || 'فاکتور').replace(/\s+/g, '-');
    const filename = `${safeTitle}-${toEnglishDigits(invoice.number)}.pdf`;
    
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        scrollY: 0,
        logging: false,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    try {
      await html2pdf().from(element).set(opt).save();
    } catch (err) {
      console.error('PDF Gen Error:', err);
      alert('خطا در تولید فایل PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const calculateOptionCost = (total: number, percent: number) => {
    return Math.round(total * (percent / 100));
  };

  const formatTextWithCardNumbers = (text: string) => {
      if (!text) return '';
      return text.replace(/\b\d{16}\b/g, (match) => {
          return match.match(/.{1,4}/g)?.join('-') || match;
      });
  };

  // Helper styles for mixed RTL/LTR text in PDF to fix parenthesis issues
  const bidiStyle: React.CSSProperties = {
      unicodeBidi: 'isolate',
      direction: 'rtl',
      textAlign: 'right'
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 font-shabnam">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary-600" size={40} />
          <p className="text-gray-500">در حال دریافت آخرین نسخه فاکتور...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 font-shabnam">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold mb-2">فاکتور یافت نشد</h2>
          <p className="text-gray-500 mb-6">ممکن است فاکتور حذف شده باشد یا شناسه آن اشتباه باشد.</p>
          <button onClick={() => navigate('/invoices')} className="bg-primary-600 text-white px-6 py-2 rounded-xl font-bold">بازگشت به لیست</button>
        </div>
      </div>
    );
  }

  // --- Calculations for Display ---
  const config = settings?.invoiceConfig || { extraLangPercent: 30, mobileRespPercent: 20, tabletRespPercent: 15, darkModePercent: 10 };
  const subTotal = invoice.subTotal || 0;
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 pb-20 font-shabnam print:bg-white print:pb-0">
      
      {/* Top Action Bar */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-800/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 p-4 mb-8 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate(`/invoices/edit/${invoice.id}`)} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition text-gray-600 dark:text-gray-300 flex items-center gap-2"
            >
              <ArrowRight size={20} />
              <span className="text-sm font-bold">بازگشت به ویرایش</span>
            </button>
            <div>
              <h1 className="font-bold text-gray-800 dark:text-white">پیش‌نمایش چاپ</h1>
              <p className="text-xs text-gray-500">شماره: {toPersianDigits(invoice.number)}</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button 
               type="button"
               onClick={handlePrintBrowser}
               className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold shadow-lg transition cursor-pointer"
             >
               <Printer size={18} />
               چاپ (نسخه کاغذی)
             </button>
             <button 
               onClick={handleDownloadPdf}
               disabled={generatingPdf}
               className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30 transition disabled:opacity-70 disabled:cursor-wait"
             >
               {generatingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
               {generatingPdf ? 'در حال ساخت PDF...' : 'دانلود فایل PDF'}
             </button>
          </div>
        </div>
      </div>

      {/* The Actual Invoice Paper (A4 Standard) */}
      <div className="max-w-[210mm] mx-auto print:max-w-none print:w-full">
        <div 
          id="invoice-paper" 
          className="bg-white text-black w-full min-h-[297mm] p-[15mm] shadow-2xl print:shadow-none print:p-0 print:min-h-0 relative flex flex-col box-border"
        >
            {/* 1. Header Section */}
            <div className="flex justify-between items-center mb-10 border-b border-gray-200 pb-6">
                {/* Title & Details (Right Side in RTL) */}
                <div className="text-right flex flex-col items-start w-2/3">
                    <h1 className="text-2xl font-black text-gray-900 mb-4" style={bidiStyle}>{invoice.title || 'فاکتور فروش'}</h1>
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">شماره:</span>
                            <span className="font-bold">{toPersianDigits(invoice.number)}</span>
                            <Hash size={14} className="text-gray-400"/>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">تاریخ:</span>
                            <span className="font-bold">{formatJalali(invoice.date || '')}</span>
                            <Calendar size={14} className="text-gray-400"/>
                        </div>
                    </div>
                </div>

                {/* Logo (Left Side in RTL) */}
                <div className="flex items-center gap-4 justify-end w-1/3">
                     {invoice.logoUrl ? (
                         <img src={invoice.logoUrl} className="h-24 w-auto object-contain max-w-[180px]"/>
                     ) : (
                         <div className="h-20 w-20 bg-gray-50 flex items-center justify-center text-gray-300 rounded-xl border border-dashed text-xs">لوگو</div>
                     )}
                </div>
            </div>

            {/* 2. Parties Section */}
            <div className="grid grid-cols-2 gap-8 mb-10 keep-together">
                {/* Seller */}
                <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                    <h3 className="text-gray-400 text-xs font-bold mb-4 uppercase tracking-wider">فروشنده</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                <User size={16}/>
                            </div>
                            <span className="font-bold text-gray-800 text-sm" style={bidiStyle}>{user?.firstName} {user?.lastName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                <Phone size={16}/>
                            </div>
                            <span className="font-medium text-gray-600 text-sm">{toPersianDigits(user?.username)}</span>
                        </div>
                        
                        {/* New Seller Info Fields */}
                        {invoice.sellerDetails?.email && (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                    <Mail size={16}/>
                                </div>
                                <span className="font-medium text-gray-600 text-sm">{invoice.sellerDetails.email}</span>
                            </div>
                        )}
                        {invoice.sellerDetails?.address && (
                            <div className="flex items-start gap-3 mt-1">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm border border-gray-100 shrink-0">
                                    <MapPin size={16}/>
                                </div>
                                <span className="font-medium text-gray-600 text-sm leading-6" style={bidiStyle}>
                                    {invoice.sellerDetails.address} {invoice.sellerDetails.zipCode && `- کدپستی: ${toPersianDigits(invoice.sellerDetails.zipCode)}`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Buyer */}
                <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                     <h3 className="text-gray-400 text-xs font-bold mb-4 uppercase tracking-wider">خریدار</h3>
                     {client ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                    <User size={16}/>
                                </div>
                                <span className="font-bold text-gray-800 text-sm" style={bidiStyle}>{client.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                    <Phone size={16}/>
                                </div>
                                <span className="font-medium text-gray-600 text-sm">{toPersianDigits(client.phone)}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-red-500 text-xs font-bold flex items-center gap-2"><AlertTriangle size={14}/> اطلاعات خریدار ثبت نشده است</p>
                    )}
                </div>
            </div>

            {/* 3. Items Table */}
            <div className="mb-8 rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-gray-600">
                            <th className="p-4 text-right text-xs font-bold border-b border-gray-200 w-16">#</th>
                            <th className="p-4 text-right text-xs font-bold border-b border-gray-200 w-[45%]">شرح کالا / خدمات</th>
                            <th className="p-4 text-center text-xs font-bold border-b border-gray-200">تعداد</th>
                            <th className="p-4 text-center text-xs font-bold border-b border-gray-200">مبلغ واحد</th>
                            <th className="p-4 text-center text-xs font-bold border-b border-gray-200 bg-gray-200/50 text-gray-800">مبلغ کل ({invoice.currency})</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-800">
                        {invoice.items?.map((item, i) => (
                            <tr key={item.id} className="group hover:bg-gray-50/50">
                                <td className="p-4 text-right font-medium text-gray-400 border-b border-gray-100 group-last:border-none">{toPersianDigits(i + 1)}</td>
                                <td className="p-4 border-b border-gray-100 group-last:border-none">
                                    <div className="font-bold text-gray-900" style={bidiStyle}>{item.title}</div>
                                    {item.description && <div className="text-xs text-gray-500 mt-1 leading-relaxed" style={bidiStyle}>{item.description}</div>}
                                </td>
                                <td className="p-4 text-center font-medium border-b border-gray-100 group-last:border-none">{toPersianDigits(item.quantity)}</td>
                                <td className="p-4 text-center font-medium text-gray-600 border-b border-gray-100 group-last:border-none">{formatCurrency(item.unitPrice)}</td>
                                <td className="p-4 text-center font-bold bg-gray-50/30 border-b border-gray-100 group-last:border-none">{formatCurrency(item.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 4. Smart Options Breakdown & Totals */}
            <div className="flex justify-end mb-12 keep-together">
                <div className="w-[50%] space-y-4">
                    
                    {/* Summary Box */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>جمع کل اقلام:</span>
                            <span className="font-bold text-gray-900">{formatCurrency(subTotal)} تومان</span>
                        </div>

                        {/* Explicit Smart Options Logic with Correct Toman Placement */}
                        {(invoice.projectType === 'Website' || invoice.projectType === 'Application') && invoice.options && (
                            <>
                                {invoice.options.hasExtraLanguage && (
                                    <div className="flex justify-between text-xs text-blue-600">
                                        <span className="flex items-center gap-1">زبان اضافه ({toPersianDigits(config.extraLangPercent)}٪)</span>
                                        <span className="font-bold" dir="ltr">{`+ تومان ${formatCurrency(calculateOptionCost(subTotal, config.extraLangPercent))}`}</span>
                                    </div>
                                )}
                                {invoice.options.hasMobileResp && (
                                    <div className="flex justify-between text-xs text-blue-600">
                                        <span className="flex items-center gap-1">ریسپانسیو موبایل ({toPersianDigits(config.mobileRespPercent)}٪)</span>
                                        <span className="font-bold" dir="ltr">{`+ تومان ${formatCurrency(calculateOptionCost(subTotal, config.mobileRespPercent))}`}</span>
                                    </div>
                                )}
                                {invoice.options.hasTabletResp && (
                                    <div className="flex justify-between text-xs text-blue-600">
                                        <span className="flex items-center gap-1">ریسپانسیو تبلت ({toPersianDigits(config.tabletRespPercent)}٪)</span>
                                        <span className="font-bold" dir="ltr">{`+ تومان ${formatCurrency(calculateOptionCost(subTotal, config.tabletRespPercent))}`}</span>
                                    </div>
                                )}
                                {invoice.options.hasDarkMode && (
                                    <div className="flex justify-between text-xs text-blue-600">
                                        <span className="flex items-center gap-1">تم دارک مود ({toPersianDigits(config.darkModePercent)}٪)</span>
                                        <span className="font-bold" dir="ltr">{`+ تومان ${formatCurrency(calculateOptionCost(subTotal, config.darkModePercent))}`}</span>
                                    </div>
                                )}
                            </>
                        )}

                        {(invoice.discountAmount || 0) > 0 && (
                            <div className="flex justify-between text-sm text-red-500">
                                <span>تخفیف:</span>
                                <span dir="ltr">{`- تومان ${formatCurrency(invoice.discountAmount!)}`}</span>
                            </div>
                        )}

                        {(invoice.taxAmount || 0) > 0 && (
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>مالیات و عوارض ({toPersianDigits(invoice.taxPercent!)}٪):</span>
                                <span dir="ltr">{`+ تومان ${formatCurrency(invoice.taxAmount!)}`}</span>
                            </div>
                        )}

                        <div className="border-t border-gray-200 my-2"></div>
                        
                        <div className="flex justify-between items-center pt-2">
                            <span className="font-bold text-gray-900 text-lg">مبلغ قابل پرداخت:</span>
                            <span className="font-black text-2xl text-gray-900">{formatCurrency(invoice.finalAmount)} <span className="text-sm font-normal text-gray-500">تومان</span></span>
                        </div>
                    </div>

                    {/* Word Amount Box (ONLY WORDS) */}
                    <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
                        <span className="text-xs text-gray-500 block mb-1">مبلغ به حروف</span>
                        <span className="font-bold text-gray-800 text-sm">{numberToWords(invoice.finalAmount, invoice.currency)}</span>
                    </div>
                </div>
            </div>

            {/* 5. Footer / Signatures - Keep Together for Page Breaks */}
            <div className="grid grid-cols-2 gap-12 mt-auto keep-together">
                <div className="flex flex-col h-full justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText size={16} className="text-gray-400"/>
                            <h4 className="font-bold text-sm text-gray-800">توضیحات و شرایط</h4>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                            <p className="text-xs text-justify leading-6 text-gray-600 min-h-[40px] whitespace-pre-wrap" style={bidiStyle}>
                                {invoice.notes || 'توضیحات تکمیلی وجود ندارد.'}
                            </p>
                        </div>
                    </div>
                    
                    {invoice.providerNote && (
                         <div className="mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <CreditCard size={16} className="text-gray-400"/>
                                <h5 className="font-bold text-xs text-gray-800">اطلاعات پرداخت</h5>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <p className="text-sm text-right font-bold text-gray-700 font-shabnam whitespace-pre-wrap">
                                    {formatTextWithCardNumbers(invoice.providerNote)}
                                </p>
                            </div>
                         </div>
                    )}
                </div>
                
                <div className="flex flex-col items-center justify-end">
                    <div className="h-32 flex items-center justify-center w-full mb-4 border-b border-dashed border-gray-300 pb-4">
                        {invoice.signatureUrl ? <img src={invoice.signatureUrl} className="h-full object-contain"/> : <span className="text-gray-300 text-xs">محل امضا</span>}
                    </div>
                    <div className="text-center font-bold text-sm text-gray-800">مهر و امضای فروشنده</div>
                </div>
            </div>
            
            <div className="text-center text-[10px] text-gray-400 mt-8 absolute bottom-4 left-0 right-0 print:block">
               ایجاد شده توسط سیستم مدیریت XRM
            </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;
