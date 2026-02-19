
import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../App';
import { Project, Client, Transaction, Task, UserRole, TransactionType, Log, User } from '../types';
import { toPersianDigits, formatCurrency, getDailyMessage, getRelativeDateLabel, formatJalali, daysBetween, getJalaliParts } from '../utils';
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ReferenceLine, ComposedChart } from 'recharts';
import { 
    TrendingUp, AlertCircle, CheckCircle, Trash2, Target, 
    Zap, DollarSign, Activity, Clock, ListChecks, ShieldCheck, 
    HeartPulse, ArrowUpRight, ArrowDownRight, Briefcase, 
    CheckSquare, ChevronLeft, GripHorizontal, MoveDiagonal,
    Lock, LockOpen, RotateCcw, Layout, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowLeft,
    Filter, Calendar, Eye, EyeOff, Users as UsersIcon, Award, Sparkles, FolderOpen, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- TYPES & CONFIG ---

interface WidgetLayout {
    id: string;
    colSpan: number; // 1 to 12
    order: number;
}

// Default Layout matching the original design
const DEFAULT_LAYOUT: WidgetLayout[] = [
    { id: 'hero', colSpan: 12, order: 0 },
    { id: 'kpi-1', colSpan: 3, order: 1 },
    { id: 'kpi-2', colSpan: 3, order: 2 },
    { id: 'kpi-3', colSpan: 3, order: 3 },
    { id: 'kpi-4', colSpan: 3, order: 4 },
    { id: 'tasks', colSpan: 8, order: 5 },
    { id: 'risks', colSpan: 4, order: 6 },
    { id: 'finance-chart', colSpan: 8, order: 7 },
    { id: 'finance-summary', colSpan: 4, order: 8 },
    { id: 'activity', colSpan: 12, order: 9 },
];

const SNAP_POINTS = [3, 4, 6, 8, 9, 12]; // Logical column spans (25%, 33%, 50%, 66%, 75%, 100%)

const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

// --- COMPONENTS ---

// 1. KPI Compact Card (Unchanged Visuals)
const KpiCard = ({ title, value, prevValue, icon: Icon, colorTheme, subText }: any) => {
    let growth = 0;
    if (prevValue > 0) growth = Math.round(((value - prevValue) / prevValue) * 100);
    else if (value > 0) growth = 100;

    const isExpense = colorTheme === 'red';
    
    let trendColor = 'text-gray-400';
    let trendBg = 'bg-gray-50 dark:bg-slate-700';
    
    if (growth !== 0) {
        if (isExpense) {
             if(growth > 0) { trendColor = 'text-red-600'; trendBg = 'bg-red-50 dark:bg-red-900/20'; }
             else { trendColor = 'text-emerald-600'; trendBg = 'bg-emerald-50 dark:bg-emerald-900/20'; }
        } else {
             if(growth > 0) { trendColor = 'text-emerald-600'; trendBg = 'bg-emerald-50 dark:bg-emerald-900/20'; }
             else { trendColor = 'text-red-600'; trendBg = 'bg-red-50 dark:bg-red-900/20'; }
        }
    }

    const colorClasses: any = {
        emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
        amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 group h-full select-none">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClasses[colorTheme] || colorClasses.blue} group-hover:scale-110 transition-transform`}>
                    <Icon size={24} strokeWidth={2} />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <h3 className="text-xl font-black text-gray-800 dark:text-white tracking-tight">
                        {typeof value === 'number' && !subText ? toPersianDigits(value) : value}
                    </h3>
                    {subText && <p className="text-[10px] text-gray-400 mt-0.5">{subText}</p>}
                </div>
            </div>
            
            {growth !== 0 && !subText && (
                <div className={`flex flex-col items-end ${trendBg} px-2 py-1 rounded-lg`}>
                    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trendColor}`}>
                        {growth > 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                        <span dir="ltr">%{toPersianDigits(Math.abs(growth))}</span>
                    </div>
                    <span className="text-[9px] text-gray-400">روند</span>
                </div>
            )}
        </div>
    );
};

const TaskItem = ({ task, onToggle, onDelete }: any) => {
    const isLate = !task.isDone && task.deadline && new Date(task.deadline) < new Date();
    return (
        <div className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-sm
            ${task.isDone 
                ? 'bg-gray-50 border-gray-100 opacity-60 dark:bg-slate-800/50 dark:border-slate-700' 
                : 'bg-white border-gray-100 hover:border-primary-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600'
            }`}
            onClick={() => onToggle(task)}
        >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                ${task.isDone 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : isLate ? 'border-red-400 text-transparent hover:border-red-500' : 'border-gray-300 text-transparent hover:border-primary-500'
                }`}
            >
                <CheckCircle size={14} className={task.isDone ? 'scale-100' : 'scale-0'} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate transition-all ${task.isDone ? 'text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                    {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    {task.deadline && (
                        <span className={`text-[10px] flex items-center gap-1 ${
                            task.isDone ? 'text-gray-400' : isLate ? 'text-red-500 font-bold' : 'text-gray-400'
                        }`}>
                            <Clock size={10} />
                            {isLate && !task.isDone ? 'مهلت تمام شده' : toPersianDigits(getRelativeDateLabel(new Date(task.deadline)))}
                        </span>
                    )}
                    {!task.assignedTo && <span className="text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 rounded">شخصی</span>}
                </div>
            </div>
            <button onClick={(e) => onDelete(e, task.id)} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-0 group-hover:opacity-100">
                <Trash2 size={16} />
            </button>
        </div>
    );
};

// --- DRAGGABLE & RESIZABLE WIDGET WRAPPER ---
const DraggableWidget = ({ 
    id, colSpan, children, onDragStart, onDrop, onDragEnter, isDragOver, onResize, isEditMode 
}: any) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHint, setResizeHint] = useState<string | null>(null);

    const getColClass = (span: number) => {
        if (span >= 12) return 'lg:col-span-12 md:col-span-12';
        if (span >= 8) return 'lg:col-span-8 md:col-span-12';
        if (span >= 6) return 'lg:col-span-6 md:col-span-6';
        if (span >= 4) return 'lg:col-span-4 md:col-span-6';
        if (span >= 3) return 'lg:col-span-3 md:col-span-6';
        return 'lg:col-span-2 md:col-span-6';
    };

    const getWidthLabel = (span: number) => {
        if (span === 12) return 'تمام عرض (100%)';
        if (span === 8) return 'دو سوم (66%)';
        if (span === 6) return 'نصف عرض (50%)';
        if (span === 4) return 'یک سوم (33%)';
        if (span === 3) return 'یک چهارم (25%)';
        return `${toPersianDigits(Math.round((span/12)*100))}%`;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = ref.current?.offsetWidth || 0;
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!ref.current) return;
            const parentWidth = ref.current.parentElement?.offsetWidth || 1000;
            const oneColWidth = parentWidth / 12;
            const deltaX = startX - moveEvent.clientX; 
            const newPixelWidth = startWidth + deltaX;
            let rawColSpan = Math.round(newPixelWidth / oneColWidth);
            const snappedColSpan = SNAP_POINTS.reduce((prev, curr) => 
                Math.abs(curr - rawColSpan) < Math.abs(prev - rawColSpan) ? curr : prev
            );
            const finalColSpan = Math.max(3, Math.min(12, snappedColSpan));
            setResizeHint(getWidthLabel(finalColSpan));
            if (finalColSpan !== colSpan) {
                onResize(id, finalColSpan);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            setResizeHint(null);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div 
            ref={ref}
            className={`${getColClass(colSpan)} col-span-12 relative group transition-all duration-300 ease-out ${isDragOver ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'} ${isResizing ? 'z-50' : 'z-auto'}`}
            draggable={isEditMode && !isResizing}
            onDragStart={(e) => {
                if (!isEditMode) return;
                e.dataTransfer.setData('widgetId', id);
                e.dataTransfer.effectAllowed = 'move';
                const img = new Image();
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; 
                e.dataTransfer.setDragImage(img, 0, 0);
                onDragStart();
            }}
            onDragOver={(e) => {
                if (!isEditMode) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                onDragEnter(id);
            }}
            onDrop={(e) => {
                if (!isEditMode) return;
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('widgetId');
                onDrop(draggedId, id);
            }}
        >
            {isDragOver && (
                <div className="absolute inset-0 border-2 border-dashed border-primary-400 bg-primary-50/50 rounded-[32px] z-30 animate-pulse pointer-events-none"></div>
            )}
            {isEditMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing p-1.5 bg-white/80 dark:bg-black/50 backdrop-blur rounded-full shadow-sm animate-in fade-in zoom-in duration-200">
                    <GripHorizontal size={20} className="text-gray-600 dark:text-gray-300"/>
                </div>
            )}
            <div className={`h-full w-full transition-all duration-200 ${isEditMode ? 'pointer-events-none select-none' : ''}`}>
                {children}
            </div>
            {isEditMode && id !== 'hero' && (
                <>
                    <div 
                        className="absolute bottom-2 left-2 z-20 cursor-sw-resize p-2 bg-white/80 dark:bg-slate-700/80 backdrop-blur rounded-lg shadow-sm hover:bg-primary-50 dark:hover:bg-slate-600 transition animate-in fade-in zoom-in duration-200"
                        onMouseDown={handleMouseDown}
                    >
                        <MoveDiagonal size={16} className="text-gray-600 dark:text-gray-300 rotate-90"/>
                    </div>
                    {isResizing && resizeHint && (
                        <div className="absolute bottom-10 left-0 bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg z-50 whitespace-nowrap">
                            {resizeHint}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// --- SUB-WIDGET COMPONENTS ---

const HeroWidget = ({ healthStatus, activeTasks, overdueProjects, nearDeadlineProjects, unpaidInvoices, navigate, getHeroMessage, getHeroGradient }: any) => (
    <div className={`w-full h-full rounded-[32px] bg-gradient-to-r ${getHeroGradient()} p-6 md:p-8 text-white shadow-2xl relative overflow-hidden transition-all duration-500 flex flex-col justify-center`}>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/20 flex items-center gap-2">
                        {healthStatus === 'Healthy' ? <ShieldCheck size={14}/> : <HeartPulse size={14} className="animate-pulse"/>}
                        {healthStatus === 'Healthy' ? 'وضعیت پایدار' : healthStatus === 'Attention' ? 'نیاز به بررسی' : 'وضعیت پرریسک'}
                    </span>
                    <span className="text-white/60 text-xs font-medium">{formatJalali(new Date().toISOString())}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black mb-3 leading-tight tracking-tight">نمای کلی امروز</h1>
                <p className="text-sm md:text-base font-medium opacity-95 max-w-2xl leading-relaxed">
                    {getHeroMessage()}
                </p>
            </div>
            <div className="flex flex-wrap gap-3">
                {healthStatus !== 'Healthy' && (
                    <button onClick={() => navigate('/projects')} className="bg-white text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 active:scale-95">
                        <AlertCircle size={16} className="text-red-500"/>
                        <span>{toPersianDigits(overdueProjects.length + nearDeadlineProjects.length)} ریسک پروژه</span>
                    </button>
                )}
                <button onClick={() => document.getElementById('task-widget')?.scrollIntoView({ behavior: 'smooth' })} className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/20 transition">
                    <ListChecks size={16}/>
                    <span>{toPersianDigits(activeTasks.length)} تسک باز</span>
                </button>
                {unpaidInvoices.length > 0 && (
                    <button onClick={() => navigate('/invoices')} className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/20 transition">
                        <DollarSign size={16}/>
                        <span>{toPersianDigits(unpaidInvoices.length)} فاکتور معوق</span>
                    </button>
                )}
            </div>
        </div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-black/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
    </div>
);

const TasksWidget = ({ displayTasks, activeTaskTab, setActiveTaskTab, handleToggleTask, handleDeleteTask }: any) => (
    <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden h-full min-h-[450px]" id="task-widget">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <CheckSquare className="text-primary-600"/> تسک‌های من
                </h3>
                <p className="text-xs text-gray-400 mt-1">مدیریت کارهای روزانه</p>
            </div>
            <div className="bg-gray-100 dark:bg-slate-700 p-1 rounded-xl flex gap-1">
                <button onClick={() => setActiveTaskTab('Active')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTaskTab === 'Active' ? 'bg-white dark:bg-slate-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>در جریان</button>
                <button onClick={() => setActiveTaskTab('Done')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTaskTab === 'Done' ? 'bg-white dark:bg-slate-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>انجام شده</button>
            </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-2">
            {displayTasks.length > 0 ? displayTasks.map((t: any) => (
                <TaskItem key={t.id} task={t} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
            )) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
                    <Target size={48} className="mb-4 opacity-20"/>
                    <p className="font-bold text-sm">لیست شما خالی است!</p>
                </div>
            )}
        </div>
    </div>
);

const RisksWidget = ({ nearDeadlineProjects, overdueProjects, overdueTasks, unpaidInvoices, navigate, daysBetween }: any) => (
    <div className="flex flex-col gap-6 h-full">
        <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-gray-100 dark:border-slate-700 shadow-sm p-6 flex-1">
            <h3 className="text-base font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={20}/> ریسک‌ها و توجهات
            </h3>
            <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-red-500 text-xs font-black shadow-sm">
                            {toPersianDigits(nearDeadlineProjects.length + overdueProjects.length)}
                        </div>
                        <span className="text-xs font-bold text-red-700 dark:text-red-300">پروژه حساس</span>
                    </div>
                    <ChevronLeft size={16} className="text-red-400"/>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-amber-500 text-xs font-black shadow-sm">
                            {toPersianDigits(overdueTasks.length)}
                        </div>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">تسک عقب‌افتاده</span>
                    </div>
                    <ChevronLeft size={16} className="text-amber-400"/>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-blue-500 text-xs font-black shadow-sm">
                            {toPersianDigits(unpaidInvoices.length)}
                        </div>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">فاکتور تسویه نشده</span>
                    </div>
                    <ChevronLeft size={16} className="text-blue-400"/>
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-gray-100 dark:border-slate-700 shadow-sm p-6 flex-1">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-gray-800 dark:text-white">پروژه‌های نیازمند توجه</h3>
                <button onClick={() => navigate('/projects')} className="text-[10px] text-primary-600 bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100">مشاهده همه</button>
            </div>
            
            <div className="space-y-3">
                {[...overdueProjects, ...nearDeadlineProjects].slice(0, 3).map((p: any) => {
                    const days = p.deadline ? daysBetween(new Date(), new Date(p.deadline)) : 0;
                    const isLate = p.deadline && new Date(p.deadline) < new Date();
                    return (
                        <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition cursor-pointer" onClick={() => navigate('/projects')}>
                            <div className={`w-2 h-8 rounded-full ${isLate ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{p.title}</p>
                                <p className="text-[10px] text-gray-400">{isLate ? 'زمان تمام شده' : `${toPersianDigits(days)} روز مانده`}</p>
                            </div>
                        </div>
                    );
                })}
                {[...overdueProjects, ...nearDeadlineProjects].length === 0 && (
                    <div className="text-center py-6 text-gray-400">
                        <CheckCircle size={24} className="mx-auto mb-2 text-emerald-500 opacity-50"/>
                        <p className="text-xs">هیچ پروژه پرریسکی وجود ندارد.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const FinanceChartWidget = ({ transactions }: { transactions: Transaction[] }) => {
    const data = useMemo(() => {
        const last6Months = [];
        const today = new Date();
        const { y: cY, m: cM } = getJalaliParts(today);
        
        // Generate last 6 months keys
        for (let i = 5; i >= 0; i--) {
            let m = cM - i;
            let y = cY;
            if (m <= 0) {
                m += 12;
                y -= 1;
            }
            last6Months.push({ name: JALALI_MONTHS[m - 1], key: `${y}-${m}`, income: 0, expense: 0 });
        }

        transactions.forEach(t => {
            if (t.status === 'Cancelled') return;
            const { y, m } = getJalaliParts(new Date(t.date));
            const key = `${y}-${m}`;
            const bucket = last6Months.find(b => b.key === key);
            if (bucket) {
                if (t.type === TransactionType.Income) bucket.income += t.amount;
                else if (t.type === TransactionType.Expense) bucket.expense += t.amount;
            }
        });

        return last6Months;
    }, [transactions]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-gray-100 dark:border-slate-700 shadow-sm p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Activity size={20} className="text-blue-500"/> نمودار مالی
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">روند درآمد و هزینه ۶ ماه اخیر</p>
                </div>
            </div>
            <div className="flex-1 w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5}/>
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#94a3b8'}} 
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#94a3b8'}}
                            tickFormatter={(val) => `${val / 1000000}M`}
                        />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            formatter={(val: number) => formatCurrency(val)}
                            labelStyle={{fontFamily: 'Shabnam', marginBottom: '4px', color: '#64748b'}}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="income" 
                            stroke="#10b981" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorIncome)" 
                            name="درآمد"
                        />
                        <Area 
                            type="monotone" 
                            dataKey="expense" 
                            stroke="#ef4444" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorExpense)" 
                            name="هزینه"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const FinanceSummaryWidget = ({ netProfit, incomeThisMonth, incomeLastMonth, expenseLastMonth, navigate }: any) => {
    const incomeGrowth = incomeLastMonth > 0 ? ((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100 : 100;
    
    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[32px] shadow-xl p-6 text-white h-full flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-slate-400 text-xs font-bold mb-1">سود خالص (ماه جاری)</p>
                        <h3 className="text-3xl font-black tracking-tight">{formatCurrency(netProfit)} <span className="text-sm font-medium text-slate-500">تومان</span></h3>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                        <Wallet size={24} className="text-emerald-400"/>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white/5 p-3 rounded-xl flex items-center justify-between border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <ArrowUpCircle size={16}/>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400 block">درآمد کل</span>
                                <span className="font-bold text-sm">{formatCurrency(incomeThisMonth)}</span>
                            </div>
                        </div>
                        <div className={`text-[10px] font-bold ${incomeGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {incomeGrowth >= 0 ? '+' : ''}{toPersianDigits(Math.round(incomeGrowth))}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10 mt-6">
                <button 
                    onClick={() => navigate('/finance')}
                    className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition shadow-lg flex items-center justify-center gap-2"
                >
                    مدیریت مالی <ArrowLeft size={16}/>
                </button>
            </div>
        </div>
    );
};

const ActivityWidget = ({ recentLogs }: any) => (
    <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-gray-100 dark:border-slate-700 shadow-sm p-6 h-full">
        <h3 className="font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
            <Zap size={20} className="text-amber-500 fill-amber-500"/> فعالیت‌های اخیر سیستم
        </h3>
        <div className="space-y-4">
            {recentLogs.length > 0 ? recentLogs.map((log: any, idx: number) => (
                <div key={log.id} className="flex items-start gap-4 relative">
                    {idx !== recentLogs.length - 1 && (
                        <div className="absolute top-8 right-[15px] bottom-[-16px] w-[2px] bg-gray-100 dark:bg-slate-700"></div>
                    )}
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-slate-700 flex items-center justify-center text-blue-50 shrink-0 z-10 border-4 border-white dark:border-slate-800">
                        <Activity size={14}/>
                    </div>
                    <div className="flex-1 pt-1">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                            <span className="text-primary-600">{log.action}</span> - {log.details}
                        </p>
                        <span className="text-[10px] text-gray-400">{formatJalali(log.timestamp)} - {new Date(log.timestamp).toLocaleTimeString('fa-IR')}</span>
                    </div>
                </div>
            )) : (
                 <div className="text-center text-gray-400 py-4 text-xs">فعالیتی ثبت نشده است.</div>
            )}
        </div>
    </div>
);

// --- NEW CLIENT DASHBOARD (RESTRICTED VIEW) ---

const ClientDashboard = ({ user, projects }: { user: User, projects: Project[] }) => {
    const navigate = useNavigate();

    // 1. Data Filtering (Strictly scoped to Client ID)
    const clientProjects = useMemo(() => projects.filter(p => p.sourceId === user.id), [projects, user.id]);
    
    // 2. Stats Calculation
    const activeProjects = clientProjects.filter(p => p.status === 'Active');
    const completedProjects = clientProjects.filter(p => p.status === 'Completed');
    
    const collaborationDays = useMemo(() => {
        if (clientProjects.length === 0) return 0;
        const dates = clientProjects.map(p => new Date(p.createdAt).getTime());
        const firstDate = Math.min(...dates);
        return daysBetween(new Date(), new Date(firstDate));
    }, [clientProjects]);

    return (
        <div className="font-shabnam space-y-8 w-full max-w-[1200px] mx-auto pb-12">
            
            {/* 1. Calm Welcome Banner */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">سلام {user.firstName} عزیز</h1>
                    <p className="text-sm text-gray-500 max-w-xl leading-relaxed">
                        خوشحالیم که با شما همکاری می‌کنیم. در اینجا می‌توانید وضعیت لحظه‌ای پروژه‌های خود را مشاهده کنید.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="text-center px-4 border-r border-gray-100 dark:border-slate-700">
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block">{toPersianDigits(activeProjects.length)}</span>
                        <span className="text-xs text-gray-400">پروژه فعال</span>
                    </div>
                    <div className="text-center px-4">
                        <span className="text-2xl font-black text-gray-800 dark:text-white block">{toPersianDigits(collaborationDays)}</span>
                        <span className="text-xs text-gray-400">روز همکاری</span>
                    </div>
                </div>
            </div>

            {/* 2. Projects List (Client View) */}
            <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <FolderOpen size={20} className="text-blue-600"/> وضعیت پروژه‌ها
                </h3>
                
                {clientProjects.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {clientProjects.map(p => {
                            const daysLeft = p.deadline ? daysBetween(new Date(), new Date(p.deadline)) : 0;
                            const isLate = p.deadline && new Date(p.deadline) < new Date();
                            const startDate = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
                            const totalDuration = p.deadline ? daysBetween(startDate, new Date(p.deadline)) : 100;
                            const progress = p.deadline ? Math.min(100, Math.max(0, 100 - (daysLeft / totalDuration * 100))) : 0;

                            return (
                                <div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-center">
                                    <div className="flex-1 w-full">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-lg text-gray-800 dark:text-white">{p.title}</h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                p.status === 'Active' ? 'bg-blue-50 text-blue-600' : 
                                                p.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {p.status === 'Active' ? 'در حال اجرا' : p.status === 'Completed' ? 'تکمیل شده' : p.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-4">{p.description || 'توضیحات ثبت نشده است.'}</p>
                                        
                                        {/* Time Progress Bar */}
                                        {p.status === 'Active' && p.deadline && (
                                            <div className="w-full">
                                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                    <span>پیشرفت زمانی</span>
                                                    <span>{isLate ? 'زمان تحویل گذشته' : `${toPersianDigits(Math.round(progress))}%`}</span>
                                                </div>
                                                <div className="h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-1000 ${isLate ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                        style={{width: `${isLate ? 100 : progress}%`}}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Meta Stats */}
                                    <div className="flex gap-4 w-full md:w-auto border-t md:border-t-0 md:border-r border-gray-100 dark:border-slate-700 pt-4 md:pt-0 md:pr-6 justify-center md:justify-end">
                                        <div className="text-center min-w-[80px]">
                                            <div className="w-10 h-10 mx-auto bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-500 mb-1">
                                                <UsersIcon size={18}/>
                                            </div>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">{toPersianDigits(p.members.length)} نفر</span>
                                            <span className="text-[10px] text-gray-400">تیم پروژه</span>
                                        </div>
                                        {p.deadline && (
                                            <div className="text-center min-w-[80px]">
                                                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${isLate ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                    <Clock size={18}/>
                                                </div>
                                                <span className={`text-xs font-bold block ${isLate ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {isLate ? 'گذشته' : `${toPersianDigits(daysLeft)} روز`}
                                                </span>
                                                <span className="text-[10px] text-gray-400">زمان باقی‌مانده</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-slate-700">
                        <Info size={48} className="mx-auto text-blue-200 mb-4"/>
                        <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">هنوز پروژه‌ای ثبت نشده است</h4>
                        <p className="text-sm text-gray-500">پس از شروع همکاری، وضعیت پروژه‌های شما از این بخش قابل مشاهده خواهد بود.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- TEAM MEMBER DASHBOARD (REDESIGNED BANNER) ---

const TeamMemberDashboard = ({ user, projects, tasks, users }: { user: User, projects: Project[], tasks: Task[], users: User[] }) => {
    // Copying logic to ensure no regression
    const myProjects = useMemo(() => projects.filter(p => p.members.includes(user.id)), [projects, user.id]);
    
    const stats = useMemo(() => {
        const totalProjects = myProjects.length;
        const activeProjects = myProjects.filter(p => p.status === 'Active').length;
        const completedProjects = myProjects.filter(p => p.status === 'Completed').length;
        const totalIncome = myProjects.reduce((acc, p) => acc + (p.memberAllocations?.[user.id] || 0), 0);
        let totalDays = 0;
        myProjects.forEach(p => {
            const start = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
            let end = new Date();
            if (p.status === 'Completed' && p.completedAt) end = new Date(p.completedAt);
            else if (p.deadline) end = new Date(p.deadline);
            const days = Math.max(0, daysBetween(end, start));
            totalDays += days;
        });
        const collaboratorSet = new Set<string>();
        myProjects.forEach(p => {
            p.members.forEach(memberId => {
                if (memberId !== user.id) collaboratorSet.add(memberId);
            });
        });
        const uniqueCollaborators = collaboratorSet.size;
        const avgDuration = totalProjects > 0 ? Math.round(totalDays / totalProjects) : 0;

        return { totalProjects, activeProjects, completedProjects, totalIncome, totalDays, uniqueCollaborators, avgDuration };
    }, [myProjects, user.id]);

    const smartMessage = useMemo(() => {
        if (stats.completedProjects > stats.activeProjects && stats.totalProjects > 2) return `عملکرد عالی! تمرکز روی کیفیت پروژه‌ها اولویت است.`;
        if (stats.uniqueCollaborators > 4) return `شبکه همکاری شما در حال گسترش است.`;
        return "امروز فرصت خوبی برای پیشبرد تسک‌های باقی‌مانده است.";
    }, [stats]);

    return (
        <div className="font-shabnam space-y-6 w-full max-w-[1600px] mx-auto pb-12">
             
             {/* REDESIGNED HEADER BANNER (Context Header) */}
             <div className="bg-slate-900 text-white rounded-[24px] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                {/* Abstract Pattern */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <div className="z-10 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-black tracking-tight">
                            {user.firstName} {user.lastName}
                        </h1>
                        <span className="bg-slate-700 text-slate-200 text-[10px] px-2 py-0.5 rounded border border-slate-600 font-bold">
                            عضو تیم فنی
                        </span>
                    </div>
                    <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-2xl opacity-90">
                        {smartMessage}
                    </p>
                </div>

                {/* Glass Stats Row */}
                <div className="z-10 flex items-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 p-2 rounded-2xl">
                    <div className="flex flex-col items-center px-4 py-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">فعالیت</span>
                        <span className="font-black text-xl">{toPersianDigits(stats.activeProjects)} <span className="text-[10px] font-normal text-slate-400">پروژه</span></span>
                    </div>
                    <div className="w-px h-8 bg-white/10"></div>
                    <div className="flex flex-col items-center px-4 py-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">سابقه</span>
                        <span className="font-black text-xl">{toPersianDigits(stats.totalDays)} <span className="text-[10px] font-normal text-slate-400">روز</span></span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="درآمد کسب شده" value={stats.totalIncome} prevValue={0} icon={Wallet} colorTheme="emerald" subText="سهم شما از پروژه‌ها"/>
                <KpiCard title="پروژه‌های من" value={stats.totalProjects} prevValue={0} icon={Briefcase} colorTheme="blue" subText={`${toPersianDigits(stats.activeProjects)} فعال | ${toPersianDigits(stats.completedProjects)} تکمیل`}/>
                <KpiCard title="میانگین زمان پروژه" value={`${toPersianDigits(stats.avgDuration)} روز`} prevValue={0} icon={Clock} colorTheme="amber" subText="مدت زمان همکاری"/>
                <KpiCard title="شبکه همکاری" value={stats.uniqueCollaborators} prevValue={0} icon={UsersIcon} colorTheme="violet" subText="همکاران منحصر به فرد"/>
            </div>
            <div className="grid grid-cols-1 gap-6">
                 <div className="h-[500px]">
                    <TasksWidget displayTasks={tasks.filter(t => t.assignedTo === user.id || !t.assignedTo).filter(t => !t.isDone)} activeTaskTab="Active" setActiveTaskTab={() => {}} handleToggleTask={() => {}} handleDeleteTask={() => {}}/>
                 </div>
            </div>
        </div>
    );
};

// --- ADMIN DASHBOARD (Keep Existing) ---

const AdminDashboard = ({ clients, projects, transactions, tasks, invoices, user }: any) => {
    // ... (Existing logic)
    const navigate = useNavigate();
    const { showToast } = useContext(AuthContext);
    const [recentLogs, setRecentLogs] = useState<Log[]>([]);
    const [activeTaskTab, setActiveTaskTab] = useState<'Active' | 'Done'>('Active');
    const [isEditMode, setIsEditMode] = useState(false);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [historyStack, setHistoryStack] = useState<WidgetLayout[] | null>(null);
    const [layout, setLayout] = useState<WidgetLayout[]>(() => {
        const saved = localStorage.getItem(`dashboard_layout_${user.id}`);
        return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
    });
    const isAdmin = user.role === UserRole.Admin;

    useEffect(() => { localStorage.setItem(`dashboard_layout_${user.id}`, JSON.stringify(layout)); }, [layout, user.id]);

    const myTasks = tasks.filter((t: any) => t.assignedTo === user.id || !t.assignedTo).reverse();
    const activeTasks = myTasks.filter((t: any) => !t.isDone);
    const displayTasks = myTasks.filter((t: any) => activeTaskTab === 'Active' ? !t.isDone : t.isDone);
    const overdueTasks = activeTasks.filter((t: any) => t.deadline && new Date(t.deadline) < new Date());
    const nearDeadlineProjects = projects.filter((p: any) => {
        if (p.status !== 'Active' || !p.deadline) return false;
        const diff = daysBetween(new Date(), new Date(p.deadline));
        return diff <= (p.deadlineWarningDays || 3) && new Date(p.deadline) >= new Date();
    });
    const overdueProjects = projects.filter((p: any) => p.status === 'Active' && p.deadline && new Date(p.deadline) < new Date());
    const unpaidInvoices = invoices.filter((i: any) => (i.status === 'ارسال‌شده' || i.status === 'معوق') && i.finalAmount > 0);
    const thisMonth = new Date().getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1; 
    const getMonthSum = (trans: Transaction[], type: TransactionType, targetMonth: number) => {
        return trans.filter(t => t.type === type && new Date(t.date).getMonth() === targetMonth).reduce((sum, t) => sum + t.amount, 0);
    };
    const incomeThisMonth = getMonthSum(transactions, TransactionType.Income, thisMonth);
    const incomeLastMonth = getMonthSum(transactions, TransactionType.Income, lastMonth);
    const expenseThisMonth = getMonthSum(transactions, TransactionType.Expense, thisMonth);
    const expenseLastMonth = getMonthSum(transactions, TransactionType.Expense, lastMonth);
    const netProfit = incomeThisMonth - expenseThisMonth;
    let healthScore = 100;
    healthScore -= (overdueTasks.length * 5);
    healthScore -= (nearDeadlineProjects.length * 10);
    healthScore -= (overdueProjects.length * 15);
    if (healthScore < 0) healthScore = 0;
    let healthStatus: 'Healthy' | 'Attention' | 'Risk' = 'Healthy';
    if (healthScore < 50) healthStatus = 'Risk';
    else if (healthScore < 80) healthStatus = 'Attention';

    useEffect(() => { api.logs.getAll().then(logs => setRecentLogs(logs.slice(0, 5))); }, [user]);

    const handleToggleTask = async (task: Task) => {
        const updated = {...task, isDone: !task.isDone};
        await api.tasks.update(updated);
        window.dispatchEvent(new Event('taskUpdated'));
        showToast(updated.isDone ? 'تسک انجام شد' : 'تسک بازگشت داده شد', 'success');
    };
    const handleDeleteTask = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if(window.confirm('حذف تسک؟')) {
            await api.tasks.delete(id, user.id);
            window.dispatchEvent(new Event('taskUpdated'));
            showToast('تسک حذف شد', 'success');
        }
    };
    const getHeroMessage = () => {
        if (healthStatus === 'Risk') return 'وضعیت بحرانی است؛ لطفاً فوراً به موارد عقب‌افتاده و ددلاین‌ها رسیدگی کنید.';
        if (healthStatus === 'Attention') return `${toPersianDigits(nearDeadlineProjects.length)} پروژه نزدیک ددلاین دارید. اولویت امروز بررسی آن‌هاست.`;
        if (activeTasks.length > 0) return `امروز ${toPersianDigits(activeTasks.length)} کار برای انجام دارید. روی اهداف متمرکز بمانید.`;
        return 'همه چیز تحت کنترل است؛ زمان خوبی برای برنامه‌ریزی توسعه کسب‌وکار است.';
    };
    const getHeroGradient = () => {
        switch(healthStatus) {
            case 'Risk': return 'from-rose-500 to-red-700 shadow-rose-500/20';
            case 'Attention': return 'from-amber-400 to-orange-600 shadow-amber-500/20';
            default: return 'from-primary-500 to-teal-700 shadow-primary-500/20';
        }
    };
    // UX Logic
    const saveToHistory = () => setHistoryStack([...layout]);
    const handleUndo = () => { if (historyStack) { setLayout(historyStack); setHistoryStack(null); showToast('تغییرات چیدمان بازگردانی شد', 'info'); }};
    const onDragStart = () => {};
    const onDragEnter = (targetId: string) => { if (dragOverId !== targetId) setDragOverId(targetId); };
    const onDrop = (draggedId: string, targetId: string) => {
        setDragOverId(null);
        if (draggedId === targetId) return;
        saveToHistory();
        const newLayout = [...layout];
        const draggedIndex = newLayout.findIndex(item => item.id === draggedId);
        const targetIndex = newLayout.findIndex(item => item.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;
        const [draggedItem] = newLayout.splice(draggedIndex, 1);
        newLayout.splice(targetIndex, 0, draggedItem);
        newLayout.forEach((item, index) => item.order = index);
        setLayout(newLayout);
    };
    const onResize = (id: string, newColSpan: number) => { saveToHistory(); setLayout(prev => prev.map(item => item.id === id ? { ...item, colSpan: newColSpan } : item)); };

    const renderWidget = (item: WidgetLayout) => {
        switch(item.id) {
            case 'hero': return <HeroWidget {...{ healthStatus, activeTasks, overdueProjects, nearDeadlineProjects, unpaidInvoices, navigate, getHeroMessage, getHeroGradient }} />;
            case 'kpi-1': return <KpiCard title="درآمد ماه جاری" value={incomeThisMonth} prevValue={incomeLastMonth} icon={TrendingUp} colorTheme="emerald" />;
            case 'kpi-2': return <KpiCard title="هزینه ماه جاری" value={expenseThisMonth} prevValue={expenseLastMonth} icon={DollarSign} colorTheme="red" />;
            case 'kpi-3': return <KpiCard title="پروژه‌های فعال" value={projects.filter((p: any) => p.status === 'Active').length} prevValue={projects.length} icon={Target} colorTheme="blue" />;
            case 'kpi-4': return <KpiCard title="مشتریان" value={clients.length} prevValue={clients.length - 1} icon={Briefcase} colorTheme="violet" />;
            case 'tasks': return <TasksWidget {...{ displayTasks, activeTaskTab, setActiveTaskTab, handleToggleTask, handleDeleteTask }} />;
            case 'risks': return <RisksWidget {...{ nearDeadlineProjects, overdueProjects, overdueTasks, unpaidInvoices, navigate, daysBetween }} />;
            case 'finance-chart': return <FinanceChartWidget transactions={transactions} />;
            case 'finance-summary': return <FinanceSummaryWidget {...{ netProfit, projects, incomeThisMonth, navigate, incomeLastMonth, expenseLastMonth }} />;
            case 'activity': return <ActivityWidget {...{ recentLogs }} />;
            default: return null;
        }
    };

    return (
        <div className="font-shabnam w-full max-w-[1600px] mx-auto pb-12">
            {isAdmin && (
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Layout size={20} className="text-gray-400" />
                        <h2 className="font-bold text-gray-600 dark:text-gray-300">داشبورد مدیریت</h2>
                    </div>
                    <div className="flex gap-3">
                        {historyStack && isEditMode && (
                            <button onClick={handleUndo} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white dark:bg-slate-800 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition animate-in fade-in"><RotateCcw size={16} /> بازگردانی تغییر</button>
                        )}
                        <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition shadow-sm ${isEditMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                            {isEditMode ? <LockOpen size={16} /> : <Lock size={16} />}
                            {isEditMode ? 'پایان ویرایش چیدمان' : 'ویرایش چیدمان'}
                        </button>
                    </div>
                </div>
            )}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 auto-rows-min transition-all duration-300 ${isEditMode ? 'gap-y-8 p-4 border-2 border-dashed border-primary-200/50 rounded-[40px] bg-primary-50/10' : ''}`}>
                {layout.map((item) => (
                    <DraggableWidget key={item.id} id={item.id} colSpan={item.colSpan} onDragStart={onDragStart} onDragEnter={onDragEnter} isDragOver={dragOverId === item.id} onDrop={onDrop} onResize={onResize} isEditMode={isEditMode}>
                        {renderWidget(item)}
                    </DraggableWidget>
                ))}
            </div>
        </div>
    );
};

// --- MAIN WRAPPER & ROUTING LOGIC ---

const DashboardView = () => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState<any>(null);
  
  // Roles
  const isTeamMember = user?.role === UserRole.TeamMember;
  const isClient = user?.role === UserRole.ClientUser || user?.role === UserRole.ConnectionUser;

  const fetchData = async () => {
    if (!user) return;
    const [allClients, allProjects, allTransactions, allTasks, allInvoices, allUsers] = await Promise.all([
      api.clients.getAll(),
      api.projects.getAll(),
      api.transactions.getAll(),
      api.tasks.getAll(),
      api.invoices.getAll(),
      api.users.getAll()
    ]);
    
    setData({
        clients: allClients,
        projects: allProjects,
        transactions: allTransactions,
        tasks: allTasks,
        invoices: allInvoices,
        users: allUsers
    });
  };

  useEffect(() => {
    fetchData();
    const handleTaskUpdate = () => fetchData();
    window.addEventListener('taskUpdated', handleTaskUpdate);
    return () => window.removeEventListener('taskUpdated', handleTaskUpdate);
  }, [user]);

  if (!data) return <div className="p-10 text-center text-gray-400 animate-pulse">در حال آماده‌سازی داشبورد...</div>;

  // --- STRICT VIEW RENDERING ---
  
  if (isClient) {
      return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              <ClientDashboard 
                  user={user!}
                  projects={data.projects}
              />
          </div>
      );
  }

  if (isTeamMember) {
      return (
        <TeamMemberDashboard 
            user={user!} 
            projects={data.projects} 
            tasks={data.tasks} 
            users={data.users}
        />
      );
  }

  // Fallback for Admin / Manager
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        <AdminDashboard 
          clients={data.clients} 
          projects={data.projects} 
          transactions={data.transactions} 
          tasks={data.tasks} 
          invoices={data.invoices}
          user={user}
        />
    </div>
  );
};

export default DashboardView;
