
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Notification, NotificationType, UserRole, NotificationPriority, ManagerialBroadcast, User } from '../types';
import { Bell, CheckCircle, Search, Filter, MessageSquare, Briefcase, FileText, CheckSquare, Settings as SettingsIcon, Trash2, ChevronLeft, Clock, Megaphone, AlertCircle, AlertTriangle, Info, Send, Users, Eye, PieChart, Calendar } from 'lucide-react';
import { formatJalaliShort, toPersianDigits, generateId } from '../utils';
import { useNavigate } from 'react-router-dom';
import { Modal, JalaliDatePicker } from '../components/Shared';

const NotificationsView = () => {
    const { user, showToast } = useContext(AuthContext);
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filterType, setFilterType] = useState<NotificationType | 'All'>('All');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Unread'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // --- Managerial State ---
    const [isManagerialModalOpen, setIsManagerialModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [broadcasts, setBroadcasts] = useState<ManagerialBroadcast[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // Tracking State
    const [selectedBroadcastStats, setSelectedBroadcastStats] = useState<{total: number, seen: number, readers: string[]} | null>(null);
    const [showStatsModal, setShowStatsModal] = useState(false);

    // Form State
    const [broadcastForm, setBroadcastForm] = useState<{
        title: string;
        message: string;
        priority: NotificationPriority;
        targetAudience: 'All' | 'Team' | 'Clients' | 'Manual';
        selectedUsers: string[]; // IDs
        expiryDate: string; // Jalali String for UI
        expiryDateIso?: string; // ISO String for Backend
    }>({
        title: '',
        message: '',
        priority: 'Normal',
        targetAudience: 'All',
        selectedUsers: [],
        expiryDate: '',
        expiryDateIso: ''
    });

    const isAdmin = user?.role === UserRole.Admin;

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        const data = await api.notifications.getAll(user.id);
        setNotifications(data);
        
        if (isAdmin) {
             const u = await api.users.getAll();
             setAllUsers(u);
        }
        
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        const handleUpdate = () => loadData();
        window.addEventListener('notificationUpdated', handleUpdate);
        return () => window.removeEventListener('notificationUpdated', handleUpdate);
    }, [user]);

    const handleMarkAllRead = async () => {
        if (!user) return;
        await api.notifications.markAllAsRead(user.id);
        showToast('همه اعلان‌ها خوانده شدند', 'success');
    };

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.isRead && user) {
            await api.notifications.markAsRead(notif.id, user.id);
        }
        if (notif.link) {
            navigate(notif.link);
        }
    };

    // --- Managerial Logic ---

    const openManagerialModal = () => {
        setBroadcastForm({
            title: '',
            message: '',
            priority: 'Normal',
            targetAudience: 'All',
            selectedUsers: [],
            expiryDate: '',
            expiryDateIso: ''
        });
        setIsManagerialModalOpen(true);
    };

    const openHistoryModal = async () => {
        const history = await api.notifications.getBroadcasts();
        setBroadcasts(history);
        setIsHistoryModalOpen(true);
    };

    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin || !user) return;
        if (!broadcastForm.title || !broadcastForm.message) return;

        let recipients: string[] = [];

        if (broadcastForm.targetAudience === 'Manual') {
            if (broadcastForm.selectedUsers.length === 0) {
                showToast('لطفاً حداقل یک گیرنده انتخاب کنید', 'error');
                return;
            }
            recipients = broadcastForm.selectedUsers;
        } else {
            // Filter users based on audience
            recipients = allUsers.filter(u => {
                if (broadcastForm.targetAudience === 'All') return true;
                if (broadcastForm.targetAudience === 'Team') return u.role === UserRole.Manager || u.role === UserRole.TeamMember || u.role === UserRole.Admin;
                if (broadcastForm.targetAudience === 'Clients') return u.role === UserRole.ClientUser || u.role === UserRole.ConnectionUser;
                return false;
            }).map(u => u.id);
        }

        if (recipients.length === 0) {
            showToast('کاربری با این مشخصات یافت نشد', 'warning');
            return;
        }

        const newBroadcast: ManagerialBroadcast = {
            id: generateId(),
            adminId: user.id,
            title: broadcastForm.title,
            message: broadcastForm.message,
            priority: broadcastForm.priority,
            targetAudience: broadcastForm.targetAudience,
            recipientCount: recipients.length,
            createdAt: new Date().toISOString(),
            expiryDate: broadcastForm.expiryDateIso || undefined
        };

        await api.notifications.createBroadcast(newBroadcast, recipients);
        
        setIsManagerialModalOpen(false);
        showToast(`اعلان با موفقیت برای ${toPersianDigits(recipients.length)} کاربر ارسال شد`, 'success');
        loadData(); // To see it immediately if admin included themselves
    };

    const handleViewStats = async (batchId: string) => {
        const stats = await api.notifications.getBroadcastStats(batchId);
        setSelectedBroadcastStats(stats);
        setShowStatsModal(true);
    };

    const toggleUserSelection = (userId: string) => {
        setBroadcastForm(prev => {
            const current = prev.selectedUsers;
            if (current.includes(userId)) {
                return { ...prev, selectedUsers: current.filter(id => id !== userId) };
            } else {
                return { ...prev, selectedUsers: [...current, userId] };
            }
        });
    };

    // --- UI Helpers ---

    const filtered = notifications.filter(n => {
        const matchesType = filterType === 'All' ? true : n.type === filterType;
        const matchesStatus = filterStatus === 'All' ? true : !n.isRead;
        const matchesSearch = n.title.includes(searchQuery) || n.message.includes(searchQuery);
        return matchesType && matchesStatus && matchesSearch;
    });

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'Message': return { icon: MessageSquare, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' };
            case 'Project': return { icon: Briefcase, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' };
            case 'Financial': return { icon: FileText, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30' };
            case 'Task': return { icon: CheckSquare, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' };
            case 'System': return { icon: SettingsIcon, color: 'text-gray-500 bg-gray-100 dark:bg-gray-700' };
            case 'Managerial': return { icon: Megaphone, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30' };
            default: return { icon: Bell, color: 'text-gray-500 bg-gray-100' };
        }
    };

    const getPriorityStyles = (priority?: NotificationPriority) => {
        switch (priority) {
            case 'Urgent': return 'border-red-500 bg-red-50 dark:bg-red-900/10 dark:border-red-900';
            case 'High': return 'border-orange-400 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-900';
            default: return 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800'; // Normal
        }
    };

    return (
        <div className="font-shabnam animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Bell className="text-primary-600" /> مرکز اعلان‌ها
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">مدیریت رویدادها و پیام‌های سیستم</p>
                </div>
                
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                             <button 
                                onClick={openHistoryModal}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                            >
                                <Clock size={16} /> تاریخچه
                            </button>
                            <button 
                                onClick={openManagerialModal}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-500/20"
                            >
                                <Megaphone size={16} /> ارسال اعلان
                            </button>
                        </>
                    )}
                    <button 
                        onClick={handleMarkAllRead}
                        disabled={!notifications.some(n => !n.isRead)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
                    >
                        <CheckCircle size={16} /> خواندن همه
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary-500/20 transition text-sm"
                        placeholder="جستجو در اعلان‌ها..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
                    <select 
                        value={filterType} 
                        onChange={e => setFilterType(e.target.value as any)}
                        className="px-4 py-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl text-sm outline-none cursor-pointer border-r-8 border-transparent"
                    >
                        <option value="All">همه دسته‌ها</option>
                        <option value="System">سیستمی</option>
                        <option value="Project">پروژه</option>
                        <option value="Financial">مالی</option>
                        <option value="Task">تسک</option>
                        <option value="Message">پیام</option>
                        <option value="Managerial">مدیریتی</option>
                    </select>

                    <div className="flex bg-gray-50 dark:bg-slate-900 p-1 rounded-xl">
                        <button 
                            onClick={() => setFilterStatus('All')} 
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterStatus === 'All' ? 'bg-white dark:bg-slate-700 shadow text-gray-800 dark:text-white' : 'text-gray-500'}`}
                        >
                            همه
                        </button>
                        <button 
                            onClick={() => setFilterStatus('Unread')} 
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterStatus === 'Unread' ? 'bg-white dark:bg-slate-700 shadow text-gray-800 dark:text-white' : 'text-gray-500'}`}
                        >
                            خوانده‌نشده
                        </button>
                    </div>
                </div>
            </div>

            {/* Notifications List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">در حال بارگذاری...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
                        <Bell size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 font-bold">هیچ اعلانی یافت نشد.</p>
                    </div>
                ) : (
                    filtered.map(notif => {
                        const { icon: Icon, color } = getIcon(notif.type);
                        const priorityClass = getPriorityStyles(notif.priority);
                        const isUrgent = notif.priority === 'Urgent';
                        
                        return (
                            <div 
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`relative flex items-center gap-4 p-4 rounded-2xl border transition cursor-pointer group hover:shadow-md 
                                ${priorityClass}
                                ${notif.isRead ? 'opacity-90 hover:opacity-100' : ''}`}
                            >
                                {/* Unread Dot */}
                                {!notif.isRead && (
                                    <div className={`absolute top-4 left-4 w-2 h-2 rounded-full ${isUrgent ? 'bg-red-600 animate-ping' : 'bg-blue-500'}`}></div>
                                )}

                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
                                    <Icon size={20} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`text-sm font-bold truncate ${notif.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                                                {notif.title}
                                            </h4>
                                            {notif.isManagerial && (
                                                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">مدیریتی</span>
                                            )}
                                            {notif.priority && notif.priority !== 'Normal' && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${notif.priority === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {notif.priority === 'Urgent' ? 'فوری' : 'مهم'}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-400 flex items-center gap-1 pl-4">
                                            {formatJalaliShort(notif.createdAt)} <Clock size={10} />
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                        {notif.message}
                                    </p>
                                </div>

                                {notif.link && (
                                    <div className="text-gray-300 group-hover:text-primary-500 transition px-2">
                                        <ChevronLeft size={20} />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- MODALS (ADMIN ONLY) --- */}
            
            {isAdmin && (
                <Modal isOpen={isManagerialModalOpen} onClose={() => setIsManagerialModalOpen(false)} title="ارسال اعلان مدیریتی جدید">
                    <form onSubmit={handleSendBroadcast} className="space-y-4">
                         <div>
                             <label className="block text-sm font-bold mb-1">عنوان اعلان <span className="text-red-500">*</span></label>
                             <input 
                                required
                                value={broadcastForm.title} 
                                onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})}
                                className="w-full p-3 rounded-xl border dark:bg-slate-900 dark:border-slate-700" 
                                placeholder="مثلاً: اطلاعیه تعمیرات سرور"
                             />
                         </div>
                         <div>
                             <label className="block text-sm font-bold mb-1">متن پیام <span className="text-red-500">*</span></label>
                             <textarea 
                                required
                                rows={3}
                                value={broadcastForm.message} 
                                onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})}
                                className="w-full p-3 rounded-xl border dark:bg-slate-900 dark:border-slate-700" 
                                placeholder="متن کامل اعلان را بنویسید..."
                             />
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-sm font-bold mb-1">اولویت</label>
                                 <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                                     <button type="button" onClick={() => setBroadcastForm({...broadcastForm, priority: 'Normal'})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${broadcastForm.priority === 'Normal' ? 'bg-white shadow text-gray-700' : 'text-gray-500'}`}>عادی</button>
                                     <button type="button" onClick={() => setBroadcastForm({...broadcastForm, priority: 'High'})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${broadcastForm.priority === 'High' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>مهم</button>
                                     <button type="button" onClick={() => setBroadcastForm({...broadcastForm, priority: 'Urgent'})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${broadcastForm.priority === 'Urgent' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>فوری</button>
                                 </div>
                             </div>
                             <div>
                                 <label className="block text-sm font-bold mb-1">گیرندگان</label>
                                 <select 
                                    value={broadcastForm.targetAudience}
                                    onChange={e => setBroadcastForm({...broadcastForm, targetAudience: e.target.value as any})}
                                    className="w-full p-3 rounded-xl border dark:bg-slate-900 dark:border-slate-700 outline-none"
                                 >
                                     <option value="All">همه کاربران</option>
                                     <option value="Team">اعضای تیم</option>
                                     <option value="Clients">مشتریان</option>
                                     <option value="Manual">انتخاب دستی</option>
                                 </select>
                             </div>
                         </div>

                         {broadcastForm.targetAudience === 'Manual' && (
                             <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700 max-h-40 overflow-y-auto custom-scrollbar">
                                 <p className="text-xs text-gray-400 mb-2">کاربران را انتخاب کنید:</p>
                                 <div className="grid grid-cols-2 gap-2">
                                     {allUsers.map(u => (
                                         <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white dark:hover:bg-slate-800 p-1 rounded">
                                             <input 
                                                type="checkbox" 
                                                checked={broadcastForm.selectedUsers.includes(u.id)}
                                                onChange={() => toggleUserSelection(u.id)}
                                                className="rounded text-primary-600 focus:ring-primary-500"
                                             />
                                             <span>{u.firstName} {u.lastName} <span className="text-[9px] text-gray-400">({u.role})</span></span>
                                         </label>
                                     ))}
                                 </div>
                             </div>
                         )}

                         <div>
                            <JalaliDatePicker 
                                label="تاریخ انقضا (اختیاری)" 
                                value={broadcastForm.expiryDate} 
                                onChange={(d: string) => setBroadcastForm({...broadcastForm, expiryDate: d})}
                                onIsoChange={(iso: string) => setBroadcastForm({...broadcastForm, expiryDateIso: iso})}
                            />
                            <p className="text-[10px] text-gray-400 mt-1">پس از این تاریخ، اعلان برای کاربران نمایش داده نخواهد شد.</p>
                         </div>

                         <div className="flex gap-3 pt-2">
                             <button type="button" onClick={() => setIsManagerialModalOpen(false)} className="flex-1 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition">انصراف</button>
                             <button type="submit" className="flex-[2] py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2">
                                 <Send size={18}/> ارسال اعلان
                             </button>
                         </div>
                    </form>
                </Modal>
            )}

            {isAdmin && (
                <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title="تاریخچه اعلانات مدیریتی" size="lg">
                    <div className="space-y-4">
                        {broadcasts.length === 0 ? (
                            <p className="text-center text-gray-400 py-8">هنوز اعلانی ارسال نشده است.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-slate-900 text-right">
                                        <tr>
                                            <th className="p-3 rounded-r-xl">عنوان</th>
                                            <th className="p-3">تاریخ</th>
                                            <th className="p-3">گیرندگان</th>
                                            <th className="p-3">اولویت</th>
                                            <th className="p-3 rounded-l-xl text-center">آمار بازدید</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {broadcasts.map(b => (
                                            <tr key={b.id} className="border-b border-gray-100 dark:border-slate-700">
                                                <td className="p-3 font-bold">{b.title}</td>
                                                <td className="p-3 text-gray-500">{formatJalaliShort(b.createdAt)}</td>
                                                <td className="p-3">
                                                    <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
                                                        {b.targetAudience === 'All' ? 'همه' : b.targetAudience === 'Team' ? 'تیم' : b.targetAudience === 'Clients' ? 'مشتریان' : 'دستی'}
                                                        <span className="mr-1 text-gray-400">({toPersianDigits(b.recipientCount)} نفر)</span>
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    {b.priority === 'Urgent' && <span className="text-red-500 text-xs font-bold">فوری</span>}
                                                    {b.priority === 'High' && <span className="text-orange-500 text-xs font-bold">مهم</span>}
                                                    {b.priority === 'Normal' && <span className="text-gray-500 text-xs">عادی</span>}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => handleViewStats(b.id)} className="text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition">
                                                        <PieChart size={16}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Stats Modal */}
            {isAdmin && (
                <Modal isOpen={showStatsModal} onClose={() => setShowStatsModal(false)} title="آمار بازدید اعلان" size="sm">
                    {selectedBroadcastStats && (
                        <div className="text-center p-4">
                            <div className="flex justify-center gap-8 mb-6">
                                <div>
                                    <span className="block text-3xl font-black text-gray-800 dark:text-white">{toPersianDigits(selectedBroadcastStats.total)}</span>
                                    <span className="text-xs text-gray-400">کل گیرندگان</span>
                                </div>
                                <div>
                                    <span className="block text-3xl font-black text-emerald-500">{toPersianDigits(selectedBroadcastStats.seen)}</span>
                                    <span className="text-xs text-gray-400">دیده شده</span>
                                </div>
                                <div>
                                    <span className="block text-3xl font-black text-amber-500">{toPersianDigits(selectedBroadcastStats.total - selectedBroadcastStats.seen)}</span>
                                    <span className="text-xs text-gray-400">خوانده نشده</span>
                                </div>
                            </div>
                            
                            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-6">
                                <div 
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                                    style={{width: `${(selectedBroadcastStats.seen / selectedBroadcastStats.total) * 100}%`}}
                                ></div>
                            </div>

                            <div className="text-right">
                                <h4 className="text-xs font-bold text-gray-500 mb-2">لیست افرادی که دیده‌اند:</h4>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-slate-900 p-2 rounded-xl">
                                    {selectedBroadcastStats.readers.length > 0 ? (
                                        selectedBroadcastStats.readers.map(uid => {
                                            const userObj = allUsers.find(u => u.id === uid);
                                            return (
                                                <div key={uid} className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
                                                    <Eye size={12} className="text-emerald-500"/>
                                                    <span className="text-xs">{userObj ? `${userObj.firstName} ${userObj.lastName}` : 'کاربر حذف شده'}</span>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="text-xs text-gray-400 text-center">هنوز کسی مشاهده نکرده است.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default NotificationsView;
