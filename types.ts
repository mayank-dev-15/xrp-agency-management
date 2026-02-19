
export enum UserRole {
  Admin = 'Admin',
  Manager = 'Manager',
  TeamMember = 'TeamMember',
  ClientUser = 'ClientUser',
  ConnectionUser = 'ConnectionUser'
}

export enum UserStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Deleted = 'Deleted',
  Busy = 'Busy',
  OnLeave = 'OnLeave'
}

// --- NEW PERMISSION SYSTEM ---
export type PermissionKey = 
  | 'VIEW_DASHBOARD'
  | 'VIEW_CLIENTS' | 'MANAGE_CLIENTS'
  | 'VIEW_PROJECTS' | 'MANAGE_PROJECTS'
  | 'VIEW_INVOICES' | 'MANAGE_INVOICES'
  | 'VIEW_TEAM' | 'MANAGE_TEAM'
  | 'VIEW_FINANCE' | 'MANAGE_FINANCE'
  | 'VIEW_MESSAGES'
  | 'VIEW_SETTINGS' | 'MANAGE_SETTINGS'
  | 'VIEW_LOGS';

export interface User {
  id: string;
  username: string; // Phone number
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  departmentId?: string; // Link to department
  lastLoginAt?: string;
  createdAt: string;
  
  // New: Granular Permission Overrides
  permissionOverrides?: Partial<Record<PermissionKey, boolean>>;

  jobDetails?: {
      skills: string[];
      experienceYears: number;
      bio: string;
  };
}

export interface Department {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
}

export enum ClientType {
  Client = 'Client',
  Connection = 'Connection',
  Both = 'Both'
}

export interface Client {
  id: string;
  type: ClientType; 
  name: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  notes?: string;
  relatedUserId?: string; 
  username?: string; 
  password?: string; 
  createdAt: string;
  deletedAt?: string | null; 
  riskScore?: number; 
}

export enum ProjectStatus {
  Active = 'Active',
  Pending = 'Pending',
  Completed = 'Completed',
  Canceled = 'Canceled'
}

export enum PaymentMethod {
  Cash = 'Cash',
  Installment = 'Installment'
}

export interface Installment {
  id: string;
  date: string; // Jalali
  amount: number;
  isPaid: boolean;
}

// Req 1: Separate Entity for Budget
export interface ProjectBudget {
    total: number;
    currency: string;
    notes?: string;
    lastUpdated: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  projectType: 'Web' | 'Mobile' | 'UI/UX' | 'SEO' | 'Other';
  sourceType: 'Client' | 'Connection' | 'Agency' | 'Custom';
  sourceId?: string | null; 
  sourceTag?: string;
  
  startDate?: string; // Jalali String YYYY/MM/DD
  deadline: string; // Jalali String YYYY/MM/DD
  deadlineWarningDays: number;
  
  // Finance
  totalBudget: number; // Kept for backward compatibility
  budget?: ProjectBudget; // Req 1: New detached entity structure
  
  // New: Link to Invoice for Auto-Budget
  linkedInvoiceId?: string; 

  paymentMethod: PaymentMethod;
  installments: Installment[];
  expenses: number;
  connectionSharePercent: number;
  
  members: string[]; // User IDs
  memberAllocations: Record<string, number>; 
  
  createdAt: string;
  completedAt?: string;
  deletedAt?: string | null;
}

// --- ACCOUNTING / FINANCE TYPES (UPDATED V1) ---

export enum TransactionType {
  Income = 'Income',
  Expense = 'Expense',
  Payout = 'Payout'
}

export enum FinanceCategory {
  Agency = 'Agency',
  Personal = 'Personal'
}

// New Category Model for Classification
export interface TransactionCategoryItem {
  id: string;
  name: string;
  type: 'income' | 'expense';
  parentId?: string; // For Subcategories
  isActive: boolean;
  createdAt: string;
}

export type PaymentMethodType = 'Card' | 'Cash' | 'Gateway' | 'Transfer' | 'Other';
export type TransactionStatus = 'Registered' | 'Approved' | 'Cancelled';

export interface PartialPayment {
  id: string;
  amount: number;
  date: string; // Jalali
  method: PaymentMethodType;
  note?: string;
}

export interface Transaction {
  id: string;
  
  // Stable Sequence Number (New Req)
  sequenceNo?: number; 

  type: TransactionType;
  category: FinanceCategory; // Acts as Scope (Agency/Personal)
  amount: number; // This should be the SUM of partialPayments if attached to invoice
  date: string; // Jalali String
  
  // V1 Fields
  title: string; // Mandatory title
  description?: string; // Optional long description
  paymentMethod?: PaymentMethodType;
  status: TransactionStatus;
  attachments?: string[]; // Array of base64 strings or URLs
  
  // Classification
  categoryId?: string; // Link to TransactionCategoryItem

  sourceTag?: string;
  projectId?: string;
  clientId?: string;
  invoiceId?: string; // New: Link to Invoice
  
  // New: Partial Payments for Invoice
  partialPayments?: PartialPayment[];
  installmentTotal?: number; // Total planned installments (e.g. 4 for "1 of 4")
  
  // Req 2: Stable Installment Numbering
  installmentNo?: number; 

  // Req D: Expense Payee
  payeeId?: string; // Link to User (Team Member)
  payeeName?: string; // Custom Text (if not team member)

  // System Flags
  systemKey?: string; // For idempotent system transactions (e.g. commissions)
  isInstallment?: boolean; // To distinguish invoice receipts from linked expenses

  createdAt: string;
  updatedAt?: string;
}

export interface Log {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
}

// --- NOTIFICATION TYPES ---
export type NotificationType = 'System' | 'Project' | 'Task' | 'Financial' | 'Message' | 'Managerial';
export type NotificationPriority = 'Normal' | 'High' | 'Urgent';

