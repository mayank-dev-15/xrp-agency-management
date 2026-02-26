
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Log, User, UserRole, AppSettings, PermissionKey, SidebarItemConfig, TransactionCategoryItem } from '../types';
import { formatJalaliShort, checkPermission, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, getIcon, toPersianDigits, generateId } from '../utils';
import { Users, Shield, Trash2, Edit2, Save, AlertTriangle, FileText, Image as ImageIcon, PenTool, Percent, Menu, Lock, CheckCircle, XCircle, ChevronUp, ChevronDown, Eye, GripVertical, Activity, Filter, Search, FolderKanban, DollarSign, CheckSquare, Settings as SettingsIcon, Clock, Calendar, List, AlignLeft, Wallet, Plus, ArrowRight, Archive, RotateCcw } from 'lucide-react';
import { Modal } from '../components/Shared';

const SettingsView = () => {
  const { user, refreshSettings, hasPermission, setPreviewUser, previewUser, settings: globalSettings, showToast, confirmAction } = useContext(AuthContext);
  const [logs, setLogs] = useState<Log[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState('General');
  
  // Advanced Settings Form States
  const [businessRules, setBusinessRules] = useState({ minProfitMargin: 10, enforceDataFields: true });
  const [policies, setPolicies] = useState({ projectAcceptance: '', clientCommunication: '' });

  // Invoice Settings States
  const [invoiceSettings, setInvoiceSettings] = useState({
      defaultLogoUrl: '',
      defaultSignatureUrl: '',
      defaultProviderNote: ''
  });

  const [invoiceConfig, setInvoiceConfig] = useState({
      extraLangPercent: 30,
      mobileRespPercent: 20,
      tabletRespPercent: 15,
      darkModePercent: 10
  });

  // --- NEW: Permission & Menu States ---
  const [sidebarItems, setSidebarItems] = useState<SidebarItemConfig[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  
  const [roleMatrix, setRoleMatrix] = useState<Record<UserRole, PermissionKey[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [editingUserOverride, setEditingUserOverride] = useState<User | null>(null);

  // --- NEW: Activity Timeline States ---
  const [activityFilter, setActivityFilter] = useState({ type: 'All', userId: 'All', search: '' });
  const [logSubTab, setLogSubTab] = useState<'timeline' | 'technical'>('timeline');

  // --- NEW: Accounting Category States ---
  const [categories, setCategories] = useState<TransactionCategoryItem[]>([]);
  const [accType, setAccType] = useState<'income' | 'expense'>('income');
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catFormData, setCatFormData] = useState<Partial<TransactionCategoryItem>>({});

  const loadData = async () => {
      const [l, u, s, cats] = await Promise.all([api.logs.getAll(), api.users.getAll(), api.settings.get(), api.categories.getAll()]);
      setLogs(l);
      setUsers(u);
      setSettings(s);
      setCategories(cats);
      
      if(s.businessRules) setBusinessRules(s.businessRules);
      if(s.policies) setPolicies(s.policies);
      if(s.sidebarConfig) setSidebarItems(s.sidebarConfig);
      if(s.rolePermissions) setRoleMatrix(s.rolePermissions);
      
      // Load Invoice Settings
      setInvoiceSettings({
          defaultLogoUrl: s.defaultLogoUrl || '',
          defaultSignatureUrl: s.defaultSignatureUrl || '',
          defaultProviderNote: s.defaultProviderNote || ''
      });
      if(s.invoiceConfig) setInvoiceConfig(s.invoiceConfig);
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveSettings = async () => {
      if(!settings) return;
      const newSettings: AppSettings = {
          ...settings,
          businessRules,
          policies,
          // Save Invoice Settings
          defaultLogoUrl: invoiceSettings.defaultLogoUrl,
          defaultSignatureUrl: invoiceSettings.defaultSignatureUrl,
          defaultProviderNote: invoiceSettings.defaultProviderNote,
          invoiceConfig: invoiceConfig,
          // NEW: Save Sidebar & Permissions
          sidebarConfig: sidebarItems,
          rolePermissions: roleMatrix
      };
      await api.settings.update(newSettings, user!.id);
      setSettings(newSettings);
      await refreshSettings(); // Update Context
      showToast('تنظیمات با موفقیت ذخیره شد', 'success');
  };

  // --- Sidebar DnD Logic ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedItemIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      // Fallback for visual drag if needed
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (draggedItemIndex === null || draggedItemIndex === index) return;

      const newItems = [...sidebarItems];
      const draggedItem = newItems[draggedItemIndex];
      
      // Remove dragged item
      newItems.splice(draggedItemIndex, 1);
      // Insert at new index
      newItems.splice(index, 0, draggedItem);
      
      // Update order property
      newItems.forEach((item, idx) => item.order = idx);
      
      setSidebarItems(newItems);
      setDraggedItemIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDraggedItemIndex(null);
  };

  const toggleSidebarItem = (id: string) => {
      setSidebarItems(prev => prev.map(item => item.id === id ? {...item, isVisible: !item.isVisible} : item));
  };

  const updateSidebarLabel = (id: string, newLabel: string) => {
      setSidebarItems(prev => prev.map(item => item.id === id ? {...item, label: newLabel} : item));
  };

  // --- Permission Matrix Logic ---
  const toggleRolePermission = (role: UserRole, perm: PermissionKey) => {
      setRoleMatrix(prev => {
          const current = prev[role] || [];
          if (current.includes(perm)) {
              return { ...prev, [role]: current.filter(p => p !== perm) };
          } else {
              return { ...prev, [role]: [...current, perm] };
          }
      });
  };

  // --- User Override Logic ---
  const handleUserOverrideSave = async () => {
      if (editingUserOverride) {
          await api.users.update(editingUserOverride, user!.id);
          setUsers(prev => prev.map(u => u.id === editingUserOverride.id ? editingUserOverride : u));
          setEditingUserOverride(null);
          showToast('دسترسی‌های کاربر به‌روزرسانی شد', 'success');
      }
  };

  const toggleUserOverride = (perm: PermissionKey, state: boolean | undefined) => {
      if (!editingUserOverride) return;
      const currentOverrides = editingUserOverride.permissionOverrides || {};
      
      if (state === undefined) {
          // Reset to role default
          const newOverrides = { ...currentOverrides };
          delete newOverrides[perm];
          setEditingUserOverride({ ...editingUserOverride, permissionOverrides: newOverrides });
      } else {
          setEditingUserOverride({
              ...editingUserOverride,
              permissionOverrides: { ...currentOverrides, [perm]: state }
          });
      }
  };

  // --- Activity Timeline Helpers ---
  const getActivityMeta = (action: string) => {
      if (action.includes('PROJECT')) return { category: 'Project', label: 'پروژه', icon: FolderKanban, color: 'text-blue-600 bg-blue-100' };
      if (action.includes('INVOICE')) return { category: 'Invoice', label: 'فاکتور', icon: FileText, color: 'text-amber-600 bg-amber-100' };
      if (action.includes('TRANSACTION') || action.includes('FINANCE')) return { category: 'Finance', label: 'مالی', icon: DollarSign, color: 'text-emerald-600 bg-emerald-100' };
      if (action.includes('TASK')) return { category: 'Task', label: 'تسک', icon: CheckSquare, color: 'text-purple-600 bg-purple-100' };
      if (action.includes('USER') || action.includes('CLIENT') || action.includes('TEAM')) return { category: 'User', label: 'کاربران', icon: Users, color: 'text-rose-600 bg-rose-100' };
      if (action.includes('SETTINGS') || action.includes('DEPART')) return { category: 'System', label: 'سیستم', icon: SettingsIcon, color: 'text-gray-600 bg-gray-100' };
      if (action.includes('IMPERSONATION')) return { category: 'System', label: 'شبیه‌سازی', icon: Eye, color: 'text-amber-600 bg-amber-100' };
      return { category: 'Other', label: 'سایر', icon: Activity, color: 'text-gray-500 bg-gray-50' };
  };

  const getFilteredActivities = () => {
      // Exclude generic logins for "Business Timeline"
      let filtered = logs.filter(l => l.action !== 'LOGIN');
      
      // Access Control: Manager sees own actions + maybe team (Simplification: Manager sees all for now based on prompt scope, restricted only at Tab level)
      if (user?.role === UserRole.Manager) {
          // Optional: Filter by department if we had deeper relation. 
          // For now, Managers see timeline similar to Admin but scoped.
      }

      // Apply UI Filters
      if (activityFilter.type !== 'All') {
          filtered = filtered.filter(l => getActivityMeta(l.action).category === activityFilter.type);
      }
      if (activityFilter.userId !== 'All') {
          filtered = filtered.filter(l => l.userId === activityFilter.userId);
      }
      if (activityFilter.search) {
          filtered = filtered.filter(l => l.details.includes(activityFilter.search) || l.action.includes(activityFilter.search));
      }
      return filtered;
  };

  // --- Preview Logic ---
  const handlePreview = (targetUser: User) => {
      setPreviewUser(targetUser);
      showToast(`حالت مشاهده به‌عنوان ${targetUser.firstName} فعال شد`, 'info');
  };

  // --- Basic Handlers ---
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
      const target = users.find(u => u.id === userId);
      if(target) {
          const updated = {...target, role: newRole};
          await api.users.update(updated, user!.id);
          setUsers(prev => prev.map(u => u.id === userId ? updated : u));
          showToast('نقش کاربر تغییر یافت', 'success');
      }
  };

  const deleteUser = async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      confirmAction({
          description: 'آیا مطمئن هستید؟ کاربر حذف خواهد شد.',
          onConfirm: async () => {
              try {
                await api.users.delete(id, user!.id);
                setUsers(prev => [...prev.filter(u => u.id !== id)]);
                showToast('کاربر حذف شد', 'success');
              } catch(err) {
                showToast('خطا در حذف کاربر', 'error');
              }
          }
      });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'defaultLogoUrl' | 'defaultSignatureUrl') => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setInvoiceSettings(prev => ({...prev, [field]: reader.result as string}));
          };
          reader.readAsDataURL(file);
      }
  };

  // --- ACCOUNTING CATEGORY HANDLERS ---
  const handleCategorySave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!catFormData.name) return;
      
      try {
          if (catFormData.id) {
              const updated = { ...catFormData } as TransactionCategoryItem;
              await api.categories.update(updated, user!.id);
              setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
              showToast('دسته با موفقیت ویرایش شد', 'success');
          } else {
              const newItem: TransactionCategoryItem = {
                  id: generateId(),
                  name: catFormData.name,
                  type: accType,
                  parentId: catFormData.parentId,
                  isActive: true,
                  createdAt: new Date().toISOString()
              };
              await api.categories.create(newItem, user!.id);
              setCategories(prev => [...prev, newItem]);
              showToast('دسته جدید ایجاد شد', 'success');
          }
          setCatModalOpen(false);
          setCatFormData({});
      } catch (err) {
          showToast('خطا در ذخیره دسته‌بندی', 'error');
      }
  };

  const handleCategoryDeleteClick = async (id: string) => {
      // Check usage count before deciding action
      const usageCount = await api.categories.getUsageCount(id);
      
      if (usageCount > 0) {
          confirmAction({
              title: 'بایگانی دسته‌بندی',
              description: `این دسته‌بندی در ${usageCount} تراکنش استفاده شده است و نمی‌توان آن را حذف کرد. آیا می‌خواهید آن را بایگانی کنید؟`,
              confirmText: 'بایگانی',
              isDestructive: false,
              onConfirm: async () => {
                  try {
                      const result = await api.categories.delete(id, user!.id);
                      if (result === 'soft_deleted') {
                          setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: false } : c));
                          // Also update children if they exist locally
                          setCategories(prev => prev.map(c => c.parentId === id ? { ...c, isActive: false } : c));
                          showToast('دسته‌بندی بایگانی شد', 'success');
                      }
                  } catch (err) {
                      showToast('خطا در بایگانی', 'error');
                  }
              }
          });
      } else {
          confirmAction({
              title: 'حذف دسته‌بندی',
              description: 'آیا از حذف کامل این دسته‌بندی اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
              confirmText: 'حذف کامل',
              isDestructive: true,
              onConfirm: async () => {
                  try {
                      const result = await api.categories.delete(id, user!.id);
                      if (result === 'deleted') {
                          setCategories(prev => prev.filter(c => c.id !== id));
                          showToast('دسته‌بندی به طور کامل حذف شد', 'success');
                      }
                  } catch (err) {
                      showToast('خطا در حذف دسته‌بندی', 'error');
                  }
              }
          });
      }
  };

  const handleRestore = async (id: string) => {
      const cat = categories.find(c => c.id === id);
      if (cat) {
          const updated = { ...cat, isActive: true };
          await api.categories.update(updated, user!.id);
          setCategories(prev => prev.map(c => c.id === id ? updated : c));
          showToast('دسته‌بندی بازگردانی شد', 'success');
      }
  };

  if (!hasPermission('VIEW_SETTINGS')) {
      return <div className="p-10 text-center text-red-500">شما مجوز دسترسی به تنظیمات را ندارید.</div>;
  }

  // --- MENU CONFIG ---
  const tabs = [
      'General', 'Menu', 'Access Control', 'User Management', 'Invoice', 'Accounting', 'Business Rules', 'LogSystem'
  ];

  // RBAC for Timeline Tab visibility
  const canViewTimeline = user?.role === UserRole.Admin || user?.role === UserRole.Manager;
  // RBAC for Accounting Tab
  const canManageAccounting = user?.role === UserRole.Admin || user?.role === UserRole.Manager;

  const activeCategories = categories.filter(c => c.isActive);
  const archivedCategories = categories.filter(c => !c.isActive);

  return (
    <div>
       <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-slate-700 overflow-x-auto pb-1 no-scrollbar">
           {tabs.map(tab => {
               if (tab === 'LogSystem' && !canViewTimeline) return null;
               if (tab === 'Accounting' && !canManageAccounting) return null;
               return (
               <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-4 whitespace-nowrap font-medium transition ${activeTab === tab ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
               >
                   {tab === 'General' ? 'عمومی' : 
                    tab === 'Menu' ? 'مدیریت منو' :
                    tab === 'Access Control' ? 'سطوح دسترسی (RBAC)' :
                    tab === 'User Management' ? 'کاربران' : 
                    tab === 'Invoice' ? 'فاکتور' :
                    tab === 'Accounting' ? 'دسته‌بندی حسابداری' :
                    tab === 'Business Rules' ? 'قوانین' : 
                    tab === 'LogSystem' ? 'لاگ‌ها و فعالیت‌ها' : ''}
               </button>
           )})}
       </div>

       {/* --- TAB: GENERAL --- */}
       {activeTab === 'General' && (
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-6">
               <div className="flex items-center justify-between">
                   <div>
                       <h3 className="font-bold">حالت تاریک (Dark Mode)</h3>
                       <p className="text-sm text-gray-500">تغییر ظاهر سیستم به حالت شب</p>
                   </div>
                   <button 
                        onClick={() => document.documentElement.classList.toggle('dark')}
                        className="px-4 py-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm font-bold"
                   >
                        تغییر وضعیت
                   </button>
               </div>
               <hr className="border-gray-100 dark:border-slate-700"/>
               <div>
                   <h3 className="font-bold mb-2">رنگ تم سیستم</h3>
                   <div className="flex gap-2">
                       {['#14b8a6', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b'].map(c => (
                           <button key={c} className="w-8 h-8 rounded-full shadow-sm" style={{backgroundColor: c}}></button>
                       ))}
                   </div>
               </div>
           </div>
       )}

       {/* --- TAB: ACCOUNTING CATEGORIES --- */}
       {activeTab === 'Accounting' && canManageAccounting && (
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
               <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                   <div className="flex items-center gap-3">
                       <Wallet size={24} className="text-primary-600"/>
                       <div>
                           <h3 className="font-bold text-gray-800 dark:text-white">مدیریت دسته‌بندی‌های حسابداری</h3>
                           <p className="text-sm text-gray-500">تعریف سرفصل‌های درآمد و هزینه</p>
                       </div>
                   </div>
                   <div className="flex gap-3 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                       <button onClick={() => setAccType('income')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${accType === 'income' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-gray-500'}`}>درآمد</button>
                       <button onClick={() => setAccType('expense')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${accType === 'expense' ? 'bg-white dark:bg-slate-700 shadow text-red-600' : 'text-gray-500'}`}>هزینه</button>
                   </div>
                   <button onClick={() => { setCatFormData({}); setCatModalOpen(true); }} className="bg-primary-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-primary-700 transition">
                       <Plus size={18}/> دسته جدید
                   </button>
               </div>

               <div className="space-y-3">
                   {activeCategories.filter(c => c.type === accType && !c.parentId).map(parent => {
                       const children = activeCategories.filter(c => c.parentId === parent.id);
                       return (
                           <div key={parent.id} className="border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-slate-900/20">
                               <div className="flex justify-between items-center p-4">
                                   <div className="flex items-center gap-3">
                                       <div className={`w-2 h-8 rounded-full ${accType === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                       <div>
                                           <h4 className="font-bold text-gray-800 dark:text-white">{parent.name}</h4>
                                           <span className="text-xs text-gray-400">{toPersianDigits(children.length)} زیر‌دسته</span>
                                       </div>
                                   </div>
                                   <div className="flex gap-2">
                                       <button onClick={() => { setCatFormData(parent); setCatModalOpen(true); }} className="p-2 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg hover:text-blue-600 transition shadow-sm"><Edit2 size={16}/></button>
                                       <button onClick={() => handleCategoryDeleteClick(parent.id)} className="p-2 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg hover:text-red-600 transition shadow-sm"><Trash2 size={16}/></button>
                                   </div>
                               </div>
                               
                               {/* Subcategories */}
                               {children.length > 0 && (
                                   <div className="bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 p-2">
                                       {children.map(child => (
                                           <div key={child.id} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg ml-6 border-r-2 border-gray-100 dark:border-slate-700 pr-4">
                                               <div className="flex items-center gap-2">
                                                   <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                   <span className="text-sm text-gray-700 dark:text-gray-300">{child.name}</span>
                                               </div>
                                               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                   <button onClick={() => { setCatFormData(child); setCatModalOpen(true); }} className="text-gray-400 hover:text-blue-500"><Edit2 size={14}/></button>
                                                   <button onClick={() => handleCategoryDeleteClick(child.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                                               </div>
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>
                       );
                   })}
                   {activeCategories.filter(c => c.type === accType && !c.parentId).length === 0 && (
                       <div className="text-center py-12 text-gray-400">
                           هیچ دسته‌ای یافت نشد.
                       </div>
                   )}
               </div>

               {/* Archived Section */}
               {archivedCategories.filter(c => c.type === accType).length > 0 && (
                   <div className="mt-8 border-t pt-6 border-gray-100 dark:border-slate-700">
                       <h4 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2"><Archive size={16}/> آرشیو شده‌ها</h4>
                       <div className="space-y-2">
                           {archivedCategories.filter(c => c.type === accType).map(c => (
                               <div key={c.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-slate-900 rounded-xl opacity-60 hover:opacity-100 transition">
                                   <span className="text-sm font-medium">{c.name} {c.parentId && <span className="text-xs text-gray-400">(زیردسته)</span>}</span>
                                   <button onClick={() => handleRestore(c.id)} className="text-blue-500 hover:bg-blue-50 p-1 rounded flex items-center gap-1 text-xs font-bold">
                                       <RotateCcw size={14}/> بازگردانی
                                   </button>
                               </div>
                           ))}
                       </div>
                   </div>
               )}
           </div>
       )}

       {/* --- TAB: MENU MANAGEMENT --- */}
       {activeTab === 'Menu' && (
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold flex items-center gap-2"><Menu size={18}/> چیدمان منوی کناری</h3>
                   <button onClick={handleSaveSettings} className="bg-primary-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-primary-500/20"><Save size={16}/> ذخیره منو</button>
               </div>
               
               <p className="text-sm text-gray-500 mb-4">آیتم‌ها را با کشیدن و رها کردن (Drag & Drop) مرتب کنید.</p>
               
               <div className="space-y-3 max-w-2xl">
                   {sidebarItems.map((item, idx) => {
                       const Icon = getIcon(item.iconName);
                       return (
                           <div 
                                key={item.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDrop={handleDrop}
                                className={`flex items-center gap-3 p-3 border rounded-xl transition bg-white dark:bg-slate-900 ${
                                    draggedItemIndex === idx ? 'opacity-50 border-primary-500 border-dashed' : 'border-gray-100 dark:border-slate-700 hover:shadow-md'
                                }`}
                           >
                               <div className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing p-1">
                                   <GripVertical size={20}/>
                               </div>
                               
                               <div className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-500">
                                   <Icon size={20}/>
                               </div>
                               
                               <div className="flex-1">
                                   <input 
                                     value={item.label} 
                                     onChange={(e) => updateSidebarLabel(item.id, e.target.value)}
                                     className="bg-transparent font-bold text-gray-800 dark:text-white outline-none w-full border-b border-transparent focus:border-primary-500 py-1 transition text-sm"
                                     placeholder="نام آیتم منو"
                                   />
                                   <span className="text-xs text-gray-400 block mt-0.5">مجوز: {item.requiredPermission}</span>
                               </div>
                               
                               <div className="flex items-center gap-2">
                                   <span className="text-xs text-gray-400 w-10 text-center">{item.isVisible ? 'نمایش' : 'مخفی'}</span>
                                   <button 
                                      onClick={() => toggleSidebarItem(item.id)}
                                      className={`w-10 h-6 rounded-full p-1 transition-colors ${item.isVisible ? 'bg-green-500' : 'bg-gray-300'}`}
                                   >
                                       <div className={`w-4 h-4 bg-white rounded-full transition-transform ${item.isVisible ? '-translate-x-4' : 'translate-x-0'}`}></div>
                                   </button>
                               </div>
                           </div>
                       );
                   })}
               </div>
           </div>
       )}

       {/* ... (Other Tabs Access Control, User Management, Invoice, Business Rules, LogSystem remain same) ... */}
       {/* (Keeping code concise by not repeating sections that didn't change logic, but providing full file structure) */}
       {/* --- TAB: ACCESS CONTROL (RBAC) --- */}
       {activeTab === 'Access Control' && (
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-x-auto">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold flex items-center gap-2"><Shield size={18}/> ماتریس دسترسی نقش‌ها</h3>
                   <button onClick={handleSaveSettings} className="bg-primary-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm"><Save size={16}/> ذخیره دسترسی‌ها</button>
               </div>

               <table className="w-full text-sm min-w-[800px]">
                   <thead>
                       <tr className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                           <th className="p-4 text-right">مجوز (Permission)</th>
                           <th className="p-4 text-center">مدیر (Manager)</th>
                           <th className="p-4 text-center">عضو تیم (Team)</th>
                           <th className="p-4 text-center">مشتری (Client)</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                       {ALL_PERMISSIONS.map(p => (
                           <tr key={p.key} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                               <td className="p-4">
                                   <div className="font-bold text-gray-700 dark:text-gray-200">{p.label}</div>
                                   <div className="text-xs text-gray-400">{p.category}</div>
                               </td>
                               <td className="p-4 text-center">
                                   <input type="checkbox" className="w-5 h-5" checked={roleMatrix[UserRole.Manager]?.includes(p.key)} onChange={() => toggleRolePermission(UserRole.Manager, p.key)}/>
                               </td>
                               <td className="p-4 text-center">
                                   <input type="checkbox" className="w-5 h-5" checked={roleMatrix[UserRole.TeamMember]?.includes(p.key)} onChange={() => toggleRolePermission(UserRole.TeamMember, p.key)}/>
                               </td>
                               <td className="p-4 text-center">
                                   <input type="checkbox" className="w-5 h-5" checked={roleMatrix[UserRole.ClientUser]?.includes(p.key)} onChange={() => toggleRolePermission(UserRole.ClientUser, p.key)}/>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
               <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-xl text-xs">
                   نکته: نقش «مدیر کل (Admin)» به صورت پیش‌فرض دسترسی کامل دارد و در این جدول قابل تغییر نیست.
               </div>
           </div>
       )}

       {/* --- TAB: USER MANAGEMENT --- */}
       {activeTab === 'User Management' && (
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
               <div className="p-4 bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                   <h3 className="font-bold flex items-center gap-2"><Users size={18}/> کاربران و دسترسی‌های خاص</h3>
               </div>
               <table className="w-full text-sm">
                   <thead className="border-b dark:border-slate-700 text-right">
                       <tr>
                           <th className="p-4">نام کاربر</th>
                           <th className="p-4">نقش اصلی</th>
                           <th className="p-4">تغییر نقش</th>
                           <th className="p-4">عملیات</th>
                       </tr>
                   </thead>
                   <tbody>
                       {users.map(u => (
                           <tr key={u.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                               <td className="p-4 font-bold">
                                   {u.firstName} {u.lastName} 
                                   {u.permissionOverrides && Object.keys(u.permissionOverrides).length > 0 && (
                                       <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] mr-2">شخصی‌سازی شده</span>
                                   )}
                                   <span className="text-xs text-gray-400 font-normal block">{u.username}</span>
                               </td>
                               <td className="p-4"><span className="bg-primary-50 text-primary-700 px-2 py-1 rounded-md text-xs">{u.role}</span></td>
                               <td className="p-4">
                                   {user?.role === UserRole.Admin ? (
                                       <select 
                                         value={u.role} 
                                         onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                                         className="bg-gray-100 dark:bg-slate-900 border-none rounded-lg p-2 text-xs outline-none"
                                       >
                                           <option value={UserRole.Admin}>مدیر کل</option>
                                           <option value={UserRole.Manager}>مدیر</option>
                                           <option value={UserRole.TeamMember}>عضو تیم</option>
                                           <option value={UserRole.ClientUser}>مشتری</option>
                                       </select>
                                   ) : <span className="text-gray-400 text-xs">فقط مدیر کل</span>}
                               </td>
                               <td className="p-4 flex gap-2">
                                   {user?.role === UserRole.Admin && u.id !== user.id && (
                                       <button 
                                          onClick={() => handlePreview(u)}
                                          className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100 transition shadow-sm"
                                          title="مشاهده سیستم با دسترسی این کاربر"
                                       >
                                           <Eye size={14}/> مشاهده به‌عنوان
                                       </button>
                                   )}

                                   <button 
                                      onClick={() => setEditingUserOverride(u)}
                                      className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
                                   >
                                       <Lock size={14}/> دسترسی
                                   </button>
                                   <button onClick={(e) => deleteUser(e, u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><Trash2 size={16}/></button>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
       )}

       {/* --- TAB: INVOICE --- */}
       {activeTab === 'Invoice' && (
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-8 font-shabnam">
               {/* ... (Existing Invoice Content) ... */}
               <div className="flex items-center gap-2 text-primary-600 mb-4 border-b pb-2 dark:border-slate-700">
                   <FileText size={24}/>
                   <h3 className="font-bold text-lg">پیکربندی پیش‌فرض فاکتورها</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* Logo */}
                   <div>
                       <label className="block font-bold mb-3 flex items-center gap-2">
                           <ImageIcon size={18}/> لوگوی پیش‌فرض
                       </label>
                       <div className="flex items-start gap-4">
                           <div className="w-32 h-32 bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden">
                               {invoiceSettings.defaultLogoUrl ? (
                                   <img src={invoiceSettings.defaultLogoUrl} className="w-full h-full object-contain"/>
                               ) : <span className="text-xs text-gray-400">بدون لوگو</span>}
                           </div>
                           <div>
                               <label className="cursor-pointer bg-primary-50 text-primary-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-100 transition inline-block">
                                   آپلود تصویر جدید
                                   <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'defaultLogoUrl')}/>
                               </label>
                               <p className="text-xs text-gray-400 mt-2">این لوگو در تمام فاکتورهای جدید استفاده خواهد شد.</p>
                               {invoiceSettings.defaultLogoUrl && (
                                   <button onClick={() => setInvoiceSettings(prev => ({...prev, defaultLogoUrl: ''}))} className="text-xs text-red-500 mt-2 hover:underline">حذف</button>
                               )}
                           </div>
                       </div>
                   </div>

                   {/* Signature */}
                   <div>
                       <label className="block font-bold mb-3 flex items-center gap-2">
                           <PenTool size={18}/> امضای پیش‌فرض
                       </label>
                       <div className="flex items-start gap-4">
                           <div className="w-32 h-32 bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden">
                               {invoiceSettings.defaultSignatureUrl ? (
                                   <img src={invoiceSettings.defaultSignatureUrl} className="w-full h-full object-contain"/>
                               ) : <span className="text-xs text-gray-400">بدون امضا</span>}
                           </div>
                           <div>
                               <label className="cursor-pointer bg-primary-50 text-primary-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-100 transition inline-block">
                                   آپلود تصویر امضا
                                   <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'defaultSignatureUrl')}/>
                               </label>
                               <p className="text-xs text-gray-400 mt-2">امضای دیجیتال پای فاکتورها.</p>
                               {invoiceSettings.defaultSignatureUrl && (
                                   <button onClick={() => setInvoiceSettings(prev => ({...prev, defaultSignatureUrl: ''}))} className="text-xs text-red-500 mt-2 hover:underline">حذف</button>
                               )}
                           </div>
                       </div>
                   </div>
               </div>

               {/* Pricing Config */}
               <div className="border-t border-gray-100 dark:border-slate-700 pt-6">
                   <h4 className="font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-white"><Percent size={18}/> درصدهای افزایشی هوشمند</h4>
                   <p className="text-sm text-gray-500 mb-4">تنظیم درصد افزایش مبلغ برای آپشن‌های مختلف فاکتور (وب‌سایت و اپلیکیشن)</p>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div>
                           <label className="block text-xs font-bold mb-1">زبان اضافه (انگلیسی...)</label>
                           <div className="relative">
                               <input type="number" value={invoiceConfig.extraLangPercent} onChange={e => setInvoiceConfig({...invoiceConfig, extraLangPercent: Number(e.target.value)})} className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-center font-bold"/>
                               <span className="absolute left-3 top-2.5 text-gray-400">%</span>
                           </div>
                       </div>
                       <div>
                           <label className="block text-xs font-bold mb-1">ریسپانسیو موبایل</label>
                           <div className="relative">
                               <input type="number" value={invoiceConfig.mobileRespPercent} onChange={e => setInvoiceConfig({...invoiceConfig, mobileRespPercent: Number(e.target.value)})} className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-center font-bold"/>
                               <span className="absolute left-3 top-2.5 text-gray-400">%</span>
                           </div>
                       </div>
                       <div>
                           <label className="block text-xs font-bold mb-1">ریسپانسیو تبلت</label>
                           <div className="relative">
                               <input type="number" value={invoiceConfig.tabletRespPercent} onChange={e => setInvoiceConfig({...invoiceConfig, tabletRespPercent: Number(e.target.value)})} className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-center font-bold"/>
                               <span className="absolute left-3 top-2.5 text-gray-400">%</span>
                           </div>
                       </div>
                       <div>
                           <label className="block text-xs font-bold mb-1">تم تیره (Dark Mode)</label>
                           <div className="relative">
                               <input type="number" value={invoiceConfig.darkModePercent} onChange={e => setInvoiceConfig({...invoiceConfig, darkModePercent: Number(e.target.value)})} className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-center font-bold"/>
                               <span className="absolute left-3 top-2.5 text-gray-400">%</span>
                           </div>
                       </div>
                   </div>
               </div>

               <div className="max-w-2xl">
                   <label className="block font-bold mb-2">یادداشت پیش‌فرض (شماره حساب / شرایط)</label>
                   <textarea 
                        rows={4} 
                        value={invoiceSettings.defaultProviderNote}
                        onChange={(e) => setInvoiceSettings(prev => ({...prev, defaultProviderNote: e.target.value}))}
                        className="w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:border-primary-500 transition"
                        placeholder="مثال: شماره کارت ۶۰۳۷... به نام شرکت..."
                   />
                   <p className="text-xs text-gray-400 mt-1">این متن در فوتر تمام فاکتورهای جدید کپی می‌شود.</p>
               </div>

               <div className="border-t border-gray-100 dark:border-slate-700 pt-4 flex justify-end">
                   <button onClick={handleSaveSettings} className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition">
                       <Save size={20}/>
                       ذخیره تنظیمات فاکتور
                   </button>
               </div>
           </div>
       )}

       {/* --- TAB: BUSINESS RULES --- */}
       {activeTab === 'Business Rules' && (
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-4">
               <h3 className="font-bold mb-4">قوانین کسب‌وکار</h3>
               <div>
                   <label className="block text-sm font-bold mb-1">حداقل حاشیه سود (%)</label>
                   <input type="number" value={businessRules.minProfitMargin} onChange={e => setBusinessRules({...businessRules, minProfitMargin: Number(e.target.value)})} className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700"/>
               </div>
               <div className="flex items-center gap-2">
                   <input type="checkbox" checked={businessRules.enforceDataFields} onChange={e => setBusinessRules({...businessRules, enforceDataFields: e.target.checked})} className="w-4 h-4"/>
                   <span>الزام ورود تمام فیلدهای اطلاعاتی پروژه</span>
               </div>
               <button onClick={handleSaveSettings} className="bg-primary-600 text-white px-6 py-2 rounded-xl mt-4 flex items-center gap-2"><Save size={18}/> ذخیره</button>
           </div>
       )}

       {/* --- TAB: LOG SYSTEM (Merged) --- */}
       {activeTab === 'LogSystem' && canViewTimeline && (
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
               {/* Unified Header & Toggle */}
               <div className="flex flex-col items-center mb-8">
                   <div className="bg-gray-100 dark:bg-slate-900 p-1 rounded-xl flex gap-1 mb-6">
                        <button
                            onClick={() => setLogSubTab('timeline')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${logSubTab === 'timeline' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Activity size={16}/> تایم‌لاین فعالیت‌ها
                        </button>
                        <button
                            onClick={() => setLogSubTab('technical')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${logSubTab === 'technical' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <List size={16}/> لاگ سیستم
                        </button>
                   </div>
               </div>

               {/* Sub-View: ACTIVITY TIMELINE */}
               {logSubTab === 'timeline' && (
                   <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                           <div>
                               <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-white">
                                   مانیتورینگ رویدادها
                               </h3>
                               <p className="text-sm text-gray-500 mt-1">بررسی روند فعالیت‌های مهم کسب‌وکار</p>
                           </div>
                           
                           <div className="flex flex-wrap gap-3">
                               <div className="relative">
                                   <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                   <input 
                                       placeholder="جستجو در رویدادها..."
                                       value={activityFilter.search}
                                       onChange={(e) => setActivityFilter({...activityFilter, search: e.target.value})}
                                       className="pl-4 pr-10 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 w-48"
                                   />
                               </div>
                               
                               <div className="relative">
                                   <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                   <select 
                                        value={activityFilter.type}
                                        onChange={(e) => setActivityFilter({...activityFilter, type: e.target.value})}
                                        className="pl-4 pr-10 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-sm outline-none cursor-pointer appearance-none"
                                   >
                                       <option value="All">همه فعالیت‌ها</option>
                                       <option value="Project">پروژه</option>
                                       <option value="Finance">مالی</option>
                                       <option value="Invoice">فاکتور</option>
                                       <option value="Task">تسک</option>
                                       <option value="User">کاربران</option>
                                       <option value="System">سیستم</option>
                                   </select>
                               </div>

                               <select 
                                    value={activityFilter.userId}
                                    onChange={(e) => setActivityFilter({...activityFilter, userId: e.target.value})}
                                    className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-sm outline-none cursor-pointer"
                               >
                                   <option value="All">همه کاربران</option>
                                   {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                               </select>
                           </div>
                       </div>

                       <div className="relative pr-6 border-r border-gray-200 dark:border-slate-700 space-y-8">
                           {getFilteredActivities().length === 0 ? (
                               <div className="text-center py-12 text-gray-400">
                                   <Activity size={48} className="mx-auto mb-4 opacity-20"/>
                                   <p>هیچ فعالیتی با این مشخصات ثبت نشده است.</p>
                               </div>
                           ) : (
                               getFilteredActivities().map(log => {
                                   const meta = getActivityMeta(log.action);
                                   const ActivityIcon = meta.icon;
                                   const actor = users.find(u => u.id === log.userId);
                                   
                                   return (
                                       <div key={log.id} className="relative group">
                                           {/* Timeline Dot */}
                                           <div className={`absolute -right-[31px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${meta.color.split(' ')[1].replace('bg-', 'bg-')} ring-4 ring-white dark:ring-slate-800`}></div>
                                           
                                           <div className="flex flex-col sm:flex-row gap-4 items-start bg-gray-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700 transition hover:shadow-md">
                                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${meta.color}`}>
                                                   <ActivityIcon size={20}/>
                                               </div>
                                               
                                               <div className="flex-1 min-w-0">
                                                   <div className="flex justify-between items-start mb-1">
                                                       <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${meta.color.replace('text-', 'bg-opacity-10 bg-')}`}>
                                                           {meta.label}
                                                       </span>
                                                       <span className="text-xs text-gray-400 flex items-center gap-1 dir-ltr">
                                                           {formatJalaliShort(log.timestamp)} <Clock size={12}/>
                                                       </span>
                                                   </div>
                                                   
                                                   <p className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1 line-clamp-2 leading-6">
                                                       {log.details}
                                                   </p>
                                                   
                                                   {/* Corrected User Icon Layout */}
                                                   <div className="flex items-center gap-2 mt-3">
                                                       <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-slate-600 shadow-sm">
                                                           {actor?.avatarUrl ? (
                                                               <img src={actor.avatarUrl} className="w-full h-full object-cover"/>
                                                           ) : (
                                                               <Users size={12} className="text-gray-400"/>
                                                           )}
                                                       </div>
                                                       <span className="text-xs text-gray-500 flex items-center gap-1 h-6">
                                                           توسط <span className="font-bold text-gray-700 dark:text-gray-300">{actor ? `${actor.firstName} ${actor.lastName}` : 'سیستم'}</span>
                                                       </span>
                                                   </div>
                                               </div>
                                           </div>
                                       </div>
                                   );
                               })
                           )}
                       </div>
                   </div>
               )}

               {/* Sub-View: TECHNICAL LOGS */}
               {logSubTab === 'technical' && (
                   <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                       <div className="rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                           <div className="p-4 bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700">
                               <h3 className="font-bold text-gray-500 text-sm">لیست کامل لاگ‌های فنی (Technical Logs)</h3>
                           </div>
                           <table className="w-full text-sm">
                               <thead className="bg-gray-50 dark:bg-slate-900 text-right">
                                   <tr>
                                       <th className="p-4">شناسه کاربر</th>
                                       <th className="p-4">کد عملیات</th>
                                       <th className="p-4">جزئیات فنی</th>
                                       <th className="p-4">زمان ثبت</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {logs.slice(0, 50).map(log => (
                                       <tr key={log.id} className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                           <td className="p-4 text-gray-500 font-mono text-xs">{log.userId}</td>
                                           <td className="p-4">
                                               <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">{log.action}</span>
                                           </td>
                                           <td className="p-4 text-xs text-gray-500 truncate max-w-xs">{log.details}</td>
                                           <td className="p-4 text-gray-500 dir-ltr text-right text-xs">{formatJalaliShort(log.timestamp)}</td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                   </div>
               )}
           </div>
       )}

       {/* MODAL: User Specific Overrides */}
       <Modal isOpen={!!editingUserOverride} onClose={() => setEditingUserOverride(null)} title={`تنظیم دسترسی: ${editingUserOverride?.firstName} ${editingUserOverride?.lastName}`}>
           <div className="space-y-4">
               <p className="text-sm text-gray-500">
                   در اینجا می‌توانید دسترسی‌های خاصی را برای این کاربر، مستقل از نقش «{editingUserOverride?.role}» فعال یا غیرفعال کنید.
               </p>
               <div className="h-96 overflow-y-auto custom-scrollbar border rounded-xl p-2">
                   <table className="w-full text-sm">
                       <thead>
                           <tr className="bg-gray-50 sticky top-0">
                               <th className="p-2 text-right">مجوز</th>
                               <th className="p-2 text-center w-24">وضعیت</th>
                           </tr>
                       </thead>
                       <tbody>
                           {ALL_PERMISSIONS.map(p => {
                               // Calculate current state (Default Role + Override)
                               const roleDefaults = roleMatrix[editingUserOverride?.role as UserRole] || [];
                               const isDefaultAllow = roleDefaults.includes(p.key);
                               const override = editingUserOverride?.permissionOverrides?.[p.key];
                               
                               // Final state
                               const isAllowed = override !== undefined ? override : isDefaultAllow;

                               return (
                                   <tr key={p.key} className="border-b last:border-0 hover:bg-gray-50">
                                       <td className="p-3">
                                           <div className="font-bold">{p.label}</div>
                                           <div className="text-xs text-gray-400">{p.category}</div>
                                       </td>
                                       <td className="p-3 text-center">
                                           <div className="flex items-center justify-center gap-2">
                                                {/* Override Controls */}
                                                {override === undefined ? (
                                                    <span className={`text-xs px-2 py-1 rounded ${isDefaultAllow ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                                                        {isDefaultAllow ? 'مجاز (نقش)' : 'ممنوع (نقش)'}
                                                    </span>
                                                ) : (
                                                    <span className={`text-xs px-2 py-1 rounded ${override ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        {override ? 'مجاز (دستی)' : 'ممنوع (دستی)'}
                                                    </span>
                                                )}
                                                
                                                {/* Toggle Logic */}
                                                <div className="flex bg-gray-100 rounded-lg p-0.5">
                                                    <button 
                                                        onClick={() => toggleUserOverride(p.key, true)} 
                                                        className={`p-1 rounded ${override === true ? 'bg-green-500 text-white' : 'text-gray-400'}`}
                                                        title="Force Allow"
                                                    ><CheckCircle size={14}/></button>
                                                    <button 
                                                        onClick={() => toggleUserOverride(p.key, undefined)} 
                                                        className={`p-1 rounded ${override === undefined ? 'bg-white text-gray-600 shadow' : 'text-gray-400'}`}
                                                        title="Reset to Role"
                                                    >●</button>
                                                    <button 
                                                        onClick={() => toggleUserOverride(p.key, false)} 
                                                        className={`p-1 rounded ${override === false ? 'bg-red-500 text-white' : 'text-gray-400'}`}
                                                        title="Force Deny"
                                                    ><XCircle size={14}/></button>
                                                </div>
                                           </div>
                                       </td>
                                   </tr>
                               );
                           })}
                       </tbody>
                   </table>
               </div>
               <div className="flex justify-end pt-4 border-t">
                   <button onClick={handleUserOverrideSave} className="bg-primary-600 text-white px-6 py-2 rounded-xl font-bold">ذخیره تغییرات کاربر</button>
               </div>
           </div>
       </Modal>

       {/* MODAL: Accounting Category (New) */}
       <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title={catFormData.id ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی جدید'} size="sm">
           <form onSubmit={handleCategorySave} className="space-y-4">
               <div>
                   <label className="block text-sm font-bold mb-1">نام دسته</label>
                   <input 
                       value={catFormData.name || ''} 
                       onChange={e => setCatFormData({...catFormData, name: e.target.value})} 
                       className="w-full p-3 rounded-xl border bg-gray-50 dark:bg-slate-900 dark:border-slate-700 outline-none" 
                       placeholder="مثلاً: حقوق و دستمزد"
                       required
                       autoFocus
                   />
               </div>
               <div>
                   <label className="block text-sm font-bold mb-1">دسته مادر (اختیاری)</label>
                   <select 
                       value={catFormData.parentId || ''} 
                       onChange={e => setCatFormData({...catFormData, parentId: e.target.value || undefined})}
                       className="w-full p-3 rounded-xl border bg-gray-50 dark:bg-slate-900 dark:border-slate-700 outline-none cursor-pointer"
                   >
                       <option value="">(بدون والد - دسته اصلی)</option>
                       {activeCategories.filter(c => c.type === accType && !c.parentId && c.id !== catFormData.id).map(c => (
                           <option key={c.id} value={c.id}>{c.name}</option>
                       ))}
                   </select>
                   <p className="text-[10px] text-gray-400 mt-1">اگر دسته اصلی است، این فیلد را خالی بگذارید.</p>
               </div>
               <div className="pt-2 flex justify-end gap-2">
                   <button type="button" onClick={() => setCatModalOpen(false)} className="px-4 py-2 border rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition">انصراف</button>
                   <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition">ذخیره</button>
               </div>
           </form>
        </Modal>
    </div>
  );
};

export default SettingsView;
