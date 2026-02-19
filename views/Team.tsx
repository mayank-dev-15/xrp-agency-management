
import React, { useState, useEffect, useContext, useRef } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../App';
import { User, UserRole, UserStatus, Department } from '../types';
import { Plus, Edit2, Trash2, User as UserIcon, Image as ImageIcon, Briefcase, Layers, X, MessageSquare, ShieldAlert } from 'lucide-react';
import { Modal } from '../components/Shared';
import { generateId, toPersianDigits } from '../utils';

const TeamView = () => {
  const { user, showToast } = useContext(AuthContext);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [deptData, setDeptData] = useState<Partial<Department>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACCESS CONTROL CONSTANTS ---
  const isTeamMember = user?.role === UserRole.TeamMember;
  const canManage = user?.role === UserRole.Admin || user?.role === UserRole.Manager;

  const loadData = async () => {
      if (!user) return;
      setLoading(true);
      
      const [uData, dData] = await Promise.all([api.users.getAll(), api.departments.getAll()]);
      
      // BUGFIX: Filter strictly for Team Roles (Admin, Manager, TeamMember)
      // Clients and Connections should not appear in the Team View
      const teamOnlyUsers = uData.filter(u => 
          u.role === UserRole.Admin || 
          u.role === UserRole.Manager || 
          u.role === UserRole.TeamMember
      );

      // --- DATA SCOPING & SECURITY ---
      if (isTeamMember) {
          // Team Member sees ONLY their own department
          if (user.departmentId) {
              const myDept = dData.filter(d => d.id === user.departmentId);
              setDepartments(myDept);
              setUsers(teamOnlyUsers.filter(u => u.departmentId === user.departmentId));
              setActiveTab(user.departmentId); // Force tab lock
          } else {
              // Edge case: Team member with no department
              setDepartments([]);
              setUsers([user]); // See only self
              setActiveTab('All');
          }
      } else {
          // Admin/Manager sees everything (Scoped to Team)
          setUsers(teamOnlyUsers);
          setDepartments(dData);
      }
      
      setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Paste Image Logic (Only active if modal is open AND user can manage)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isModalOpen || !canManage) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              setFormData(prev => ({...prev, avatarUrl: event.target?.result as string}));
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isModalOpen, canManage]);

  // --- LOGIC ENFORCEMENT ---
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // CRITICAL SECURITY CHECK
      if (!canManage) {
          showToast('شما مجوز این عملیات را ندارید.', 'error');
          return;
      }

      try {
          if(formData.id) {
              await api.users.update(formData as User, user!.id);
              setUsers(prev => prev.map(u => u.id === formData.id ? (formData as User) : u));
              showToast('اطلاعات کاربر با موفقیت به‌روزرسانی شد', 'success');
          } else {
              const newUser = {
                  ...formData,
                  id: generateId(),
                  role: UserRole.TeamMember, 
                  passwordHash: formData.passwordHash || '1234', 
                  status: UserStatus.Active,
                  createdAt: new Date().toISOString()
              } as User;
              await api.users.create(newUser, user!.id);
              setUsers(prev => [...prev, newUser]);
              showToast('کاربر جدید با موفقیت اضافه شد', 'success');
          }
          setIsModalOpen(false);
      } catch(err) {
          showToast('خطا در عملیات', 'error');
      }
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // CRITICAL SECURITY CHECK
      if (!canManage) {
          showToast('شما مجوز مدیریت دپارتمان‌ها را ندارید', 'error');
          return;
      }

      if(!deptData.name) return;
      
      try {
        if(deptData.id) {
            const updated = { ...deptData } as Department;
            const newDepts = departments.map(d => d.id === updated.id ? updated : d);
            localStorage.setItem('xrm_departments', JSON.stringify(newDepts)); 
            setDepartments(newDepts);
            showToast('دپارتمان با موفقیت ویرایش شد', 'success');
        } else {
            const newDept = {
                id: generateId(),
                name: deptData.name,
                createdAt: new Date().toISOString()
            } as Department;
            await api.departments.create(newDept, user!.id);
            setDepartments(prev => [...prev, newDept]);
            showToast('دپارتمان جدید ایجاد شد', 'success');
        }
        setIsDeptModalOpen(false);
        setDeptData({});
      } catch(e) {
        showToast('خطا در ذخیره دپارتمان', 'error');
      }
  };

  const handleDeleteUser = async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      // CRITICAL SECURITY CHECK
      if (!canManage) {
          showToast('شما مجوز حذف کاربر را ندارید', 'error');
          return;
      }

      if(window.confirm('آیا مطمئن هستید؟ کاربر حذف و دسترسی قطع خواهد شد.')) {
          try {
            await api.users.delete(id, user!.id);
            setUsers(prev => [...prev.filter(u => u.id !== id)]);
            showToast('کاربر با موفقیت حذف شد', 'success');
          } catch(err) {
            showToast('خطا در حذف کاربر', 'error');
          }
      }
  };

  const handleDeleteDept = async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      // CRITICAL SECURITY CHECK
      if (!canManage) {
          showToast('شما مجوز حذف دپارتمان را ندارید', 'error');
          return;
      }

      if(window.confirm('دپارتمان حذف شود؟ اعضای آن «بدون دپارتمان» خواهند شد.')) {
          try {
            await api.departments.delete(id, user!.id);
            setDepartments(prev => [...prev.filter(d => d.id !== id)]);
            setUsers(prev => prev.map(u => u.departmentId === id ? {...u, departmentId: undefined} : u));
            if(activeTab === id) setActiveTab('All');
            showToast('دپارتمان حذف شد', 'success');
          } catch(err) {
            showToast('خطا در حذف دپارتمان', 'error');
          }
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setFormData(prev => ({...prev, avatarUrl: reader.result as string}));
          reader.readAsDataURL(file);
      }
  };

  const openDeptEdit = (e: React.MouseEvent, dept: Department) => {
      e.stopPropagation();
      e.preventDefault();
      if (!canManage) return;
      setDeptData(dept);
      setIsDeptModalOpen(true);
  };

  if (!user) return null;

  // --- UI FILTER LOGIC ---
  const filteredUsers = isTeamMember
      // Team Member: Show users in my dept (already scoped in loadData, but safe filter again)
      ? users 
      // Manager/Admin: Show based on Tab
      : (activeTab === 'All' ? users : users.filter(u => u.departmentId === activeTab));

  return (
    <div className="font-shabnam animate-in fade-in slide-in-from-bottom-4">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    {isTeamMember ? 'هم‌تیمی‌های من' : 'مدیریت تیم'}
                </h2>
                {isTeamMember && <p className="text-gray-500 text-sm mt-1">اعضای دپارتمان {departments[0]?.name}</p>}
            </div>
            
            {/* CTA BUTTONS: COMPLETELY HIDDEN FOR TEAM MEMBERS */}
            {canManage && (
                <div className="flex gap-2">
                    <button onClick={() => { setDeptData({}); setIsDeptModalOpen(true); }} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition shadow-sm">
                        <Layers size={18} /> دپارتمان جدید
                    </button>
                    <button onClick={() => { setFormData({status: UserStatus.Active}); setIsModalOpen(true); }} className="bg-primary-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition">
                        <Plus size={20} /> عضو جدید
                    </button>
                </div>
            )}
        </div>

        {/* Tabs - Only show for Managers */}
        {!isTeamMember && departments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                <button 
                    onClick={() => setActiveTab('All')} 
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === 'All' ? 'bg-primary-100 text-primary-700' : 'bg-white dark:bg-slate-800 text-gray-500 border border-transparent hover:border-gray-200'}`}
                >
                    همه اعضا
                </button>
                
                {departments.map(d => {
                    const isActive = activeTab === d.id;
                    return (
                        <div 
                            key={d.id} 
                            onClick={() => setActiveTab(d.id)} 
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer
                            ${isActive ? 'bg-primary-100 text-primary-700' : 'bg-white dark:bg-slate-800 text-gray-500 border border-transparent hover:border-gray-200'}
                            `}
                        >
                            {d.name}
                            {/* Manage Dept Icons (Hidden via logic but double check) */}
                            {isActive && canManage && (
                                <div className="flex items-center gap-1 mr-1 border-r border-gray-300 pr-1" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                                     <button type="button" className="p-1 hover:text-blue-500 z-10 rounded-full hover:bg-white/50" onClick={(e) => openDeptEdit(e, d)}><Edit2 size={12} /></button>
                                     <button type="button" className="p-1 hover:text-red-500 z-10 rounded-full hover:bg-white/50" onClick={(e) => handleDeleteDept(e, d.id)}><X size={12} /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.length > 0 ? filteredUsers.map(u => (
                <div key={u.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 flex flex-col items-center text-center group hover:shadow-lg transition relative overflow-hidden">
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4">
                        <span className={`w-3 h-3 rounded-full block ${u.status === UserStatus.Active ? 'bg-green-500' : u.status === UserStatus.Busy ? 'bg-amber-500' : 'bg-gray-300'}`}></span>
                    </div>

                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-4 overflow-hidden shadow-sm border-2 border-white dark:border-slate-600">
                         {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={32} className="text-gray-400"/>}
                    </div>
                    
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">{u.firstName} {u.lastName}</h3>
                    
                    {/* Access-Aware Details */}
                    {canManage ? (
                        <>
                            <span className="text-xs text-gray-500 mb-1 font-mono dir-ltr">{u.username}</span>
                            <div className="flex gap-2 mb-3 mt-2">
                                <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-md text-[10px] font-bold">{u.role}</span>
                                <span className="bg-gray-100 dark:bg-slate-700 text-gray-500 px-2 py-0.5 rounded-md text-[10px]">{departments.find(d => d.id === u.departmentId)?.name || 'بدون تیم'}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-xs text-gray-400 mb-3">{u.role === UserRole.Manager ? 'مدیر تیم' : 'هم‌تیمی'}</span>
                            {/* Skills Tag Cloud */}
                            {u.jobDetails?.skills && (
                                <div className="flex flex-wrap gap-1 justify-center mb-4">
                                     {u.jobDetails.skills.slice(0,3).map(skill => <span key={skill} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{skill}</span>)}
                                </div>
                            )}
                        </>
                    )}
                    
                    {/* ACTIONS: Strictly Controlled */}
                    <div className="w-full mt-auto pt-4 border-t border-gray-50 dark:border-slate-700/50 flex gap-2">
                        {canManage ? (
                            <>
                                <button type="button" onClick={() => { setFormData(u); setIsModalOpen(true); }} className="flex-1 py-2 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-slate-600 transition flex items-center justify-center gap-2">
                                    <Edit2 size={14}/> ویرایش
                                </button>
                                <button type="button" onClick={(e) => handleDeleteUser(e, u.id)} className="w-10 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg hover:bg-red-100 flex items-center justify-center transition">
                                    <Trash2 size={16} />
                                </button>
                            </>
                        ) : (
                            // Team Member Action: Just Message
                            u.id !== user.id ? (
                                <button type="button" className="flex-1 py-2 bg-primary-50 text-primary-600 rounded-xl text-sm font-bold hover:bg-primary-100 flex items-center justify-center gap-2 transition">
                                    <MessageSquare size={16}/> ارسال پیام
                                </button>
                            ) : (
                                <span className="flex-1 py-2 text-xs text-gray-400">پروفایل شما</span>
                            )
                        )}
                    </div>
                </div>
            )) : (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                    <ShieldAlert size={48} className="mb-4 opacity-50"/>
                    <p>هیچ عضوی یافت نشد.</p>
                </div>
            )}
        </div>

        {/* --- MODALS (Only rendered if canManage) --- */}
        
        {canManage && (
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'ویرایش عضو' : 'افزودن عضو جدید'}>
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <div className="flex justify-center mb-4">
                        <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-slate-600 cursor-pointer relative group">
                            {formData.avatarUrl ? <img src={formData.avatarUrl} className="w-full h-full object-cover"/> : <ImageIcon className="text-gray-400"/>}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition">تغییر</div>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <input placeholder="نام" value={formData.firstName || ''} onChange={e => setFormData({...formData, firstName: e.target.value})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700" required/>
                         <input placeholder="نام خانوادگی" value={formData.lastName || ''} onChange={e => setFormData({...formData, lastName: e.target.value})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700" required/>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <input placeholder="شماره موبایل" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dir-ltr text-right" required/>
                        <input type="text" placeholder="رمز عبور" value={formData.passwordHash || ''} onChange={e => setFormData({...formData, passwordHash: e.target.value})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dir-ltr text-right" required/>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700">
                             <option value={UserStatus.Active}>فعال</option>
                             <option value={UserStatus.Inactive}>غیرفعال</option>
                             <option value={UserStatus.Busy}>مشغول</option>
                         </select>
                         <select value={formData.departmentId || ''} onChange={e => setFormData({...formData, departmentId: e.target.value})} className="p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700">
                             <option value="">بدون دپارتمان</option>
                             {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                         </select>
                     </div>
                     <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition">ذخیره</button>
                 </form>
            </Modal>
        )}

        {canManage && (
            <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title={deptData.id ? 'ویرایش دپارتمان' : 'افزودن دپارتمان'} size="sm">
                <form onSubmit={handleDeptSubmit} className="space-y-4">
                    <input placeholder="نام دپارتمان" value={deptData.name || ''} onChange={e => setDeptData({...deptData, name: e.target.value})} className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700" required autoFocus/>
                    <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition">ذخیره دپارتمان</button>
                </form>
            </Modal>
        )}
    </div>
  );
};

export default TeamView;