export interface Notification {
    id: string;
    userId: string; // The specific user who receives this
    type: NotificationType;
    title: string;
    message: string;
    link?: string; // Route to navigate to
    isRead: boolean;
    createdAt: string;
    relatedId?: string;
    
    // Managerial Features
    priority?: NotificationPriority;
    isManagerial?: boolean;
    expiryDate?: string; // ISO String
    batchId?: string; // Links back to a ManagerialBroadcast
}

export interface ManagerialBroadcast {
    id: string;
    adminId: string;
    title: string;
    message: string;
    priority: NotificationPriority;
    targetAudience: 'All' | 'Team' | 'Clients' | 'Manual';
    recipientCount: number;
    createdAt: string;
    expiryDate?: string;
}

export interface Task {
    id: string;
    title: string;
    isDone: boolean;
    projectId?: string;
    assignedTo?: string;
    deadline?: string; // Jalali YYYY/MM/DD
    createdAt: string;
}

// Chat Types
export interface Message {
    id: string;
    threadId: string;
    senderId: string;
    content: string; // Text or URL
    type: 'text' | 'image' | 'voice' | 'link';
    createdAt: string;
    isSeen: boolean;
    reactions?: Record<string, string>; // userId -> emoji
    replyToId?: string;
}

export interface ChatThread {
    id: string;
    type: 'direct' | 'group' | 'broadcast';
    name?: string; // For groups
    participants: string[]; // User IDs (or Client IDs prefixed)
    lastMessage?: string;
    updatedAt: string;
}

// --- INVOICE ENGINE TYPES ---

export enum InvoiceStatus {
  Draft = 'پیش‌نویس',
  Sent = 'ارسال‌شده',
  Seen = 'دیده‌شده',
  Approved = 'تأییدشده',
  Paid = 'پرداخت‌شده',
  Overdue = 'معوق',
  Canceled = 'لغو شده'
}

export enum Currency {
  Toman = 'تومان',
  Rial = 'ریال'
}

export interface InvoiceItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceOptions {
    hasExtraLanguage: boolean;
    hasMobileResp: boolean;
    hasTabletResp: boolean;
    hasDarkMode: boolean;
}

export interface Invoice {
  id: string;
  title?: string; // Custom Invoice Title
  type: 'Invoice' | 'Proforma';
  number: string;
  date: string; // Jalali
  dueDate?: string; // Jalali
  
  clientId: string;
  projectId?: string;
  
  // Smart Fields
  projectType: 'Website' | 'Application' | 'Other';
  options?: InvoiceOptions;
  optionsAmount?: number; 

  status: InvoiceStatus;
  currency: Currency;
  
  items: InvoiceItem[];
  
  // Math
  subTotal: number;
  discountType: 'Percent' | 'Fixed';
  discountValue: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  finalAmount: number;
  
  // Req 2: Store installment plan on Invoice, NOT Transaction
  plannedInstallmentsCount?: number;

  // Details
  notes?: string;
  providerNote?: string; // Bank info
  
  // Seller Additional Info
  sellerDetails?: {
      address?: string;
      email?: string;
      zipCode?: string;
      phone?: string;
  };

  // Signature & Branding
  logoUrl?: string;
  signatureUrl?: string; 
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// --- APP SETTINGS & CONFIG ---

export interface SidebarItemConfig {
    id: string;
    label: string;
    path: string;
    iconName: string; // Map to Lucide Icon Name
    isVisible: boolean;
    order: number;
    requiredPermission?: PermissionKey;
}

export interface AppSettings {
  themeColor: string;
  menuTitles: Record<string, string>;
  projectTypes: string[];
  
  // Sidebar Management
  sidebarConfig: SidebarItemConfig[];

  // Role Based Access Control Defaults
  rolePermissions: Record<UserRole, PermissionKey[]>;

  // Default Branding
  defaultLogoUrl?: string;
  defaultSignatureUrl?: string;
  defaultProviderNote?: string;
  
  // Invoice Config (Percentages)
  invoiceConfig?: {
      extraLangPercent: number;
      mobileRespPercent: number;
      tabletRespPercent: number;
      darkModePercent: number;
  };

  // Advanced Settings (Fully Typed)
  businessRules?: {
      minProfitMargin: number;
      enforceDataFields: boolean;
  };
  policies?: {
      projectAcceptance: string;
      clientCommunication: string;
  };
  financialControl?: {
      expenseApprovalLimit: number;
      lockFinalizedTransactions: boolean;
  };
  automation?: {
      deadlineAlertPresets: number[];
  };
  departments?: {
      defaultRoles: Record<string, string>;
  };
  backup?: {
      lastBackupDate?: string;
  };
}

// --- TOAST TYPES ---
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
}

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
    // Removed MANAGE_FINANCE from Manager
    [UserRole.Manager]: [
        'VIEW_DASHBOARD', 'VIEW_CLIENTS', 'MANAGE_CLIENTS', 'VIEW_PROJECTS', 'MANAGE_PROJECTS', 
        'VIEW_INVOICES', 'MANAGE_INVOICES', 'VIEW_TEAM', 'MANAGE_TEAM', 'VIEW_FINANCE', 
        'VIEW_MESSAGES', 'VIEW_SETTINGS', 'VIEW_LOGS'
    ],
    [UserRole.TeamMember]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_TEAM', 'VIEW_MESSAGES'
    ],
    [UserRole.ClientUser]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_INVOICES', 'VIEW_MESSAGES'
    ],
    [UserRole.ConnectionUser]: [
        'VIEW_DASHBOARD', 'VIEW_PROJECTS', 'VIEW_INVOICES', 'VIEW_MESSAGES'
    ]
};
