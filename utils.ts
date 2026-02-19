
import { User, UserRole, PermissionKey, AppSettings, SidebarItemConfig } from './types';
import * as LucideIcons from 'lucide-react';

// Persian Number Converter
export const toPersianDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  return str.toString().replace(/\d/g, (x) => String.fromCharCode(x.charCodeAt(0) + 1728));
};

export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  return str.toString().replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
};

// Currency Formatter
export const formatCurrency = (amount: number): string => {
  if (typeof amount !== 'number') return '0';
  return toPersianDigits(amount.toLocaleString('fa-IR'));
};

// Input Formatter (Adds commas)
export const formatPriceInput = (value: string): string => {
  const clean = toEnglishDigits(value).replace(/\D/g, '');
  if (!clean) return '';
  return toPersianDigits(Number(clean).toLocaleString('en-US'));
};

export const parsePriceInput = (value: string): number => {
  const clean = toEnglishDigits(value).replace(/\D/g, '');
  return Number(clean) || 0;
};

// Full Number to Words Converter
const ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const tens = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];

const convertThousand = (num: number): string => {
  if (num === 0) return '';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const rem = num % 10;
    return tens[Math.floor(num / 10)] + (rem ? ' و ' + ones[rem] : '');
  }
  const rem = num % 100;
  return hundreds[Math.floor(num / 100)] + (rem ? ' و ' + convertThousand(rem) : '');
};

export const numberToWords = (num: number, unit: string = 'تومان'): string => {
  if (num === 0) return `صفر ${unit}`;
  
  const parts = [];
  const billions = Math.floor(num / 1000000000);
  let rem = num % 1000000000;
  const millions = Math.floor(rem / 1000000);
  rem = rem % 1000000;
  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (billions) parts.push(convertThousand(billions) + ' میلیارد');
  if (millions) parts.push(convertThousand(millions) + ' میلیون');
  if (thousands) parts.push(convertThousand(thousands) + ' هزار');
  if (rem) parts.push(convertThousand(rem));

  return parts.join(' و ') + ' ' + unit;
};

// Calculate Share
export const calculateShare = (total: number, percent: number): number => {
    if (!total || !percent) return 0;
    return Math.round((total * percent) / 100);
};

// Date Formatter (Jalaali)
export const formatJalali = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.startsWith('14') || dateStr.startsWith('13')) return toPersianDigits(dateStr);
  
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
};

export const formatJalaliShort = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.startsWith('14') || dateStr.startsWith('13')) return toPersianDigits(dateStr);

  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'Completed': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    case 'Canceled': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    // Invoice Colors
    case 'پیش‌نویس': return 'bg-gray-100 text-gray-600';
    case 'ارسال‌شده': return 'bg-blue-50 text-blue-600';
    case 'دیده‌شده': return 'bg-indigo-50 text-indigo-600';
    case 'تأییدشده': return 'bg-teal-50 text-teal-600';
    case 'پرداخت‌شده': return 'bg-green-100 text-green-700';
    case 'معوق': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

// --- DATE LOGIC ---

// Calculate Days Between
export const daysBetween = (d1: Date, d2: Date) => {
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((d1.getTime() - d2.getTime()) / oneDay));
};

