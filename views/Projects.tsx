
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { Project, ProjectStatus, Client, User, PaymentMethod, UserRole, Notification, Transaction, TransactionType, FinanceCategory, Invoice, TransactionStatus, LedgerSnapshot } from '../types';
import { LedgerSnapshotService } from '../services/ledger';
import { generateId, toPersianDigits, formatCurrency, formatJalali, getStatusColor, calculateShare } from '../utils';
import { Plus, Filter, Calendar, DollarSign, Edit, Trash, Users, Bell, TrendingUp, TrendingDown, Wallet, PieChart, FileText, Link } from 'lucide-react';
import { Modal, CurrencyInput, JalaliDatePicker } from '../components/Shared';

const ProjectsView = () => {
  const { user, showToast, confirmAction } = useContext(AuthContext);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]); // New: For P&L Calc
  const [invoices, setInvoices] = useState<Invoice[]>([]); // New: For Invoice Linking
  const [snapshots, setSnapshots] = useState<Record<string, LedgerSnapshot>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    description: '',
    status: ProjectStatus.Active,
    projectType: 'Web',
    sourceType: 'Client',
    deadlineWarningDays: 3,
    totalBudget: 0,
    connectionSharePercent: 0,
    expenses: 0,
    paymentMethod: PaymentMethod.Cash,
    members: [],
    memberAllocations: {},
    installments: [],
    linkedInvoiceId: undefined
  });
  
  // New state for sending notification
  const [notifyMembers, setNotifyMembers] = useState(true);

  // Access Control
  const isClient = user?.role === UserRole.ClientUser || user?.role === UserRole.ConnectionUser;
  const isTeamMember = user?.role === UserRole.TeamMember;
  const canManage = user?.role === UserRole.Admin || user?.role === UserRole.Manager;

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    // Modified: Fetch transactions for P&L calculation
    const [pData, cData, uData, tData, iData] = await Promise.all([
        api.projects.getAll(), 
        api.clients.getAll(), 
        api.users.getAll(),
        api.transactions.getAll(),
        api.invoices.getAll()
    ]);
    
    // --- DATA SCOPING ---
    let scopedProjects = pData;
    if (isClient) {
        scopedProjects = pData.filter(p => p.sourceId === user.id);
    } else if (isTeamMember) {
        scopedProjects = pData.filter(p => p.members?.includes(user.id));
    }
    
    const snaps: Record<string, LedgerSnapshot> = {};
    for (const p of scopedProjects) {
        snaps[p.id] = await LedgerSnapshotService.getSnapshot('project', p.id);
    }
    
    setSnapshots(snaps);
    setProjects(scopedProjects);
    setClients(cData);
    setUsers(uData);
    setTransactions(tData);
    setInvoices(iData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]); // Re-load on user change
  
  useEffect(() => {
    const handleLedgerUpdate = () => {
        loadData();
    };
    window.addEventListener('ledgerUpdated', handleLedgerUpdate);
    return () => window.removeEventListener('ledgerUpdated', handleLedgerUpdate);
  }, [user]);

  // --- AUTOMATED COMMISSION LOGIC ---
  const handleCommissionLogic = async (project: Project, oldProject?: Project) => {
      // 1. Check if invoice linked and commission percent exists
      if (project.linkedInvoiceId && project.connectionSharePercent > 0) {
          const inv = invoices.find(i => i.id === project.linkedInvoiceId);
          if (!inv) return;

          const commissionAmount = Math.round(inv.finalAmount * (project.connectionSharePercent / 100));
          const sysKey = `COMMISSION:${project.id}`;
          
          // Check if system transaction exists
          const existing = transactions.find(t => t.systemKey === sysKey);

          if (existing) {
              // Update if amount changed
              if (existing.amount !== commissionAmount) {
                  const updatedTx = { ...existing, amount: commissionAmount, title: `پورسانت پروژه ${project.title} (سیستمی)` };
                  await api.transactions.update(updatedTx);
                  // Goal 4: Sync local state for immediate P&L update
                  setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
              }
          } else {
              // Create new
              const newTx: Transaction = {
                  id: generateId(),
                  type: TransactionType.Expense,
                  category: FinanceCategory.Agency,
                  amount: commissionAmount,
                  date: new Date().toISOString(),
                  title: `پورسانت پروژه ${project.title} (سیستمی)`,
                  description: 'محاسبه خودکار بر اساس فاکتور متصل',
                  status: 'Registered', // Needs approval
                  projectId: project.id,
                  systemKey: sysKey,
                  createdAt: new Date().toISOString()
              };
              await api.transactions.create(newTx, user!.id);
              // Goal 4: Sync local state
              setTransactions(prev => [...prev, newTx]);
          }
      } else {
          // If unlinked or 0%, check if we need to remove/cancel old commission
          if (oldProject && oldProject.linkedInvoiceId && !project.linkedInvoiceId) {
               const sysKey = `COMMISSION:${project.id}`;
               const existing = transactions.find(t => t.systemKey === sysKey);
               if (existing && existing.status !== 'Cancelled') {
                   const cancelledTx = { ...existing, status: 'Cancelled' as TransactionStatus, description: existing.description + ' (لغو شده به دلیل حذف لینک فاکتور)' };
                   await api.transactions.update(cancelledTx);
                   // Goal 4: Sync local state
                   setTransactions(prev => prev.map(t => t.id === cancelledTx.id ? cancelledTx : t));
               }
          }
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // LOGIC GUARD
    if (!canManage) {
        showToast('شما مجوز ایجاد یا ویرایش پروژه را ندارید', 'error');
        return;
    }

    if (!user) return;

    try {
      // Update Total Budget if Invoice Linked
      let projectData = { ...formData } as Project;
      if (projectData.linkedInvoiceId) {
          const inv = invoices.find(i => i.id === projectData.linkedInvoiceId);
          if (inv) {
              projectData.totalBudget = inv.finalAmount;
          }
      }

      if (formData.id) {
          // Edit
          const oldProject = projects.find(p => p.id === formData.id);
          await api.projects.update(projectData, user.id);
          
          // Auto Commission
          await handleCommissionLogic(projectData, oldProject);

          setProjects(prev => prev.map(p => p.id === formData.id ? projectData : p));
          showToast('پروژه با موفقیت ویرایش شد', 'success');
      } else {
          // Create
          // 1. Prepare Data
          projectData = {
              ...projectData,
              id: generateId(),
              createdAt: new Date().toISOString(),
              members: formData.members?.length ? formData.members : [user.id],
          };
          
          // 2. Create Project (Wait for success)
          await api.projects.create(projectData, user.id);
          
          // Auto Commission
          await handleCommissionLogic(projectData);

          setProjects(prev => [...prev, projectData]);
          
          // 3. Notification Logic
          if (notifyMembers) {
              const membersToNotify = projectData.members;
              for (const memberId of membersToNotify) {
                  await api.notifications.create({
                      id: generateId(),
                      userId: memberId,
                      type: 'Project',
                      title: 'شما به یک پروژه اضافه شدید',
                      message: `پروژه «${projectData.title}» به شما تخصیص داده شد.`,
                      link: '/projects',
                      isRead: false,
                      createdAt: new Date().toISOString(),
                      relatedId: projectData.id
                  });
              }
          }

          showToast('پروژه جدید با موفقیت ثبت شد', 'success');
      }
      
      setIsModalOpen(false);
      // Reset
      setFormData({
        title: '', description: '', status: ProjectStatus.Active, 
        projectType: 'Web', sourceType: 'Client', deadlineWarningDays: 3, totalBudget: 0, connectionSharePercent: 0,
        members: [], memberAllocations: {}, paymentMethod: PaymentMethod.Cash, installments: [], linkedInvoiceId: undefined
      });
      setNotifyMembers(true);
      // Reload to see new transactions if any (Optional now since we sync locally, but good for safety)
      // loadData(); 
    } catch (e) {
      console.error(e);
      showToast('خطا در ذخیره پروژه', 'error');
    }
  };

  const handleEdit = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (!canManage) return; 
      setFormData(project);
      setIsModalOpen(true);
  };

  // --- DELETE HANDLER (SECURED) ---
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    if (!canManage) {
        return;
    }

    confirmAction({
        description: 'آیا مطمئن هستید؟ پروژه حذف خواهد شد.',
        onConfirm: async () => {
          try {
            await api.projects.delete(id, user!.id);
            setProjects(prev => [...prev.filter(p => p.id !== id)]);
            showToast('پروژه حذف شد', 'success');
          } catch(err) {
            showToast('خطا در حذف پروژه', 'error');
          }
        }
    });
  };

  const toggleMember = (userId: string) => {
     const current = formData.members || [];
     if(current.includes(userId)) {
         setFormData({...formData, members: current.filter(id => id !== userId)});
     } else {
         setFormData({...formData, members: [...current, userId]});
     }
  };

  const connectionShareAmount = calculateShare(formData.totalBudget || 0, formData.connectionSharePercent || 0);

  // --- P&L CALCULATOR HELPER (FIXED BUG #1) ---
  const calculatePnL = (projectId: string) => {
      const snapshot = snapshots[projectId];
      
      const income = snapshot?.totalIncomeConfirmed || 0;
      const expense = snapshot?.totalExpenseConfirmed || 0;

      // --- COMPUTED COMMISSION ---
      const project = projects.find(p => p.id === projectId);
      let commission = 0;
      if (project && project.connectionSharePercent > 0) {
          commission = Math.round(income * (project.connectionSharePercent / 100));
      }

      // Total Effective Expense = Recorded Expense + Computed Commission
      const totalExpense = expense + commission;
      const net = income - totalExpense;

      return { income, expense, commission, totalExpense, net };
  };

  const getPnlStatus = (pnl: { income: number, net: number }) => {
      const threshold = pnl.income * 0.01; // 1% threshold for break-even
      if (Math.abs(pnl.net) <= threshold && pnl.income > 0) return { label: 'سر‌به‌سر', color: 'bg-gray-100 text-gray-600' };
      if (pnl.net > 0) return { label: 'سودده', color: 'bg-emerald-100 text-emerald-700' };
      if (pnl.net < 0) return { label: 'زیان‌ده', color: 'bg-red-100 text-red-700' };
      return { label: 'بدون تراکنش', color: 'bg-gray-50 text-gray-400' }; // No income yet
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{isClient ? 'پروژه‌های من' : 'مدیریت پروژه‌ها'}</h2>
          <p className="text-gray-500">{isClient ? 'لیست پروژه‌های فعال شما' : 'لیست تمام پروژه‌ها'}</p>
        </div>
        {/* Only Admin/Manager can create */}
        {canManage && (
            <button 
              onClick={() => { setFormData({title: '', totalBudget: 0, connectionSharePercent: 0, status: ProjectStatus.Active, sourceType: 'Client'}); setIsModalOpen(true); }}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2"
            >
              <Plus size={20} />
              <span>پروژه جدید</span>
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map(project => {
           // Calculate Real P&L
           const pnl = calculatePnL(project.id);
           const pnlStatus = getPnlStatus(pnl);
           
           // Budget Calculation
           const hasBudget = project.totalBudget > 0;
           const budgetProgress = hasBudget ? Math.min(100, (pnl.income / project.totalBudget) * 100) : 0;
           
           // Find Linked Invoice Name
           const linkedInvoice = invoices.find(i => i.id === project.linkedInvoiceId);

           return (
            <div key={project.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition group">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getStatusColor(project.status)}`}>
                  {project.status === 'Active' ? 'در جریان' : project.status}
                </span>
                
                {/* ACTION BUTTONS: HIDDEN FOR CLIENTS/TEAM */}
                {canManage && (
                    <div className="flex gap-2 z-20 relative" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                       <button type="button" onClick={(e) => handleEdit(e, project)} className="text-gray-400 hover:text-blue-500 cursor-pointer p-1"><Edit size={16} className="pointer-events-none" /></button>
                       <button type="button" onClick={(e) => handleDelete(e, project.id)} className="text-gray-400 hover:text-red-500 cursor-pointer p-1"><Trash size={16} className="pointer-events-none" /></button>
                    </div>
                )}
              </div>

              <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">{project.title}</h3>
              {linkedInvoice && (
                  <div className="text-[10px] text-blue-500 bg-blue-50 w-fit px-2 py-0.5 rounded-full mb-1 flex items-center gap-1">
                      <Link size={10}/> متصل به فاکتور #{toPersianDigits(linkedInvoice.number)}
                  </div>
              )}
              <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[40px]">{project.description || 'بدون توضیحات'}</p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Calendar size={14}/> تاریخ شروع:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{formatJalali(project.startDate || '')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Calendar size={14}/> ددلاین:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{formatJalali(project.deadline)}</span>
                </div>
                
                 <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Users size={14}/> اعضا:</span>
                  {isClient ? (
                      // CLIENT VIEW: Just a number
                      <span className="font-bold text-gray-700 dark:text-gray-300">{toPersianDigits(project.members?.length || 0)} نفر</span>
                  ) : (
                      // ADMIN/TEAM VIEW: Avatars
                      <div className="flex -space-x-2 space-x-reverse">
                          {project.members?.map(mid => (
                              <div key={mid} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white dark:border-slate-700" title={users.find(u=>u.id===mid)?.firstName}></div>
                          ))}
                      </div>
                  )}
                </div>
              </div>

              {/* --- NEW: PROJECT P&L SECTION (Read-Only) --- */}
              {/* Only visible to Admin/Manager or Team (if permitted). Hidden for Client usually, but logic allows based on UI requirement A. */}
              {!isClient && (
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700 mb-4 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-gray-500 flex items-center gap-1"><Wallet size={12}/> وضعیت مالی (تحقق یافته)</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pnlStatus.color}`}>
                              {pnlStatus.label}
                          </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center relative mb-2">
                          {/* Vertical Dividers */}
                          <div className="absolute top-2 bottom-2 right-[33%] w-px bg-gray-200 dark:bg-slate-700"></div>
                          <div className="absolute top-2 bottom-2 right-[66%] w-px bg-gray-200 dark:bg-slate-700"></div>

                          <div>
                              <span className="text-[9px] text-gray-400 block mb-0.5">درآمد</span>
                              <span className="text-xs font-bold text-emerald-600 flex justify-center items-center gap-0.5">
                                  {formatCurrency(pnl.income)}
                              </span>
                          </div>
                          <div>
                              <span className="text-[9px] text-gray-400 block mb-0.5">هزینه کل</span>
                              <span className="text-xs font-bold text-red-500 flex justify-center items-center gap-0.5">
                                  {formatCurrency(pnl.totalExpense)}
                              </span>
                          </div>
                          <div>
                              <span className="text-[9px] text-gray-400 block mb-0.5">سود خالص</span>
                              <span className={`text-xs font-black dir-ltr ${pnl.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {formatCurrency(pnl.net)}
                              </span>
                          </div>
                      </div>

                      {/* Computed Commission Row (Req B) */}
                      {pnl.commission > 0 && (
                          <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded text-[9px] mb-2 border border-red-100 dark:border-red-900/30">
                              <span className="text-red-600 dark:text-red-400">کمیسیون کانکشن (محاسبه شده):</span>
                              <span className="font-bold text-red-700 dark:text-red-300">{formatCurrency(pnl.commission)}</span>
                          </div>
                      )}

                      {/* Budget Realization Bar */}
                      {hasBudget && (
                          <div className="mt-1 pt-2 border-t border-gray-200 dark:border-slate-700/50">
                              <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                                  <span>تحقق بودجه ({formatCurrency(project.totalBudget)})</span>
                                  <span>{toPersianDigits(Math.round(budgetProgress))}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, budgetProgress)}%` }}></div>
                              </div>
                          </div>
                      )}
                  </div>
              )}
            </div>
           );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'ویرایش پروژه' : 'ایجاد پروژه جدید'} size="lg">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* ... Form Content ... */}
                 <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-medium mb-1">عنوان پروژه</label>
                   <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium mb-1">منبع پروژه</label>
                   <select className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" value={formData.sourceType} onChange={e => setFormData({...formData, sourceType: e.target.value as any})}>
                     <option value="Client">مشتری</option>
                     <option value="Connection">کانکشن</option>
                     <option value="Agency">آژانس</option>
                   </select>
                 </div>

                 {(formData.sourceType === 'Client' || formData.sourceType === 'Connection') && (
                   <div>
                     <label className="block text-sm font-medium mb-1">انتخاب {formData.sourceType === 'Client' ? 'مشتری' : 'معرف'}</label>
                     <select className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" value={formData.sourceId || ''} onChange={e => setFormData({...formData, sourceId: e.target.value})}>
                       <option value="">انتخاب کنید...</option>
                       {clients.filter(c => formData.sourceType === 'Client' ? (c.type === 'Client' || c.type === 'Both') : (c.type === 'Connection' || c.type === 'Both')).map(c => (
                         <option key={c.id} value={c.id}>{c.name}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 {/* New Linked Invoice */}
                 <div className="col-span-1 md:col-span-2 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                     <label className="block text-sm font-bold mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                         <FileText size={16}/> اتصال به فاکتور (تعیین بودجه خودکار)
                     </label>
                     <select 
                        className="w-full px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none"
                        value={formData.linkedInvoiceId || ''}
                        onChange={e => {
                            const invId = e.target.value;
                            setFormData(prev => {
                                const inv = invoices.find(i => i.id === invId);
                                return {
                                    ...prev, 
                                    linkedInvoiceId: invId || undefined,
                                    totalBudget: inv ? inv.finalAmount : prev.totalBudget // Auto-set budget
                                };
                            });
                        }}
                     >
                         <option value="">-- بدون فاکتور --</option>
                         {invoices.map(inv => (
                             <option key={inv.id} value={inv.id}>
                                 #{toPersianDigits(inv.number)} - {inv.title} ({formatCurrency(inv.finalAmount)})
                             </option>
                         ))}
                     </select>
                     {formData.linkedInvoiceId && (
                         <p className="text-xs text-blue-600 mt-2">
                             بودجه پروژه به صورت خودکار برابر با مبلغ نهایی این فاکتور ({formatCurrency(invoices.find(i=>i.id===formData.linkedInvoiceId)?.finalAmount || 0)}) تنظیم می‌شود.
                         </p>
                     )}
                 </div>

                 <div>
                   <CurrencyInput label="بودجه کل (تومان)" value={formData.totalBudget} onChange={(val: number) => setFormData({...formData, totalBudget: val})} disabled={!!formData.linkedInvoiceId}/>
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">درصد سهم کانکشن (%)</label>
                   <input type="number" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none" value={formData.connectionSharePercent} onChange={e => setFormData({...formData, connectionSharePercent: Number(e.target.value)})} />
                   <p className="text-xs text-gray-500 mt-1">مبلغ سهم: {formatCurrency(connectionShareAmount)} تومان</p>
                   {formData.linkedInvoiceId && formData.connectionSharePercent > 0 && (
                       <p className="text-[10px] text-emerald-600 mt-1">
                           * یک تراکنش هزینه سیستمی برای این کمیسیون به صورت خودکار ثبت می‌شود.
                       </p>
                   )}
                 </div>

                 <div>
                    <JalaliDatePicker label="تاریخ شروع" value={formData.startDate} onChange={(d: string) => setFormData({...formData, startDate: d})} />
                 </div>
                 <div>
                    <JalaliDatePicker label="ددلاین پایان" value={formData.deadline} onChange={(d: string) => setFormData({...formData, deadline: d})} />
                 </div>

                 <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium mb-2">اعضای تیم</label>
                    <div className="flex flex-wrap gap-2">
                        {users.map(u => (
                            <button 
                              key={u.id}
                              type="button"
                              onClick={() => toggleMember(u.id)}
                              className={`px-3 py-1 rounded-full text-sm border transition ${formData.members?.includes(u.id) ? 'bg-primary-100 border-primary-500 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                            >
                                {u.firstName} {u.lastName}
                            </button>
                        ))}
                    </div>
                 </div>

                 {!formData.id && (
                     <div className="col-span-1 md:col-span-2">
                         <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                             <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                                checked={notifyMembers}
                                onChange={e => setNotifyMembers(e.target.checked)}
                             />
                             <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                 <Bell size={16}/> ارسال اعلان برای اعضای این پروژه
                             </span>
                         </label>
                     </div>
                 )}

                 <div className="col-span-1 md:col-span-2 pt-4 flex gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">انصراف</button>
                    <button type="submit" className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition">
                        {formData.id ? 'ذخیره تغییرات' : 'ثبت پروژه'}
                    </button>
                 </div>
              </form>
      </Modal>
    </div>
  );
};

export default ProjectsView;
