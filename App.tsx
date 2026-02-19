
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, FolderKanban, Briefcase, Settings, 
  LogOut, Menu, Bell, Clock, Plus, Wallet, ChevronRight, X, Check, Search, MessageSquare, FileText, Eye, AlertCircle, CheckCircle, UserCheck
} from 'lucide-react';

import { initDB, api } from './services/db';
import { User, UserRole, Task, AppSettings, PermissionKey, ToastMessage, ToastType, Notification } from './types';
import { toPersianDigits, formatJalali, generateId, checkPermission, getIcon, DEFAULT_SIDEBAR_CONFIG, getRelativeDateLabel } from './utils';
import { Modal, JalaliDatePicker, ToastContainer } from './components/Shared';

// Views
import LoginView from './views/Login';
import DashboardView from './views/Dashboard';
import ClientsView from './views/Clients';
import ProjectsView from './views/Projects';
import TeamView from './views/Team';
import FinanceView from './views/Finance';
import SettingsView from './views/Settings';
import MessagesView from './views/Messages';
import InvoicesView from './views/Invoices';
import InvoiceEditor from './views/InvoiceEditor';
import InvoicePrint from './views/InvoicePrint';
import NotificationsView from './views/NotificationsView'; 

// Contexts
interface AuthContextType {
  user: User | null;
  // Preview Mode
  previewUser: User | null;
  setPreviewUser: (u: User | null) => void;
  // Settings & Permissions
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
  
  login: (u: User) => void;
  logout: () => void;
  loading: boolean;
  hasPermission: (perm: PermissionKey) => boolean;

  // Toast
  showToast: (message: string, type: ToastType) => void;
}
const AuthContext = createContext<AuthContextType>(null!);

// --- Layout Components ---

const SidebarItem = ({ to, icon: Icon, label, active, badge, hasPulse }: any) => {
    const navigate = useNavigate();
    return (
      <div 
        className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl cursor-pointer transition-all duration-200 mb-1 relative
        ${active 
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 shadow-sm font-bold' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        onClick={() => navigate(to)}
      >
        {Icon && <Icon size={20} />}
        <span className="text-sm flex-1">{label}</span>
        
        {/* Badge & Pulse Logic */}
        {(badge > 0 || hasPulse) && (
            <div className="flex items-center gap-1">
                {hasPulse && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                )}
                {badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {toPersianDigits(badge > 99 ? '99+' : badge)}
                    </span>
                )}
            </div>
        )}
      </div>
    );
};