export const getJalaliParts = (date: Date, cal: 'jalali' | 'gregorian' = 'jalali') => {
    // Safety check for Invalid Date
    if (isNaN(date.getTime())) {
        return { y: 1403, m: 1, d: 1 };
    }

    const calendarType = cal === 'jalali' ? 'persian' : 'gregory';
    const locale = cal === 'jalali' ? 'fa-IR' : 'en-US';
    
    try {
        const fmt = new Intl.DateTimeFormat(`${locale}-u-ca-${calendarType}`, { year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = fmt.formatToParts(date);
        const y = parseInt(toEnglishDigits(parts.find(p => p.type === 'year')?.value || '1400'));
        const m = parseInt(toEnglishDigits(parts.find(p => p.type === 'month')?.value || '1'));
        const d = parseInt(toEnglishDigits(parts.find(p => p.type === 'day')?.value || '1'));
        return { y, m, d };
    } catch (e) {
        // Fallback for extreme edge cases
        return { y: 1403, m: 1, d: 1 };
    }
};

export const getConversionDisplay = (date: Date) => {
    const greg = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const hijri = new Intl.DateTimeFormat('fa-IR-u-ca-islamic-civil', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    return { greg, hijri };
};

export const getRelativeDateLabel = (targetDate: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'امروز';
    if (diffDays === 1) return 'فردا';
    if (diffDays === -1) return 'دیروز';
    
    if (diffDays > 0) return `${toPersianDigits(diffDays)} روز بعد`;
    return `${toPersianDigits(Math.abs(diffDays))} روز قبل`;
};

// --- DAILY MESSAGE ---
export const getDailyMessage = (role: UserRole | undefined): string => {
    const day = new Date().getDay();
    const messages = [
        "شروع هفته بهترین زمان برای برنامه‌ریزی دقیق است.", // Sat
        "امروز یک قدم کوچک بردار تا فردا راحت‌تر باشی.", // Sun
        "تمرکز روی کیفیت، همیشه نتیجه‌بخش است.", // Mon
        "عملکرد این هفته‌ات تا اینجا عالی بوده، ادامه بده.", // Tue
        "کارهای باقی‌مانده را اولویت‌بندی کن.", // Wed
        "آخر هفته نزدیک است، انرژی‌ات را حفظ کن.", // Thu
        "زمان خوبی برای جمع‌بندی و استراحت است." // Fri
    ];
    
    const msg = messages[(day + 1) % 7]; // Shift to match Jalali approximate logic
    return msg;
};


// --- PERMISSIONS & CONFIG DEFAULTS ---

export const DEFAULT_SIDEBAR_CONFIG: SidebarItemConfig[] = [
    { id: 'dashboard', label: 'داشبورد', path: '/', iconName: 'LayoutDashboard', isVisible: true, order: 0, requiredPermission: 'VIEW_DASHBOARD' },
    { id: 'notifications', label: 'اعلان‌ها', path: '/notifications', iconName: 'Bell', isVisible: true, order: 0.5 },
    { id: 'projects', label: 'پروژه‌ها', path: '/projects', iconName: 'FolderKanban', isVisible: true, order: 1, requiredPermission: 'VIEW_PROJECTS' },
    { id: 'clients', label: 'مدیریت مشتریان', path: '/clients', iconName: 'Users', isVisible: true, order: 2, requiredPermission: 'VIEW_CLIENTS' },
    { id: 'invoices', label: 'فاکتورها', path: '/invoices', iconName: 'FileText', isVisible: true, order: 3, requiredPermission: 'VIEW_INVOICES' },
    { id: 'finance', label: 'حسابداری', path: '/finance', iconName: 'Wallet', isVisible: true, order: 4, requiredPermission: 'VIEW_FINANCE' },
    { id: 'team', label: 'مدیریت تیم', path: '/team', iconName: 'Briefcase', isVisible: true, order: 5, requiredPermission: 'VIEW_TEAM' },
    { id: 'messages', label: 'پیام‌ها', path: '/messages', iconName: 'MessageSquare', isVisible: true, order: 6, requiredPermission: 'VIEW_MESSAGES' },
    { id: 'settings', label: 'تنظیمات', path: '/settings', iconName: 'Settings', isVisible: true, order: 99, requiredPermission: 'VIEW_SETTINGS' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
    [UserRole.Admin]: [
        'VIEW_DASHBOARD', 'VIEW_CLIENTS', 'MANAGE_CLIENTS', 'VIEW_PROJECTS', 'MANAGE_PROJECTS', 
        'VIEW_INVOICES', 'MANAGE_INVOICES', 'VIEW_TEAM', 'MANAGE_TEAM', 'VIEW_FINANCE', 'MANAGE_FINANCE', 
        'VIEW_MESSAGES', 'VIEW_SETTINGS', 'MANAGE_SETTINGS', 'VIEW_LOGS'
    ],
    [UserRole.Manager]: [
        'VIEW_DASHBOARD', 'VIEW_CLIENTS', 'MANAGE_CLIENTS', 'VIEW_PROJECTS', 'MANAGE_PROJECTS', 
        'VIEW_INVOICES', 'MANAGE_INVOICES', 'VIEW_TEAM', 'MANAGE_TEAM', 'VIEW_FINANCE', 
        'VIEW_MESSAGES', 'VIEW_SETTINGS', 'VIEW_LOGS'
    ],
    [UserRole.TeamMember]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_TEAM', 'VIEW_MESSAGES'
    ],
    // RBAC: Customer only sees Dashboard, Projects, Invoices (Self), Messages
    [UserRole.ClientUser]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_INVOICES', 'VIEW_MESSAGES'
    ],
    [UserRole.ConnectionUser]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_INVOICES', 'VIEW_MESSAGES'
    ]
};

export const ALL_PERMISSIONS: {key: PermissionKey, label: string, category: string}[] = [
    { key: 'VIEW_DASHBOARD', label: 'مشاهده داشبورد', category: 'عمومی' },
    { key: 'VIEW_MESSAGES', label: 'مشاهده پیام‌ها', category: 'عمومی' },
    { key: 'VIEW_CLIENTS', label: 'مشاهده مشتریان', category: 'مشتریان' },
    { key: 'MANAGE_CLIENTS', label: 'مدیریت مشتریان (افزودن/حذف)', category: 'مشتریان' },
    { key: 'VIEW_PROJECTS', label: 'مشاهده پروژه‌ها', category: 'پروژه‌ها' },
    { key: 'MANAGE_PROJECTS', label: 'مدیریت پروژه‌ها', category: 'پروژه‌ها' },
    { key: 'VIEW_INVOICES', label: 'مشاهده فاکتورها', category: 'مالی' },
    { key: 'MANAGE_INVOICES', label: 'مدیریت فاکتورها', category: 'مالی' },
    { key: 'VIEW_FINANCE', label: 'مشاهده حسابداری کل', category: 'مالی' },
    { key: 'MANAGE_FINANCE', label: 'مدیریت تراکنش‌ها', category: 'مالی' },
    { key: 'VIEW_TEAM', label: 'مشاهده اعضای تیم', category: 'تیم' },
    { key: 'MANAGE_TEAM', label: 'مدیریت اعضای تیم', category: 'تیم' },
    { key: 'VIEW_SETTINGS', label: 'مشاهده تنظیمات', category: 'سیستم' },
    { key: 'MANAGE_SETTINGS', label: 'تغییر تنظیمات اصلی', category: 'سیستم' },
    { key: 'VIEW_LOGS', label: 'مشاهده لاگ سیستم', category: 'سیستم' },
];

export const checkPermission = (user: User | null, permission: PermissionKey | undefined, settings: AppSettings | null): boolean => {
    if (!user) return false;
    if (!permission) return true; // No permission required
    if (user.role === UserRole.Admin) return true; // Admin has all power (Safety net)

    // 1. Check Specific Override
    if (user.permissionOverrides && user.permissionOverrides[permission] !== undefined) {
        return user.permissionOverrides[permission]!;
    }

    // 2. Check Role Default
    const rolePerms = settings?.rolePermissions?.[user.role] || DEFAULT_ROLE_PERMISSIONS[user.role];
    return rolePerms.includes(permission);
};

export const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.HelpCircle;
};
