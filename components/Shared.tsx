import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Calendar as CalendarIcon, ChevronRight, ChevronLeft, Check, ChevronDown, Globe, CalendarRange, Clock, AlertCircle, CheckCircle, Info, AlertTriangle, XCircle, Trash2 } from 'lucide-react';
import { formatPriceInput, parsePriceInput, numberToWords, toPersianDigits, toEnglishDigits, daysBetween, getJalaliParts, getConversionDisplay, getRelativeDateLabel, formatJalali } from '../utils';
import { ToastMessage, ToastType } from '../types';

// --- Toast Component (Enhanced UI/UX) ---

// UI Configuration for Toast Types
const toastConfig = {
    success: { icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-100', iconColor: 'text-emerald-500' },
    error: { icon: XCircle, bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-800 dark:text-rose-100', iconColor: 'text-rose-500' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-100', iconColor: 'text-amber-500' },
    info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-100', iconColor: 'text-blue-500' },
};

interface ToastItemProps {
    toast: ToastMessage;
    removeToast: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, removeToast }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    
    // Timer Refs
    const timeoutRef = useRef<any>(null);
    const startTimeRef = useRef<number>(Date.now());
    const remainingTimeRef = useRef<number>(4500); // 4.5 seconds default

    const config = toastConfig[toast.type] || toastConfig.info;
    const Icon = config.icon;

    // Start or Resume Timer
    const startTimer = () => {
        startTimeRef.current = Date.now();
        timeoutRef.current = setTimeout(() => {
            handleClose();
        }, remainingTimeRef.current);
    };

    // Pause Timer
    const pauseTimer = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            const elapsed = Date.now() - startTimeRef.current;
            remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
        }
    };

    // Mount Logic
    useEffect(() => {
        // Trigger enter animation
        const enterTimeout = setTimeout(() => setIsVisible(true), 50);
        
        // Start auto-dismiss timer
        startTimer();

        return () => {
            clearTimeout(enterTimeout);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Hover Handlers (Pause/Resume)
    const handleMouseEnter = () => {
        setIsPaused(true);
        pauseTimer();
    };

    const handleMouseLeave = () => {
        setIsPaused(false);
        startTimer();
    };

    const handleClose = () => {
        setIsVisible(false);
        // Wait for exit animation to finish before unmounting
        setTimeout(() => {
            removeToast(toast.id);
        }, 300); 
    };

    return (
        <div 
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`
                pointer-events-auto w-full max-w-[350px] rounded-2xl p-4 shadow-lg border backdrop-blur-sm transition-all duration-300 transform font-shabnam flex items-start gap-3 relative overflow-hidden select-none mb-2
                ${config.bg} ${config.border}
                ${isVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-12 scale-95'}
            `}
            style={{ direction: 'rtl' }}
        >
            {/* Icon */}
            <div className={`shrink-0 mt-0.5 ${config.iconColor}`}>
                <Icon size={24} strokeWidth={2} />
            </div>

            {/* Content */}
            <div className={`flex-1 pt-0.5 ${config.text}`}>
                <p className="text-sm font-bold leading-relaxed">{toast.message}</p>
            </div>

            {/* Close Button */}
            <button 
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                className={`shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/10 -mt-1 -ml-2 ${config.text}`}
                title="بستن"
            >
                <X size={16} strokeWidth={3}/>
            </button>

            {/* Progress / Pause Indicator (Subtle visual cue) */}
            {isPaused && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-current opacity-20 w-full animate-pulse" />
            )}
        </div>
    );
};

export const ToastContainer = ({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: string) => void }) => {
    return (
        <div className="fixed bottom-6 left-6 z-[200] flex flex-col gap-2 pointer-events-none p-4 items-start">
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} removeToast={removeToast} />
            ))}
        </div>
    );
};