const Sidebar = ({ user, settings, unreadMessages }: { user: User, settings: AppSettings | null, unreadMessages: number }) => {
  const location = useLocation();
  
  // Use config from settings, or fallback
  const items = settings?.sidebarConfig || DEFAULT_SIDEBAR_CONFIG;
  // Sort items
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed top-0 right-0 h-full w-64 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 z-50 flex flex-col shadow-lg transition-colors no-print">
      <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-slate-700">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-500 to-primary-300 flex items-center justify-center text-white font-bold shadow-md">
          X
        </div>
        <div>
          <h1 className="font-extrabold text-xl text-gray-800 dark:text-white tracking-tight">XRM</h1>
          <p className="text-xs text-gray-400">سیستم جامع مدیریت</p>
        </div>
      </div>
      
      <div className="flex-1 py-6 overflow-y-auto custom-scrollbar">
        {sortedItems.map(item => {
            if (!item.isVisible) return null;
            if (item.requiredPermission && !checkPermission(user, item.requiredPermission, settings)) return null;

            // Message specific props
            const isMessageItem = item.id === 'messages';
            const badgeCount = isMessageItem ? unreadMessages : 0;
            const pulse = isMessageItem && unreadMessages > 0;

            return (
                <SidebarItem 
                    key={item.id}
                    to={item.path} 
                    icon={getIcon(item.iconName)} 
                    label={item.label} 
                    active={location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))}
                    badge={badgeCount}
                    hasPulse={pulse}
                />
            );
        })}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-slate-700">
        <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
             {user.avatarUrl ? <img src={user.avatarUrl} alt="User" /> : <Users size={18} className="text-gray-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-gray-500 truncate">{user.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TopBar = () => {
  const { user, logout, previewUser, setPreviewUser, showToast } = useContext(AuthContext);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInterval, setTimerInterval] = useState<any>(null);
  
  // Task State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [quickTaskText, setQuickTaskText] = useState('');
  
  // Range Task
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskEndDate, setTaskEndDate] = useState('');

  // Notification State
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const navigate = useNavigate();

  // Load Notifications
  useEffect(() => {
      const fetchNotifs = async () => {
          if(user) {
              const data = await api.notifications.getAll(user.id);
              setNotifications(data);
          }
      };
      fetchNotifs();
      const interval = setInterval(fetchNotifs, 10000); // Poll every 10s
      
      const handleUpdate = () => fetchNotifs();
      window.addEventListener('notificationUpdated', handleUpdate);
      
      return () => {
          clearInterval(interval);
          window.removeEventListener('notificationUpdated', handleUpdate);
      };
  }, [user]);

  // Click Outside for Notification Dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
              setShowNotif(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    api.logs.add(user?.id || '', 'START_TIMER', 'شروع تایمر کار');
    const interval = setInterval(() => {
      setCurrentTime(prev => prev + 1);
    }, 1000);
    setTimerInterval(interval);
    showToast('تایمر شروع شد', 'success');
  };

  const handleStopTimer = () => {
    setIsTimerRunning(false);
    if (timerInterval) clearInterval(timerInterval);
    api.logs.add(user?.id || '', 'STOP_TIMER', `توقف تایمر. مدت: ${formatTime(currentTime)}`);
    showToast(`تایمر متوقف شد. مدت: ${formatTime(currentTime)}`, 'info');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return toPersianDigits(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleQuickTask = async (e: React.FormEvent) => {
    e.preventDefault(); 
    e.stopPropagation();

    if(quickTaskText) {
      await api.tasks.create({
          id: generateId(),
          title: quickTaskText,
          deadline: taskEndDate || undefined, 
          isDone: false,
          createdAt: new Date().toISOString()
      });
      api.logs.add(user?.id || '', 'CREATE_TASK', `تسک سریع: ${quickTaskText}`);
      showToast('تسک جدید با موفقیت ثبت شد', 'success');
      
      setQuickTaskText('');
      setTaskStartDate('');
      setTaskEndDate('');
      setShowTaskModal(false);
      window.dispatchEvent(new Event('taskUpdated'));
    }
  };
  
  useEffect(() => {
      if(searchQuery.length > 2) {
          const runSearch = async () => {
              const clients = await api.clients.getAll();
              const projects = await api.projects.getAll();
              const foundClients = clients.filter(c => c.name.includes(searchQuery)).map(c => ({...c, type: 'مشتری', link: '/clients'}));
              const foundProjects = projects.filter(p => p.title.includes(searchQuery)).map(p => ({...p, type: 'پروژه', name: p.title, link: '/projects'}));
              setSearchResults([...foundClients, ...foundProjects]);
          };
          runSearch();
      } else {
          setSearchResults([]);
      }
  }, [searchQuery]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
    {/* Impersonation Banner */}
    {previewUser && (
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 text-sm font-bold flex flex-col sm:flex-row justify-between items-center sticky top-0 z-[60] shadow-lg animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-2 sm:mb-0">
              <div className="p-1.5 bg-white/20 rounded-full animate-pulse">
                  <UserCheck size={20} />
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-2">
                  <span className="opacity-90">در حال مشاهده سیستم به‌عنوان:</span>
                  <span className="bg-black/20 px-2 rounded text-white border border-white/20">
                      {previewUser.firstName} {previewUser.lastName} ({previewUser.role})
                  </span>
              </div>
          </div>
          <button 
             onClick={() => setPreviewUser(null)} 
             className="bg-white text-amber-700 hover:bg-gray-100 px-4 py-1.5 rounded-lg transition text-xs font-black shadow-sm flex items-center gap-2"
          >
              <LogOut size={14}/> بازگشت به حالت مدیرکل
          </button>
      </div>
    )}

    <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 sticky top-0 z-40 transition-colors shadow-sm no-print">
      <div className="flex items-center gap-6">
        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700">
          {formatJalali(new Date().toISOString())}
        </div>
        
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 rounded-full px-1 py-1 border border-gray-100 dark:border-slate-700">
           {!isTimerRunning ? (
             <button onClick={handleStartTimer} className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition shadow-sm">
               <Plus size={16} />
             </button>
           ) : (
             <button onClick={handleStopTimer} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition shadow-sm animate-pulse">
               <div className="w-3 h-3 bg-white rounded-sm"></div>
             </button>
           )}
           <span className="px-3 font-mono text-lg font-bold text-primary-600 dark:text-primary-400 dir-ltr">
             {formatTime(currentTime)}
           </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
            <div className={`flex items-center bg-gray-50 dark:bg-slate-900 rounded-xl transition-all duration-300 ${showSearch ? 'w-64 px-3' : 'w-10 px-0 justify-center'}`}>
                <button onClick={() => setShowSearch(!showSearch)} className="p-2 text-gray-500">
                    <Search size={20} />
                </button>
                {showSearch && (
                    <>
                    <input 
                        className="bg-transparent border-none outline-none w-full text-sm" 
                        placeholder="جستجو..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    {searchQuery && (
                        <button onClick={() => {setSearchQuery(''); document.querySelector('input')?.focus()}} className="text-gray-400 hover:text-red-500">
                            <X size={14} />
                        </button>
                    )}
                    </>
                )}
            </div>
            {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 w-64 bg-white dark:bg-slate-800 shadow-xl rounded-xl mt-2 p-2 z-50 border border-gray-100 dark:border-slate-700">
                    {searchResults.map((item, i) => (
                        <div key={i} className="p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer" onClick={() => navigate(item.link)}>
                            <div className="text-sm font-bold">{item.name}</div>
                            <div className="text-xs text-gray-400">{item.type}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <button 
           onClick={() => setShowTaskModal(true)}
           className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition" 
           title="افزودن تسک سریع"
        >
          <Clock size={20} />
        </button>
        
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button 
             onClick={() => setShowNotif(!showNotif)}
             className={`p-2 rounded-xl transition relative ${showNotif ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
          >
            <Bell size={20} className={unreadCount > 0 ? 'animate-swing' : ''}/>
            {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                </span>
            )}
          </button>
          
          {showNotif && (
             <div className="absolute top-full left-0 mt-3 w-80 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-700 z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden font-shabnam">
               <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                   <h4 className="font-bold text-gray-800 dark:text-white text-sm">اعلان‌ها ({toPersianDigits(unreadCount)})</h4>
                   <button onClick={() => { if(user) api.notifications.markAllAsRead(user.id); }} className="text-xs text-primary-600 hover:underline">خواندن همه</button>
               </div>
               <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                   {notifications.length > 0 ? notifications.slice(0, 5).map(n => (
                       <div 
                            key={n.id} 
                            onClick={async () => {
                                if(!n.isRead && user) await api.notifications.markAsRead(n.id, user.id);
                                if(n.link) { navigate(n.link); setShowNotif(false); }
                            }}
                            className={`p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition relative group ${n.isRead ? 'opacity-70' : 'bg-blue-50/30'}`}
                       >
                           {!n.isRead && <span className="absolute top-4 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                           <div className="flex justify-between mb-1">
                               <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate pr-2">{n.title}</span>
                               <span className="text-[10px] text-gray-400 whitespace-nowrap">{getRelativeDateLabel(new Date(n.createdAt))}</span>
                           </div>
                           <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                       </div>
                   )) : (
                       <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                           <Bell size={24} className="mb-2 opacity-30"/>
                           <span className="text-xs">هیچ اعلان جدیدی ندارید</span>
                       </div>
                   )}
               </div>
               <div className="p-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-center">
                   <button 
                      onClick={() => { 
                          setShowNotif(false); 
                          navigate('/notifications');
                      }} 
                      className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary-600 w-full py-2 flex items-center justify-center gap-1"
                   >
                       <span>مشاهده همه اعلان‌ها</span>
                       <ChevronRight size={12} className="rotate-180"/>
                   </button>
               </div>
             </div>
          )}
        </div>
        
        <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-1"></div>

        <div 
          className="relative"
          onMouseEnter={() => setShowProfileMenu(true)}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <div className="flex items-center gap-2 cursor-pointer py-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{user?.firstName}</span>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
          </div>
          
          {showProfileMenu && (
            <div className="absolute top-full left-0 w-48 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200">
               <button onClick={logout} className="w-full text-right px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                 <LogOut size={16} />
                 خروج از سیستم
               </button>
            </div>
          )}
        </div>
      </div>
    </header>

    <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="تسک سریع">
       <form onSubmit={handleQuickTask}>
          <textarea 
            className="w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none mb-4"
            rows={2}
            placeholder="چه کاری باید انجام دهید؟"
            value={quickTaskText}
            onChange={e => setQuickTaskText(e.target.value)}
            onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleQuickTask(e);
                }
            }}
            autoFocus
          ></textarea>
          
          <div className="mb-4">
              <JalaliDatePicker 
                  label="انتخاب بازه زمانی (ددلاین)"
                  isRange={true}
                  startDate={taskStartDate}
                  endDate={taskEndDate}
                  onRangeChange={(start, end) => {
                      setTaskStartDate(start);
                      setTaskEndDate(end);
                  }}
              />
          </div>

          <div className="flex justify-end">
             <button type="button" onClick={handleQuickTask} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-xl font-bold transition">ثبت</button>
          </div>
       </form>
    </Modal>
    </>
  );
};

const ProtectedLayout = () => {
  const { user, previewUser, settings } = useContext(AuthContext);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  
  // Decide who is the "Effective User" (Actual or Preview)
  // This logic is now handled in Context Provider, so `user` here is already effective user
  // But we still pass it for clarity if needed.
  // Actually, due to Context change in App component, `user` from context IS the effective user.
  
  useEffect(() => {
      const fetchMsgs = async () => {
          if (user) {
              const count = await api.messages.getUnreadMessagesCount(user.id);
              setUnreadMsgCount(count);
          }
      };
      
      fetchMsgs();
      const interval = setInterval(fetchMsgs, 10000); 
      
      const handleUpdate = () => fetchMsgs();
      window.addEventListener('messagesUpdated', handleUpdate);
      
      return () => {
          clearInterval(interval);
          window.removeEventListener('messagesUpdated', handleUpdate);
      };
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      <Sidebar user={user} settings={settings} unreadMessages={unreadMsgCount} />
      <div className="mr-64 transition-all duration-300 print:mr-0">
        <TopBar />
        <main className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 print:p-0 print:max-w-none">
           <Routes>
             <Route path="/" element={<DashboardView />} />
             <Route path="/clients" element={<ClientsView />} />
             <Route path="/projects" element={<ProjectsView />} />
             <Route path="/invoices" element={<InvoicesView />} />
             <Route path="/invoices/new" element={<InvoiceEditor />} />
             <Route path="/invoices/edit/:id" element={<InvoiceEditor />} />
             <Route path="/invoices/:id/print" element={<InvoicePrint />} />
             <Route path="/team" element={<TeamView />} />
             <Route path="/finance" element={<FinanceView />} />
             <Route path="/messages" element={<MessagesView />} />
             <Route path="/settings" element={<SettingsView />} />
             <Route path="/notifications" element={<NotificationsView />} />
             <Route path="*" element={<Navigate to="/" />} />
           </Routes>
        </main>
      </div>
    </div>
  );
};

// --- App Root ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    initDB();
    // Trigger automation checks (e.g. deadlines)
    api.automation.runChecks();
    
    const storedUser = localStorage.getItem('xrm_current_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    refreshSettings().then(() => setLoading(false));
  }, []);

  const refreshSettings = async () => {
      const s = await api.settings.get();
      setSettings(s);
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('xrm_current_user', JSON.stringify(userData));
    showToast(`خوش آمدید ${userData.firstName}`, 'success');
  };

  const logout = () => {
    setUser(null);
    setPreviewUser(null);
    localStorage.removeItem('xrm_current_user');
  };

  // --- Impersonation Wrapper with Logging ---
  const handleSetPreviewUser = (targetUser: User | null) => {
      if (targetUser) {
          // Start Impersonation
          api.logs.add(user?.id || '', 'IMPERSONATION_START', `View as ${targetUser.firstName} ${targetUser.lastName} (${targetUser.role})`);
          setPreviewUser(targetUser);
      } else {
          // End Impersonation
          api.logs.add(user?.id || '', 'IMPERSONATION_END', 'Returned to Admin Mode');
          setPreviewUser(null);
      }
  };

  const hasPermission = (perm: PermissionKey) => {
      // Check against EFFECTIVE user
      const u = previewUser || user;
      return checkPermission(u, perm, settings);
  };

  const showToast = (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading XRM...</div>;

  // Context value swaps 'user' with impersonated user if active
  const effectiveUser = previewUser || user;

  return (
    <AuthContext.Provider value={{ 
        user: effectiveUser, // PASS EFFECTIVE USER TO ALL COMPONENTS
        login, logout, loading, 
        settings, refreshSettings, 
        hasPermission,
        previewUser, 
        setPreviewUser: handleSetPreviewUser,
        showToast
    }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export { AuthContext };
export default App;