// --- Modal Component ---
export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: any) => {
  if (!isOpen) return null;
  
  const sizes: any = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className={`bg-white dark:bg-slate-800 w-full ${sizes[size]} rounded-3xl shadow-2xl flex flex-col max-h-[90vh] font-shabnam`} onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Currency Input ---
export const CurrencyInput = ({ value, onChange, label, required = false, placeholder = "0" }: any) => {
  const handleChange = (e: any) => {
    const rawValue = parsePriceInput(e.target.value);
    onChange(rawValue);
  };

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 font-shabnam">{label} {required && '*'}</label>}
      <input 
        type="text"
        value={value ? formatPriceInput(value.toString()) : ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none dir-ltr text-left font-shabnam font-bold tracking-wider"
      />
      {value > 0 && (
        <p className="text-xs text-primary-600 mt-1 text-right dir-rtl font-shabnam font-bold">{numberToWords(value)}</p>
      )}
    </div>
  );
};

// --- ENHANCED DATE PICKER ---

type ViewMode = 'day' | 'month' | 'year';
type CalendarSystem = 'jalali' | 'gregorian';

interface DatePickerProps {
    value?: string; // Jalali String: YYYY/MM/DD
    onChange?: (date: string) => void;
    
    // Range Support
    isRange?: boolean;
    startDate?: string;
    endDate?: string;
    onRangeChange?: (start: string, end: string) => void;

    label?: string;
    error?: boolean; // New Error Prop
    
    // New: Handle ISO return for backend
    onIsoChange?: (iso: string) => void;
}

const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const GREGORIAN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const JalaliDatePicker = ({ value, onChange, label, isRange, startDate, endDate, onRangeChange, error, onIsoChange }: DatePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Internal state
    // draftDate: Single mode selection
    // rangeStart/End: Range mode selection
    const [draftDate, setDraftDate] = useState<Date | null>(null);
    const [rangeStart, setRangeStart] = useState<Date | null>(null);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

    const [viewDate, setViewDate] = useState<Date>(new Date()); // Represents the month being viewed
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [calSystem, setCalSystem] = useState<CalendarSystem>('jalali');

    // Init Logic
    useEffect(() => {
        if (isOpen) {
            const initialStr = isRange ? startDate : value;
            if (initialStr) {
                 setViewDate(new Date()); 
            } else {
                 setViewDate(new Date());
            }
            setDraftDate(null);
            setRangeStart(null);
            setRangeEnd(null);
            setViewMode('day');
        }
    }, [isOpen]);

    // --- LOGIC ---

    const handleDayClick = (e: React.MouseEvent, date: Date) => {
        e.preventDefault();
        e.stopPropagation();
        if (isRange) {
            if (!rangeStart || (rangeStart && rangeEnd)) {
                setRangeStart(date);
                setRangeEnd(null);
            } else {
                if (date < rangeStart) {
                    setRangeEnd(rangeStart);
                    setRangeStart(date);
                } else {
                    setRangeEnd(date);
                }
            }
        } else {
            setDraftDate(date);
        }
    };

    const formatOutput = (d: Date) => {
        const parts = getJalaliParts(d, 'jalali');
        return toPersianDigits(`${parts.y}/${parts.m.toString().padStart(2, '0')}/${parts.d.toString().padStart(2, '0')}`);
    };

    const handleConfirm = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isRange) {
            if (rangeStart && rangeEnd && onRangeChange) {
                onRangeChange(formatOutput(rangeStart), formatOutput(rangeEnd));
                setIsOpen(false);
            } else if (rangeStart && !rangeEnd && onRangeChange) {
                 onRangeChange(formatOutput(rangeStart), formatOutput(rangeStart));
                 setIsOpen(false);
            }
        } else {
            if (draftDate && onChange) {
                onChange(formatOutput(draftDate));
                if (onIsoChange) onIsoChange(draftDate.toISOString());
                setIsOpen(false);
            }
        }
    };

    const handleToday = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const today = new Date();
        setViewDate(today);
        if (isRange) {
            setRangeStart(today);
            setRangeEnd(null);
        } else {
            setDraftDate(today);
        }
        setViewMode('day');
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setDate(newDate.getDate() + (delta * 30)); 
        setViewDate(newDate);
    };

    // --- GRID GENERATION ---
    const grid = useMemo(() => {
        const { y: cYear, m: cMonth } = getJalaliParts(viewDate, calSystem);
        let cursor = new Date(viewDate);
        cursor.setDate(15); 
        while (true) {
            const prev = new Date(cursor);
            prev.setDate(prev.getDate() - 1);
            const pParts = getJalaliParts(prev, calSystem);
            if (pParts.m !== cMonth) break;
            cursor = prev;
        }
        const firstDayOfMonth = new Date(cursor);
        const startDay = calSystem === 'jalali' 
            ? (firstDayOfMonth.getDay() + 1) % 7 
            : firstDayOfMonth.getDay();

        const days = [];
        let runner = new Date(firstDayOfMonth);
        while (true) {
            const parts = getJalaliParts(runner, calSystem);
            if (parts.m !== cMonth) break;
            days.push({ date: new Date(runner), dayNum: parts.d });
            runner.setDate(runner.getDate() + 1);
        }

        return { days, startDay, cYear, cMonth };
    }, [viewDate, calSystem]);

    const headerYear = calSystem === 'jalali' ? toPersianDigits(grid.cYear) : grid.cYear;
    const headerMonth = calSystem === 'jalali' ? JALALI_MONTHS[grid.cMonth - 1] : GREGORIAN_MONTHS[grid.cMonth - 1];

    const isDaySelected = (d: Date) => {
        if (isRange) {
             if (rangeStart && d.toDateString() === rangeStart.toDateString()) return 'start';
             if (rangeEnd && d.toDateString() === rangeEnd.toDateString()) return 'end';
             if (rangeStart && rangeEnd && d > rangeStart && d < rangeEnd) return 'mid';
             return false;
        } else {
             return draftDate && d.toDateString() === draftDate.toDateString() ? 'single' : false;
        }
    };

    const displayValue = isRange 
        ? (startDate && endDate ? `${formatJalali(startDate)} - ${formatJalali(endDate)}` : '')
        : (value ? value : '');
        
    const relativeLabel = !isRange && draftDate ? getRelativeDateLabel(draftDate) : '';
    const rangeDuration = isRange && rangeStart && rangeEnd 
        ? `${toPersianDigits(daysBetween(rangeStart, rangeEnd))} روز` 
        : '';

    return (
        <div className="w-full font-shabnam relative" onClick={e => e.stopPropagation()}>
            {label && <label className={`block text-sm font-medium mb-1 ${error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>{label} {error && '*'}</label>}
            
            {/* INPUT TRIGGER */}
            <div 
                onClick={(e) => { e.preventDefault(); setIsOpen(true); }}
                className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition shadow-sm group ${error ? 'border-red-500 ring-1 ring-red-500/20' : 'border-gray-200 dark:border-slate-700'}`}
            >
                <div className="flex flex-col justify-center">
                    <span className={`dir-ltr text-sm ${displayValue ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-400'}`}>
                        {displayValue || (isRange ? 'بازه انتخاب شده' : 'انتخاب تاریخ...')}
                    </span>
                    {!isRange && value && (
                         <span className="text-[10px] text-gray-400 h-0 overflow-hidden group-hover:h-auto transition-all">کلیک برای تغییر</span>
                    )}
                </div>
                {isRange ? <CalendarRange size={18} className={error ? 'text-red-400' : 'text-gray-500'}/> : <CalendarIcon size={18} className={error ? 'text-red-400' : 'text-gray-500'}/>}
            </div>

            {/* MODAL */}
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center isolate" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
                    
                    <div className="relative bg-white dark:bg-slate-800 w-[360px] rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col mx-4 font-shabnam" onClick={e => e.stopPropagation()}>
                        
                        <div className="bg-primary-50 dark:bg-slate-700/50 p-6 pb-4 flex flex-col border-b border-primary-100 dark:border-slate-600 transition-colors duration-300">
                             <div className="flex justify-between items-start mb-2">
                                 <span className="text-primary-600 dark:text-primary-300 text-xs font-bold uppercase tracking-wider">
                                     {isRange ? (rangeStart && rangeEnd ? 'بازه انتخاب شده' : 'انتخاب بازه') : 'انتخاب تاریخ'}
                                 </span>
                                 <button 
                                    type="button"
                                    onClick={() => setCalSystem(calSystem === 'jalali' ? 'gregorian' : 'jalali')}
                                    className="p-1.5 bg-white/50 hover:bg-white rounded-lg text-primary-700 transition shadow-sm"
                                    title="تغییر تقویم"
                                 >
                                    <Globe size={16}/>
                                 </button>
                             </div>
                             
                             <div className="flex items-baseline gap-2 text-2xl font-black text-gray-800 dark:text-white dir-ltr">
                                 {headerMonth} {headerYear}
                             </div>

                             <div className="mt-2 h-6 text-sm font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
                                 {isRange ? (
                                     rangeDuration ? <><Clock size={14}/> <span>مدت: {rangeDuration}</span></> : (rangeStart ? 'تاریخ پایان را انتخاب کنید' : 'تاریخ شروع را انتخاب کنید')
                                 ) : (
                                     relativeLabel ? <><Clock size={14}/> <span>{relativeLabel}</span></> : <span className="text-gray-400 font-normal text-xs">یک روز را انتخاب کنید</span>
                                 )}
                             </div>
                             
                             <div className="flex gap-2 mt-4">
                                 <button 
                                    type="button"
                                    onClick={() => setViewMode(viewMode === 'year' ? 'day' : 'year')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${viewMode === 'year' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}
                                 >
                                    سال {headerYear} <ChevronDown size={12}/>
                                 </button>
                                 <button 
                                    type="button"
                                    onClick={() => setViewMode(viewMode === 'month' ? 'day' : 'month')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${viewMode === 'month' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}
                                 >
                                    ماه {headerMonth} <ChevronDown size={12}/>
                                 </button>
                             </div>
                        </div>

                        <div className="p-4 h-[330px] overflow-y-auto custom-scrollbar relative">
                            {viewMode === 'day' && (
                                <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                                    <div className="flex justify-between items-center mb-4 px-1">
                                        <button type="button" onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition"><ChevronRight size={18}/></button>
                                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 select-none">{headerMonth} {headerYear}</span>
                                        <button type="button" onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition"><ChevronLeft size={18}/></button>
                                    </div>

                                    <div className={`grid grid-cols-7 mb-2 text-center ${calSystem === 'gregorian' ? 'dir-ltr' : ''}`}>
                                        {(calSystem === 'jalali' ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map(d => (
                                            <span key={d} className="text-xs text-gray-400 font-bold py-2">{d}</span>
                                        ))}
                                    </div>

                                    <div className={`grid grid-cols-7 gap-y-2 ${calSystem === 'gregorian' ? 'dir-ltr' : ''}`}>
                                        {Array.from({ length: grid.startDay }).map((_, i) => <div key={`pad-${i}`} />)}
                                        {grid.days.map((d, i) => {
                                            const status = isDaySelected(d.date);
                                            const isToday = d.date.toDateString() === new Date().toDateString();
                                            
                                            let bgClass = 'hover:bg-gray-100 dark:hover:bg-slate-700';
                                            let textClass = 'text-gray-700 dark:text-gray-300 font-medium';
                                            let roundedClass = 'rounded-full';
                                            
                                            if (status === 'single') {
                                                bgClass = 'bg-primary-600 shadow-md scale-105';
                                                textClass = 'text-white font-black';
                                            } else if (status === 'start') {
                                                bgClass = 'bg-primary-600 shadow-md z-10';
                                                textClass = 'text-white font-black';
                                                roundedClass = calSystem === 'jalali' ? 'rounded-r-full rounded-l-none' : 'rounded-l-full rounded-r-none';
                                            } else if (status === 'end') {
                                                bgClass = 'bg-primary-600 shadow-md z-10';
                                                textClass = 'text-white font-black';
                                                roundedClass = calSystem === 'jalali' ? 'rounded-l-full rounded-r-none' : 'rounded-r-full rounded-l-none';
                                            } else if (status === 'mid') {
                                                bgClass = 'bg-primary-100 dark:bg-primary-900/30';
                                                textClass = 'text-primary-700 dark:text-primary-300 font-bold';
                                                roundedClass = 'rounded-none';
                                            }

                                            if (status === 'start' && rangeEnd && d.date.toDateString() === rangeEnd.toDateString()) {
                                                roundedClass = 'rounded-full';
                                            }
                                            if (!isRange) roundedClass = 'rounded-full';

                                            return (
                                                <button
                                                    type="button"
                                                    key={i}
                                                    onClick={(e) => handleDayClick(e, d.date)}
                                                    className={`
                                                        h-10 w-full flex items-center justify-center text-sm transition-all duration-200 relative
                                                        ${roundedClass}
                                                        ${bgClass}
                                                        ${textClass}
                                                        ${isToday && !status ? 'border-2 border-primary-200 text-primary-600 font-bold' : ''}
                                                    `}
                                                >
                                                    {calSystem === 'jalali' ? toPersianDigits(d.dayNum) : d.dayNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {viewMode === 'year' && (
                                <div className="grid grid-cols-3 gap-3 animate-in zoom-in-90 duration-300">
                                    {Array.from({length: 100}).map((_, i) => {
                                        const y = grid.cYear - 50 + i;
                                        return (
                                            <button 
                                                type="button"
                                                key={y} 
                                                onClick={() => {
                                                    const diff = y - grid.cYear;
                                                    const n = new Date(viewDate);
                                                    n.setFullYear(n.getFullYear() + diff); 
                                                    setViewDate(n);
                                                    setViewMode('day');
                                                }}
                                                className={`py-3 rounded-xl text-sm font-bold ${y === grid.cYear ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                {calSystem === 'jalali' ? toPersianDigits(y) : y}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {viewMode === 'month' && (
                                <div className="grid grid-cols-2 gap-3 animate-in zoom-in-90 duration-300">
                                    {(calSystem === 'jalali' ? JALALI_MONTHS : GREGORIAN_MONTHS).map((m, i) => (
                                        <button 
                                            type="button"
                                            key={m}
                                            onClick={() => {
                                                let targetM = i + 1;
                                                let currM = grid.cMonth;
                                                const delta = targetM - currM; 
                                                changeMonth(delta);
                                                setViewMode('day');
                                            }}
                                            className={`py-4 rounded-xl text-sm font-bold ${i + 1 === grid.cMonth ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 border-t border-gray-200 dark:border-slate-700">
                             <div className="flex gap-3">
                                 <button 
                                    type="button"
                                    onClick={handleToday}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 transition"
                                 >
                                    برو به امروز
                                 </button>
                                 <div className="flex-1"></div>
                                 <button 
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setIsOpen(false); }}
                                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition"
                                 >
                                    انصراف
                                 </button>
                                 <button 
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isRange ? (!rangeStart || !rangeEnd) : !draftDate}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20 transition flex items-center gap-2"
                                 >
                                    <Check size={16}/> تأیید
                                 </button>
                             </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export const ConfirmActionDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "حذف مورد", 
  message = "این عمل قابل بازگشت نیست. حذف انجام شود؟", 
  confirmText = "حذف", 
  cancelText = "انصراف", 
  isDestructive = true 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title?: string; 
  message?: string; 
  confirmText?: string; 
  cancelText?: string; 
  isDestructive?: boolean; 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden font-shabnam" onClick={e => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-500' : 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-500'}`}>
            {isDestructive ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              onClick={() => { onConfirm(); onClose(); }} 
              className={`flex-1 py-3 rounded-xl font-bold text-white transition shadow-lg ${isDestructive ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};