
import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../App';
import { Transaction, TransactionType, FinanceCategory, TransactionStatus, PaymentMethodType, TransactionCategoryItem, Project, Client, Invoice, PartialPayment, UserRole, User } from '../types';
import { Plus, ArrowUpCircle, ArrowDownCircle, Paperclip, X, CheckCircle, Ban, Eye, XCircle, Trash2, AlertCircle, RotateCcw, Tag, Check, Lock, ShieldCheck, Link as LinkIcon, Briefcase, User as UserIcon, FileText, Calendar, CreditCard, MoreHorizontal, Clock, Search, Filter, ChevronDown, DollarSign, Wallet, CalendarRange, TrendingUp, TrendingDown, ChevronUp, Layers, List, ChevronLeft, Edit2, Save, CornerDownRight, Users } from 'lucide-react';
import { Modal, CurrencyInput, JalaliDatePicker } from '../components/Shared';
import { generateId, formatJalaliShort, formatCurrency, toPersianDigits, toEnglishDigits } from '../utils';
import { useNavigate } from 'react-router-dom';

const FinanceView = () => {
  const { user, showToast, hasPermission } = useContext(AuthContext);
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategoryItem[]>([]); 
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FinanceCategory>(FinanceCategory.Agency);
  const [loading, setLoading] = useState(true);
  
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // --- SUMMARY STATE ---
  const [summaryPeriod, setSummaryPeriod] = useState<'ThisMonth' | 'LastMonth' | 'Last30Days' | 'Custom'>('ThisMonth');
  const [summaryCustomRange, setSummaryCustomRange] = useState({ start: '', end: '' });

  // --- FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Income' | 'Expense'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Registered' | 'Approved' | 'Cancelled'>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [filterEntity, setFilterEntity] = useState<string>('All');
  const [filterPayee, setFilterPayee] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'Week' | 'Month' | 'Custom'>('All');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({
      categoryId: '', projectId: '', clientId: '', invoiceId: '', minAmount: '', maxAmount: ''
  });

  // UI Refs
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const entityMenuRef = useRef<HTMLDivElement>(null);
  const payeeMenuRef = useRef<HTMLDivElement>(null);
  const advCategoryRef = useRef<HTMLDivElement>(null);

  const [openDateMenu, setOpenDateMenu] = useState(false);
  const [openStatusMenu, setOpenStatusMenu] = useState(false);
  const [openProjectMenu, setOpenProjectMenu] = useState(false);
  const [openEntityMenu, setOpenEntityMenu] = useState(false);
  const [openPayeeMenu, setOpenPayeeMenu] = useState(false);
  const [openAdvCategory, setOpenAdvCategory] = useState(false);

  // Partial Payment State
  const [showPartialPaymentForm, setShowPartialPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState<Partial<PartialPayment>>({
      amount: 0,
      date: formatJalaliShort(new Date().toISOString()),
      method: 'Card'
  });
  const [isEditingInstallmentCount, setIsEditingInstallmentCount] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentData, setEditPaymentData] = useState<Partial<PartialPayment>>({});

  // RBAC Helper
  const isSuperAdmin = user?.role === UserRole.Admin;
  
  const checkMutationPermission = (t: Transaction): boolean => {
      // Guard for Final Confirmation: Only Admin can mutate 'Approved'
      if (t.status === 'Approved') {
          return isSuperAdmin;
      }
      // Before Final Confirmation: Use standard permission logic
      return hasPermission('MANAGE_FINANCE');
  };

  // Click Outside Handler
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) setOpenDateMenu(false);
          if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) setOpenStatusMenu(false);
          if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) setOpenProjectMenu(false);
          if (entityMenuRef.current && !entityMenuRef.current.contains(event.target as Node)) setOpenEntityMenu(false);
          if (payeeMenuRef.current && !payeeMenuRef.current.contains(event.target as Node)) setOpenPayeeMenu(false);
          if (advCategoryRef.current && !advCategoryRef.current.contains(event.target as Node)) setOpenAdvCategory(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [confirmSubmitApprove, setConfirmSubmitApprove] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Transaction>>({
      type: TransactionType.Income,
      amount: 0,
      status: 'Registered',
      paymentMethod: 'Card',
      attachments: [],
      projectId: undefined,
      clientId: undefined,
      invoiceId: undefined,
      partialPayments: [],
      installmentTotal: undefined,
      payeeId: undefined,
      payeeName: undefined,
      sequenceNo: undefined
  });
  
  const [selectedParentCat, setSelectedParentCat] = useState<string>('');
  const [viewAttachment, setViewAttachment] = useState<string | null>(null);

  // Fallback map for legacy sequence numbers
  const legacySequenceMap = useMemo(() => {
      const map: Record<string, number> = {};
      const sorted = [...transactions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      sorted.forEach((t, i) => {
          map[t.id] = i + 1;
      });
      return map;
  }, [transactions.length]);

  const loadData = async () => {
      setLoading(true);
      const [tData, cData, pData, clData, iData, uData] = await Promise.all([
          api.transactions.getAll(),
          api.categories.getAll(),
          api.projects.getAll(),
          api.clients.getAll(),
          api.invoices.getAll(),
          api.users.getAll()
      ]);
      setTransactions(tData.reverse());
      setCategories(cData);
      setProjects(pData);
      setClients(clData);
      setInvoices(iData);
      setUsers(uData);
      setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Sync parent category
  useEffect(() => {
      if (formData.categoryId) {
          const cat = categories.find(c => c.id === formData.categoryId);
          if (cat) {
              if (cat.parentId) setSelectedParentCat(cat.parentId);
              else setSelectedParentCat(cat.id);
          }
      } else {
          setSelectedParentCat('');
      }
  }, [formData.categoryId, categories, isModalOpen]);

  // Sync date with partials
  useEffect(() => {
      if (formData.partialPayments && formData.partialPayments.length > 0) {
          const lastPayment = formData.partialPayments[formData.partialPayments.length - 1];
          if (lastPayment.date) setFormData(prev => ({...prev, date: lastPayment.date}));
      }
  }, [formData.partialPayments]);

  const getDerivedContext = (t: Transaction) => {
      const inv = t.invoiceId ? invoices.find(i => i.id === t.invoiceId) : null;
      const derivedProjectId = t.projectId || (inv?.projectId) || null;
      const project = derivedProjectId ? projects.find(p => p.id === derivedProjectId) : null;
      let derivedClientId = t.clientId; 
      if (!derivedClientId && project && project.sourceType === 'Client') derivedClientId = project.sourceId;
      if (!derivedClientId && inv) derivedClientId = inv.clientId;

      return { derivedProjectId, derivedClientId, project, invoice: inv };
  };

  // --- LOGIC HELPERS ---
  const getCategoryLabel = (catId?: string) => {
      if (!catId) return null;
      const cat = categories.find(c => c.id === catId);
      if (!cat) return null;
      if (cat.parentId) {
          const parent = categories.find(p => p.id === cat.parentId);
          return parent ? `${parent.name} / ${cat.name}` : cat.name;
      }
      return cat.name;
  };

  const getEntityName = (type: 'Project' | 'Client' | 'Invoice', id?: string) => {
      if (!id) return null;
      if (type === 'Project') return projects.find(p => p.id === id)?.title;
      if (type === 'Client') return clients.find(c => c.id === id)?.name;
      if (type === 'Invoice') return invoices.find(i => i.id === id)?.number ? `#${toPersianDigits(invoices.find(i => i.id === id)!.number)}` : null;
      return null;
  };

  const getDateLabel = (filter: string) => {
      switch(filter) {
          case 'All': return 'همه تاریخ‌ها';
          case 'Today': return 'امروز';
          case 'Week': return '۷ روز اخیر';
          case 'Month': return 'این ماه';
          case 'Custom': return 'بازه دلخواه';
          default: return 'تاریخ';
      }
  };

  const getSelectedLabel = (type: 'Category', id: string) => {
      if (!id) return 'همه دسته‌ها';
      return categories.find(c => c.id === id)?.name || 'نامشخص';
  };

  const getInvoiceGlobalStats = (invoiceId: string) => {
      const allRelatedTx = transactions.filter(t => t.invoiceId === invoiceId && t.status !== 'Cancelled' && t.type === TransactionType.Income);
      const totalPaid = allRelatedTx.reduce((sum, t) => sum + t.amount, 0);
      const count = allRelatedTx.length;
      const maxNo = Math.max(0, ...allRelatedTx.map(t => t.installmentNo || 0));
      return { totalPaid, count, maxNo };
  };

  const summaryStats = useMemo(() => {
      const todayJalali = formatJalaliShort(new Date().toISOString()); 
      const currentYear = parseInt(toEnglishDigits(todayJalali.split('/')[0]));
      const currentMonth = parseInt(toEnglishDigits(todayJalali.split('/')[1]));

      const base = transactions.filter(t => (t.category || FinanceCategory.Agency) === activeTab && t.status !== 'Cancelled');

      let label = '';
      const filtered = base.filter(t => {
          const tDate = formatJalaliShort(t.date);
          const tYear = parseInt(toEnglishDigits(tDate.split('/')[0]));
          const tMonth = parseInt(toEnglishDigits(tDate.split('/')[1]));

          if (summaryPeriod === 'ThisMonth') {
              label = `ماه جاری (${toPersianDigits(currentYear)}/${toPersianDigits(currentMonth)})`;
              return tYear === currentYear && tMonth === currentMonth;
          }
          if (summaryPeriod === 'LastMonth') {
              let targetMonth = currentMonth - 1;
              let targetYear = currentYear;
              if (targetMonth === 0) { targetMonth = 12; targetYear--; }
              label = `ماه قبل (${toPersianDigits(targetYear)}/${toPersianDigits(targetMonth)})`;
              return tYear === targetYear && tMonth === targetMonth;
          }
          if (summaryPeriod === 'Last30Days') {
              label = '۳۰ روز اخیر';
              if (t.createdAt) {
                  const d = new Date(t.createdAt);
                  const diff = (new Date().getTime() - d.getTime()) / (1000 * 3600 * 24);
                  return diff <= 30;
              }
              return false;
          }
          if (summaryPeriod === 'Custom') {
              label = 'بازه انتخابی';
              if (summaryCustomRange.start && summaryCustomRange.end) {
                  return tDate >= summaryCustomRange.start && tDate <= summaryCustomRange.end;
              }
              return true;
          }
          return true;
      });

      const income = filtered.filter(t => t.type === TransactionType.Income).reduce((sum, t) => sum + t.amount, 0);
      const expense = filtered.filter(t => t.type === TransactionType.Expense).reduce((sum, t) => sum + t.amount, 0);
      const net = income - expense;

      return { income, expense, net, label };
  }, [transactions, activeTab, summaryPeriod, summaryCustomRange]);

  // --- LIST FILTERING ---
  const filteredTransactions = useMemo(() => {
      let data = transactions.filter(t => (t.category || FinanceCategory.Agency) === activeTab);

      if (searchQuery) {
          const q = toPersianDigits(searchQuery.toLowerCase());
          data = data.filter(t => 
              t.title?.toLowerCase().includes(q) || 
              t.description?.toLowerCase().includes(q) ||
              getEntityName('Project', t.projectId)?.toLowerCase().includes(q) ||
              getEntityName('Client', t.clientId)?.toLowerCase().includes(q) ||
              getEntityName('Invoice', t.invoiceId)?.toLowerCase().includes(q) ||
              toPersianDigits(t.amount).includes(q)
          );
      }

      if (filterType !== 'All') data = data.filter(t => t.type === filterType);
      if (filterStatus !== 'All') data = data.filter(t => t.status === filterStatus);

      if (filterProject !== 'All') {
          data = data.filter(t => {
              const { derivedProjectId } = getDerivedContext(t);
              return derivedProjectId === filterProject;
          });
      }

      if (filterEntity !== 'All') {
          data = data.filter(t => {
              const { derivedClientId } = getDerivedContext(t);
              return derivedClientId === filterEntity;
          });
      }

      if (filterPayee !== 'All') {
          data = data.filter(t => t.payeeId === filterPayee);
      }

      const today = new Date();
      if (dateFilter === 'Today') {
          const todayStr = formatJalaliShort(today.toISOString());
          data = data.filter(t => formatJalaliShort(t.date) === todayStr);
      } else if (dateFilter === 'Week') {
          data = data.filter(t => {
              try { const d = new Date(t.date); if(isNaN(d.getTime())) return true; const diff = (today.getTime() - d.getTime()) / (1000 * 3600 * 24); return diff <= 7 && diff >= 0; } catch(e) { return true; }
          });
      } else if (dateFilter === 'Month') {
           const currentMonth = formatJalaliShort(today.toISOString()).split('/')[1];
           data = data.filter(t => formatJalaliShort(t.date).split('/')[1] === currentMonth);
      } else if (dateFilter === 'Custom' && customDateRange.start && customDateRange.end) {
           data = data.filter(t => { const d = formatJalaliShort(t.date); return d >= customDateRange.start && d <= customDateRange.end; });
      }

      if (advFilters.categoryId) {
           const targetIds = [advFilters.categoryId, ...categories.filter(c => c.parentId === advFilters.categoryId).map(c => c.id)];
           data = data.filter(t => t.categoryId && targetIds.includes(t.categoryId));
      }
      return data;
  }, [transactions, activeTab, searchQuery, filterType, filterStatus, dateFilter, customDateRange, advFilters, categories, projects, invoices, filterProject, filterEntity, filterPayee]);

  // --- CORE GROUPING LOGIC ---
  const processGroupedItems = (list: Transaction[]) => {
      const groups: Record<string, { invoice: Invoice, items: Transaction[] }> = {};
      const standalone: Transaction[] = [];

      list.forEach(t => {
          if (t.invoiceId && t.type === TransactionType.Income) {
              if (!groups[t.invoiceId]) {
                  const inv = invoices.find(i => i.id === t.invoiceId);
                  if (inv) groups[t.invoiceId] = { invoice: inv, items: [] };
              }
              if (groups[t.invoiceId]) {
                  groups[t.invoiceId].items.push(t);
              } else {
                  standalone.push(t);
              }
          } else {
              standalone.push(t);
          }
      });

      const groupArray = Object.values(groups).map(g => {
          // Fix 1: Sort by date to ensure proper 1,2,3... sequence
          g.items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return {
              type: 'group' as const,
              data: g,
              sortTime: Math.max(...g.items.map(i => new Date(i.createdAt).getTime()))
          };
      });

      const standaloneArray = standalone.map(t => ({
          type: 'item' as const,
          data: t,
          sortTime: new Date(t.createdAt).getTime()
      }));

      return [...groupArray, ...standaloneArray].sort((a, b) => b.sortTime - a.sortTime);
  };

  const groupedItems = useMemo(() => processGroupedItems(filteredTransactions), [filteredTransactions, invoices]);

  // --- STYLES CONSTANTS ---
  const INDEX_CELL_CLASS = "border-y border-gray-100 dark:border-slate-700 p-4 text-center text-xs text-gray-400 font-bold min-w-[3rem]";

  // --- HANDLERS ---
  const handleInvoiceSelect = (invId: string) => {
      if (!invId) { setFormData(prev => ({ ...prev, invoiceId: undefined, partialPayments: [], installmentTotal: undefined })); return; }
      const inv = invoices.find(i => i.id === invId);
      if (inv) {
          if (formData.type === TransactionType.Income) {
              const globalStats = getInvoiceGlobalStats(invId);
              const nextInstallmentNo = globalStats.maxNo + 1;
              const totalInstallments = inv.plannedInstallmentsCount || '';
              const yLabel = totalInstallments ? ` از ${toPersianDigits(totalInstallments)}` : '';
              const suggestedTitle = `قسط ${toPersianDigits(nextInstallmentNo)}${yLabel} — ${inv.title || 'فاکتور'}`;
              
              const projectCat = categories.find(c => c.name === 'پروژه' && c.type === 'income');
              
              setFormData(prev => ({ 
                  ...prev, invoiceId: invId, projectId: inv.projectId, clientId: inv.clientId, partialPayments: [], amount: 0, 
                  installmentTotal: inv.plannedInstallmentsCount,
                  title: suggestedTitle, isInstallment: true,
                  categoryId: projectCat ? projectCat.id : prev.categoryId 
              }));
              setSelectedParentCat(projectCat ? (projectCat.parentId || projectCat.id) : '');
          } else {
              setFormData(prev => ({ 
                  ...prev, invoiceId: invId, projectId: inv.projectId, 
                  clientId: inv.clientId,
                  installmentTotal: undefined,
                  partialPayments: [],
                  isInstallment: false
              }));
          }
      }
  };

  const handleProjectSelect = (projId: string) => {
      if (formData.invoiceId) return; 
      if (!projId) { setFormData(prev => ({ ...prev, projectId: undefined })); return; }
      const proj = projects.find(p => p.id === projId);
      if (proj) setFormData(prev => ({ ...prev, projectId: projId, clientId: (proj.sourceType === 'Client' && proj.sourceId) ? proj.sourceId : prev.clientId }));
  };

  const handleClientSelect = (clId: string) => {
      if (formData.invoiceId || (formData.projectId && projects.find(p => p.id === formData.projectId)?.sourceType === 'Client')) return; 
      setFormData(prev => ({ ...prev, clientId: clId || undefined }));
  };

  const handleEditTransaction = (e: React.MouseEvent, t: Transaction) => {
      e.preventDefault();
      e.stopPropagation();
      
      // FIX #5 GUARD: Check permissions
      if (!checkMutationPermission(t)) {
          showToast('این عملیات فقط برای مدیرکل مجاز است', 'error');
          return;
      }

      setFormData(t);
      if (t.categoryId) {
          const cat = categories.find(c => c.id === t.categoryId);
          if (cat) {
              if (cat.parentId) setSelectedParentCat(cat.parentId);
              else setSelectedParentCat(cat.id);
          }
      }
      setIsModalOpen(true);
  };

  const validateForm = () => {
      if (!formData.title?.trim()) return 'عنوان تراکنش الزامی است.';
      if (!formData.amount || formData.amount <= 0) return 'مبلغ تراکنش معتبر نیست.';
      if (!formData.date) return 'تاریخ تراکنش الزامی است.';
      return null;
  };

  const resetForm = () => {
      setFormData({ type: TransactionType.Income, amount: 0, status: 'Registered', paymentMethod: 'Card', attachments: [], projectId: undefined, clientId: undefined, invoiceId: undefined, partialPayments: [], installmentTotal: undefined, payeeId: undefined, payeeName: undefined, sequenceNo: undefined });
      setSelectedParentCat(''); setShowPartialPaymentForm(false); setIsEditingInstallmentCount(false); setEditingPaymentId(null); setEditPaymentData({});
  };

  const processTransaction = async () => {
      try {
          if (formData.id) {
              const updatedTx = { ...formData, updatedAt: new Date().toISOString() } as Transaction;
              await api.transactions.update(updatedTx);
              setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
              showToast('تراکنش با موفقیت ویرایش شد', 'success');
          } else {
              let nextInstallmentNo: number | undefined = undefined;
              if (formData.invoiceId && formData.type === TransactionType.Income) {
                  const globalStats = getInvoiceGlobalStats(formData.invoiceId);
                  nextInstallmentNo = globalStats.maxNo + 1;
              }

              const maxSeq = transactions.reduce((max, t) => Math.max(max, t.sequenceNo || 0), 0);
              const nextSeq = maxSeq + 1;

              const newTx = {
                  ...formData, 
                  category: activeTab, 
                  id: generateId(), 
                  sequenceNo: nextSeq,
                  date: formData.date || new Date().toISOString(), 
                  createdAt: new Date().toISOString(), 
                  title: formData.title || 'تراکنش بدون عنوان', 
                  description: formData.description || '', 
                  status: formData.status || 'Registered', 
                  installmentNo: nextInstallmentNo,
                  payeeId: formData.type === TransactionType.Expense ? formData.payeeId : undefined, 
                  payeeName: formData.type === TransactionType.Expense ? formData.payeeName : undefined,
              } as Transaction;

              if (formData.invoiceId && formData.installmentTotal && formData.type === TransactionType.Income) {
                  const inv = invoices.find(i => i.id === formData.invoiceId);
                  if (inv && inv.plannedInstallmentsCount !== formData.installmentTotal) {
                      await api.invoices.update({ ...inv, plannedInstallmentsCount: formData.installmentTotal }, user!.id);
                      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...inv, plannedInstallmentsCount: formData.installmentTotal } : i));
                  }
              }
              await api.transactions.create(newTx, user!.id);
              setTransactions(prev => [newTx, ...prev]);
              showToast('تراکنش با موفقیت ثبت شد', 'success');
          }
          setIsModalOpen(false); setConfirmSubmitApprove(false); resetForm();
      } catch(err) { showToast('خطا در ثبت تراکنش', 'error'); }
  };

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); const error = validateForm(); if (error) { showToast(error, 'error'); return; } await processTransaction(); };

  const handleAddPayment = () => {
      if (!newPayment.amount || newPayment.amount <= 0) return;
      const inv = invoices.find(i => i.id === formData.invoiceId); if (!inv) return;
      const globalStats = getInvoiceGlobalStats(inv.id);
      const currentFormTotal = formData.partialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalPaidSoFar = globalStats.totalPaid + currentFormTotal;
      const remaining = inv.finalAmount - totalPaidSoFar;
      if (newPayment.amount > remaining) { showToast(`مبلغ پرداختی بیشتر از مانده فاکتور است (مانده: ${formatCurrency(remaining)})`, 'error'); return; }
      const payment: PartialPayment = { id: generateId(), amount: newPayment.amount, date: newPayment.date || formatJalaliShort(new Date().toISOString()), method: newPayment.method || 'Card', note: newPayment.note };
      const updatedPayments = [...(formData.partialPayments || []), payment];
      const newTotal = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const nextInstallmentNo = globalStats.maxNo + 1; 
      const countLabel = inv.plannedInstallmentsCount ? `${toPersianDigits(nextInstallmentNo)} از ${toPersianDigits(inv.plannedInstallmentsCount)}` : `${toPersianDigits(nextInstallmentNo)}`;
      setFormData(prev => ({ ...prev, partialPayments: updatedPayments, amount: newTotal, title: (!prev.title || prev.title.startsWith('قسط')) ? `قسط ${countLabel} — ${inv.title}` : prev.title }));
      setNewPayment({ amount: 0, date: formatJalaliShort(new Date().toISOString()), method: 'Card' }); setShowPartialPaymentForm(false);
  };
  const handleRemovePayment = (id: string) => { const updatedPayments = formData.partialPayments?.filter(p => p.id !== id) || []; const newTotal = updatedPayments.reduce((sum, p) => sum + p.amount, 0); setFormData(prev => ({ ...prev, partialPayments: updatedPayments, amount: newTotal })); };
  const startEditPayment = (p: PartialPayment) => { setEditingPaymentId(p.id); setEditPaymentData(p); };
  const saveEditPayment = () => {
      if (!editingPaymentId || !editPaymentData.amount) return;
      const inv = invoices.find(i => i.id === formData.invoiceId);
      if (inv) {
          const globalStats = getInvoiceGlobalStats(inv.id);
          const otherPaymentsTotal = formData.partialPayments?.filter(p => p.id !== editingPaymentId).reduce((sum, p) => sum + p.amount, 0) || 0;
          const newTotal = globalStats.totalPaid + otherPaymentsTotal + editPaymentData.amount;
          if (newTotal > inv.finalAmount) { showToast('مجموع پرداختی‌ها نمی‌تواند بیشتر از مبلغ فاکتور باشد.', 'error'); return; }
      }
      const updatedPayments = formData.partialPayments?.map(p => p.id === editingPaymentId ? { ...p, ...editPaymentData } as PartialPayment : p) || [];
      const newFormTotal = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      setFormData(prev => ({ ...prev, partialPayments: updatedPayments, amount: newFormTotal })); setEditingPaymentId(null); setEditPaymentData({});
  };

  const initiateApprove = (e: React.MouseEvent, t: Transaction) => { e.preventDefault(); e.stopPropagation(); setApproveId(t.id); };
  const performApprove = async () => { if (!approveId) return; const t = transactions.find(tx => tx.id === approveId); if (!t) return; try { const updatedT = { ...t, status: 'Approved' as TransactionStatus, updatedAt: new Date().toISOString() }; await api.transactions.update(updatedT); setTransactions(prev => prev.map(item => item.id === t.id ? updatedT : item)); showToast('تراکنش تایید نهایی شد', 'success'); } catch (err) { showToast('خطا', 'error'); } finally { setApproveId(null); } };
  
  const initiateCancel = (e: React.MouseEvent, t: Transaction) => { 
      e.preventDefault(); 
      e.stopPropagation(); 
      
      // FIX #5 GUARD: Check permissions
      if (!checkMutationPermission(t)) {
          showToast('این عملیات فقط برای مدیرکل مجاز است', 'error');
          return;
      }

      if (t.status === 'Cancelled') return; 
      setConfirmId(t.id); 
  };
  const performCancel = async () => { if (!confirmId) return; const t = transactions.find(tx => tx.id === confirmId); if (!t) return; try { const updatedT = { ...t, status: 'Cancelled' as TransactionStatus, updatedAt: new Date().toISOString() }; await api.transactions.update(updatedT); setTransactions(prev => prev.map(item => item.id === t.id ? updatedT : item)); showToast('تراکنش لغو شد', 'success'); } catch (err) { showToast('خطا', 'error'); } finally { setConfirmId(null); } };
  const initiateRestore = (e: React.MouseEvent, t: Transaction) => { e.preventDefault(); e.stopPropagation(); setRestoreId(t.id); };
  const performRestore = async () => { if (!restoreId) return; const t = transactions.find(tx => tx.id === restoreId); if (!t) return; try { const updatedT = { ...t, status: 'Registered' as TransactionStatus, updatedAt: new Date().toISOString() }; await api.transactions.update(updatedT); setTransactions(prev => prev.map(item => item.id === t.id ? updatedT : item)); showToast('تراکنش بازگردانی شد', 'success'); } catch (err) { showToast('خطا', 'error'); } finally { setRestoreId(null); } };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), reader.result as string] })); }; reader.readAsDataURL(file); } };
  const removeAttachment = (index: number) => { setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter((_, i) => i !== index) })); };

  // --- HELPERS ---
  const getPaymentLabel = (method?: string) => {
      switch (method) {
          case 'Card': return 'کارت به کارت';
          case 'Cash': return 'نقد';
          case 'Gateway': return 'درگاه پرداخت';
          case 'Transfer': return 'شبا / پایا';
          case 'Other': return 'سایر';
          default: return 'نامشخص';
      }
  };

  // Fix 3: Badge Style Update
  const getStatusChip = (status: string, isCancelled: boolean) => {
      const baseClass = "px-3 py-1 rounded-full text-[10px] font-bold border transition-colors";
      if (isCancelled) return <span className={`${baseClass} bg-gray-100 text-gray-500 border-gray-200`}>لغو شده</span>;
      switch (status) {
          case 'Registered': return <span className={`${baseClass} bg-amber-50 text-amber-600 border-amber-100`}>در انتظار تایید</span>;
          case 'Approved': return <span className={`${baseClass} bg-emerald-50 text-emerald-600 border-emerald-100`}>تایید نهایی</span>;
          default: return <span className={`${baseClass} bg-gray-50 text-gray-600 border-gray-200`}>{status}</span>;
      }
  };

  const toggleRowExpansion = (id: string) => {
      setExpandedRowId(prev => prev === id ? null : id);
  };

  // --- REUSABLE CHIP RENDERER ---
  const RenderRelationChips = ({ t, isChild }: { t: Transaction, isChild: boolean }) => {
      // Fix 2: Hide chips for child rows
      if (isChild) return null;

      const { derivedProjectId, derivedClientId, project, invoice } = getDerivedContext(t);
      const catLabel = getCategoryLabel(t.categoryId);
      
      let invoiceLabel = null;
      if (invoice) {
          const rawTitle = invoice.title || 'فاکتور';
          const truncTitle = rawTitle.length > 20 ? rawTitle.substring(0, 18) + '...' : rawTitle;
          invoiceLabel = `${truncTitle} · #${toPersianDigits(invoice.number)}`;
      }

      let payeeName = null;
      if (t.payeeId) {
          const u = users.find(user => user.id === t.payeeId);
          if (u) payeeName = `${u.firstName} ${u.lastName}`;
      } else if (t.payeeName) {
          payeeName = t.payeeName;
      }

      return (
          <div className="flex flex-wrap gap-2 items-center">
               {catLabel && (
                   <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg border border-transparent">
                       <Tag size={10}/> {catLabel}
                   </span>
               )}
               {project && (
                   <button onClick={(e) => { e.stopPropagation(); setFilterProject(derivedProjectId || 'All'); setOpenProjectMenu(false);}} className="inline-flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 hover:bg-purple-100 transition">
                       <Briefcase size={10}/> پروژه: {project.title}
                   </button>
               )}
               {derivedClientId && (
                   <button onClick={(e) => { e.stopPropagation(); setFilterEntity(derivedClientId || 'All'); setOpenEntityMenu(false);}} className="inline-flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100 hover:bg-orange-100 transition">
                       <UserIcon size={10}/> مشتری: {clients.find(c => c.id === derivedClientId)?.name}
                   </button>
               )}
               {invoiceLabel && (
                   <button 
                       onClick={(e) => { 
                           e.stopPropagation(); 
                           setSearchQuery(invoice?.number || '');
                       }} 
                       className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition active:scale-95"
                   >
                       <FileText size={10}/> {invoiceLabel} 
                   </button>
               )}
               {payeeName && (
                   <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if(t.payeeId) setFilterPayee(t.payeeId);
                        }}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg border transition active:scale-95 ${t.payeeId ? 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100 cursor-pointer' : 'text-gray-600 bg-gray-100 border-gray-200 cursor-default'}`}
                   >
                       <UserIcon size={10}/> پرداخت به: {payeeName}
                   </button>
               )}
           </div>
      );
  };

  // --- RENDER HELPERS ---
  const renderRow = (t: Transaction, index: number, isChild = false) => {
       const isCancelled = t.status === 'Cancelled';
       const isIncome = t.type === TransactionType.Income;
       
       let displayTitle = t.title || t.description || 'بدون عنوان';
       if (isChild) displayTitle = t.title;
       
       const isSystem = t.systemKey?.startsWith('COMMISSION');

       const displayNo = isChild ? index + 1 : (t.sequenceNo ?? legacySequenceMap[t.id]);

       // Fix 5: Permissions for UI
       const canManage = hasPermission('MANAGE_FINANCE');
       
       // Edit: Allowed if Registered (Standard) OR Approved (Admin Only)
       const canEdit = (t.status === 'Registered' && canManage) || (t.status === 'Approved' && isSuperAdmin);
       
       // Cancel: Allowed if Manage (Standard) OR Approved (Admin Only)
       const canCancel = (t.status === 'Registered' && canManage) || (t.status === 'Approved' && isSuperAdmin);

       return (
           <tr 
                key={t.id}
                className={`
                    group relative transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]
                    ${isCancelled ? 'grayscale-[0.8] opacity-80' : ''}
                    ${isChild ? 'hover:bg-gray-50 dark:hover:bg-slate-800/50' : 'bg-white dark:bg-slate-800 rounded-2xl hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-black/20 border-separate'}
                `}
           >
               <td className={`${INDEX_CELL_CLASS} ${isChild ? '' : 'rounded-r-2xl'}`}>
                   {toPersianDigits(displayNo)}
               </td>

               <td className="border-y border-gray-100 dark:border-slate-700 p-4 align-middle">
                   <div className="flex flex-col gap-2">
                       <div className={`font-bold text-gray-800 dark:text-gray-200 text-base transition-all flex items-center gap-2 ${isCancelled ? 'line-through text-gray-500' : ''}`}>
                           {isChild && <CornerDownRight size={16} className="text-gray-300 shrink-0"/>}
                           {displayTitle}
                           
                           {isSystem && (
                               <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                                   سیستمی
                               </span>
                           )}
                       </div>
                       
                       <RenderRelationChips t={t} isChild={isChild} />
                   </div>
               </td>

               <td className="border-y border-gray-100 dark:border-slate-700 p-4 text-center align-middle w-48">
                   <div className="flex flex-col items-center justify-center">
                       <span className={`text-xl font-black tracking-tight transition-colors ${isCancelled ? 'line-through text-gray-400' : (isIncome ? 'text-emerald-600' : 'text-red-500')}`}>
                           {formatCurrency(t.amount)}
                       </span>
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 transition-colors ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                           {isIncome ? 'درآمد' : 'هزینه'}
                       </span>
                   </div>
               </td>

               {/* Fix 4: Ensure Calendar Icon is present for both Parent and Child rows */}
               <td className="border-y border-gray-100 dark:border-slate-700 p-4 text-center align-middle w-40">
                   <div className="flex flex-col items-center gap-1 text-gray-500">
                       <div className="flex items-center gap-1.5 text-xs font-bold bg-gray-50 dark:bg-slate-700/50 px-2 py-1 rounded-lg">
                           <Calendar size={12} className="text-gray-400"/>
                           {formatJalaliShort(t.date)}
                       </div>
                       <div className="flex items-center gap-1 text-[10px] opacity-70">
                           <CreditCard size={10}/>
                           {getPaymentLabel(t.paymentMethod)}
                       </div>
                   </div>
               </td>

               <td className="border-y border-gray-100 dark:border-slate-700 p-4 text-center align-middle w-40">
                   <div className="flex flex-col items-center justify-center gap-2 relative">
                       {getStatusChip(t.status || 'Registered', isCancelled)}
                       {/* Only Admin can Approve */}
                       {!isCancelled && t.status === 'Registered' && isSuperAdmin && (
                           <button 
                               onClick={(e) => initiateApprove(e, t)}
                               className="absolute -left-8 top-1 p-1.5 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200 transition-all opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 shadow-sm hover:scale-110 active:scale-95"
                               title="تایید نهایی"
                           >
                               <Check size={14} strokeWidth={3}/>
                           </button>
                       )}
                   </div>
               </td>

               <td className={`border-y border-gray-100 dark:border-slate-700 p-4 text-center align-middle w-16 ${isChild ? '' : 'rounded-l-2xl'}`}>
                   <div className="flex justify-center items-center gap-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 ease-out">
                       
                       {/* Fix 5: Edit Button Logic - Hide if not allowed */}
                       {canEdit && !isCancelled && (
                           <button 
                               onClick={(e) => handleEditTransaction(e, t)}
                               className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 transition shadow-sm active:scale-95"
                               title="ویرایش"
                           >
                               <Edit2 size={16}/>
                           </button>
                       )}

                       {t.status === 'Cancelled' ? (
                           isSuperAdmin && <button onClick={(e) => initiateRestore(e, t)} className="p-2 rounded-xl text-blue-500 bg-blue-50 hover:bg-blue-100 transition shadow-sm active:scale-95" title="بازگردانی"><RotateCcw size={16}/></button>
                       ) : (
                           // Fix 5: Cancel Button Logic - Hide if not allowed
                           canCancel && (
                               <button 
                                onClick={(e) => initiateCancel(e, t)} 
                                className={`p-2 rounded-xl transition active:scale-95 text-gray-400 hover:text-red-500 hover:bg-red-50`}
                                title="لغو تراکنش"
                               >
                                   {t.status === 'Approved' ? <Lock size={16}/> : <XCircle size={18}/>}
                               </button>
                           )
                       )}
                   </div>
               </td>
           </tr>
       );
  };

  const renderGroup = (groupOrItem: any, gIdx: number) => {
       if (groupOrItem.type === 'item') {
           return renderRow(groupOrItem.data, gIdx);
       } else {
           const { invoice: inv, items } = groupOrItem.data;
           const isExpanded = expandedRowId === inv.id;
           const { totalPaid } = getInvoiceGlobalStats(inv.id);
           const remaining = Math.max(0, inv.finalAmount - totalPaid);
           const progress = inv.finalAmount > 0 ? (totalPaid / inv.finalAmount) * 100 : 0;
           const isSettled = progress >= 100;
           
           let groupTitle = inv.title?.trim() || '';
           if (!groupTitle) groupTitle = `فاکتور #${toPersianDigits(inv.number)}`;

           return (
               <React.Fragment key={`group-${inv.id}`}>
                   <tr className="bg-white dark:bg-slate-800 rounded-2xl border-l-4 border-blue-500 hover:shadow-lg transition cursor-pointer" onClick={() => toggleRowExpansion(inv.id)}>
                       <td className={`${INDEX_CELL_CLASS} rounded-r-2xl`}>{toPersianDigits(gIdx + 1)}</td>
                       <td className="p-4">
                           <div className="flex flex-col">
                               <div className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                   <span>{groupTitle}</span>
                                   <span className="text-[10px] bg-blue-50 dark:bg-slate-700 text-blue-600 px-2 py-0.5 rounded-full">{toPersianDigits(items.length)} تراکنش</span>
                               </div>
                               <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-2">
                                   <span className="font-mono">#{toPersianDigits(inv.number)}</span>
                                   <span>—</span>
                                   <span>{formatCurrency(inv.finalAmount)} {inv.currency}</span>
                               </div>
                               <div className="mt-2">
                                   <RenderRelationChips t={items[0]} isChild={false} />
                               </div>
                           </div>
                       </td>
                       <td className="p-4 text-center">
                           <div className="flex flex-col items-center">
                               <span className="font-bold text-emerald-600">{formatCurrency(totalPaid)}</span>
                               <span className="text-[10px] text-gray-400">پرداخت شده</span>
                           </div>
                       </td>
                       <td className="p-4 align-middle text-center">
                           <span className="text-xs text-gray-500">{items.length > 0 ? formatJalaliShort(items[0].date) : '-'}</span>
                       </td>
                       <td className="p-4 text-center align-middle">
                           <div className="w-full max-w-[140px] mx-auto">
                               {/* Fix 3: Settled Badge Style & Spacing */}
                               <div className="flex justify-between items-center mb-2">
                                   <span className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${isSettled ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                       {isSettled ? 'تسویه شده' : 'پرداخت مرحله‌ای'}
                                   </span>
                                   <span className="text-[9px] text-gray-400">{toPersianDigits(Math.round(progress))}%</span>
                               </div>
                               <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                   <div className={`h-full ${isSettled ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${Math.min(100, progress)}%`}}></div>
                               </div>
                           </div>
                       </td>
                       <td className="p-4 text-center last:rounded-l-2xl">
                           <ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}/>
                       </td>
                   </tr>
                   
                   {isExpanded && (
                       <tr>
                           <td colSpan={6} className="p-0 border-none">
                               <div className="bg-gray-50 dark:bg-slate-900/50 mb-6 rounded-b-2xl border-r-4 border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm relative animate-in slide-in-from-top-2 duration-200">
                                   <table className="w-full border-collapse">
                                       <tbody>
                                       {items.map((t, idx) => renderRow(t, idx, true))}
                                       </tbody>
                                   </table>
                               </div>
                           </td>
                       </tr>
                   )}
               </React.Fragment>
           );
       }
  };

  // --- SPLIT VIEW LOGIC ---
  const renderSplitView = () => {
      const incomeList = processGroupedItems(filteredTransactions.filter(t => t.type === TransactionType.Income));
      const expenseList = filteredTransactions.filter(t => t.type === TransactionType.Expense);

      return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700">
                  <h3 className="font-black text-lg text-emerald-600 mb-4 flex items-center gap-2"><ArrowUpCircle/> دریافتی‌ها و درآمد</h3>
                  <table className="w-full border-separate border-spacing-y-3">
                      <tbody>
                          {incomeList.length > 0 ? incomeList.map((g, i) => renderGroup(g, i)) : <tr><td className="text-center text-gray-400 py-4">بدون درآمد</td></tr>}
                      </tbody>
                  </table>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700">
                  <h3 className="font-black text-lg text-red-600 mb-4 flex items-center gap-2"><ArrowDownCircle/> هزینه‌های مرتبط</h3>
                  <table className="w-full border-separate border-spacing-y-3">
                      <tbody>
                          {expenseList.length > 0 ? expenseList.map((t, i) => renderRow(t, i)) : <tr><td className="text-center text-gray-400 py-4">بدون هزینه</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  return (
    <div className="font-shabnam">
       <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-slate-700">
           <button onClick={() => setActiveTab(FinanceCategory.Agency)} className={`pb-3 px-4 font-bold transition ${activeTab === FinanceCategory.Agency ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>مالی آژانس</button>
           <button onClick={() => setActiveTab(FinanceCategory.Personal)} className={`pb-3 px-4 font-bold transition ${activeTab === FinanceCategory.Personal ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>مالی شخصی</button>
       </div>

       {/* --- SUMMARY SECTION --- */}
       <div className="mb-8 space-y-4">
           {/* Period Selector */}
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
               <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                   <Wallet className="text-primary-600"/> خلاصه وضعیت مالی
               </h3>
               <div className="bg-gray-100 dark:bg-slate-900 p-1 rounded-xl flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar">
                   {[{id: 'ThisMonth', label: 'این ماه'}, {id: 'LastMonth', label: 'ماه قبل'}, {id: 'Last30Days', label: '۳۰ روز اخیر'}, {id: 'Custom', label: 'بازه دلخواه'}].map(period => (
                       <button
                           key={period.id}
                           onClick={() => setSummaryPeriod(period.id as any)}
                           className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${summaryPeriod === period.id ? 'bg-white dark:bg-slate-700 shadow text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                       >
                           {period.label}
                       </button>
                   ))}
               </div>
           </div>

           {/* Custom Range Input for Summary */}
           {summaryPeriod === 'Custom' && (
               <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                   <JalaliDatePicker isRange startDate={summaryCustomRange.start} endDate={summaryCustomRange.end} onRangeChange={(s, e) => setSummaryCustomRange({start: s, end: e})} label="انتخاب بازه زمانی گزارش"/>
               </div>
           )}

           {/* Summary Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl flex items-center justify-between border border-emerald-100 dark:border-emerald-800 shadow-sm relative overflow-hidden group">
                   <div className="relative z-10">
                       <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1 flex items-center gap-1"><ArrowUpCircle size={14}/> مجموع درآمد</p>
                       <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">{formatCurrency(summaryStats.income)} <span className="text-xs opacity-70 font-normal">تومان</span></h3>
                       <p className="text-[10px] text-emerald-600/60 mt-2 font-medium">بازه: {summaryStats.label}</p>
                   </div>
                   <div className="p-3 bg-white/50 rounded-2xl relative z-10"><TrendingUp className="text-emerald-500 w-6 h-6" /></div>
                   <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-emerald-100 dark:bg-emerald-800 rounded-full opacity-50 blur-xl group-hover:scale-110 transition-transform"></div>
               </div>

               <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-3xl flex items-center justify-between border border-red-100 dark:border-red-800 shadow-sm relative overflow-hidden group">
                   <div className="relative z-10">
                       <p className="text-red-600 dark:text-red-400 text-xs font-bold mb-1 flex items-center gap-1"><ArrowDownCircle size={14}/> مجموع هزینه</p>
                       <h3 className="text-2xl font-black text-red-700 dark:text-red-300 tracking-tight">{formatCurrency(summaryStats.expense)} <span className="text-xs opacity-70 font-normal">تومان</span></h3>
                       <p className="text-[10px] text-red-600/60 mt-2 font-medium">بازه: {summaryStats.label}</p>
                   </div>
                   <div className="p-3 bg-white/50 rounded-2xl relative z-10"><TrendingDown className="text-red-500 w-6 h-6" /></div>
                   <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-red-100 dark:bg-red-800 rounded-full opacity-50 blur-xl group-hover:scale-110 transition-transform"></div>
               </div>

               <div className={`p-6 rounded-3xl flex items-center justify-between border shadow-sm relative overflow-hidden group transition-colors ${summaryStats.net >= 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800'}`}>
                   <div className="relative z-10">
                       <p className={`text-xs font-bold mb-1 flex items-center gap-1 ${summaryStats.net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}><Wallet size={14}/> سود خالص</p>
                       <h3 className={`text-2xl font-black tracking-tight ${summaryStats.net >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-orange-700 dark:text-orange-300'}`}>{formatCurrency(summaryStats.net)} <span className="text-xs opacity-70 font-normal">تومان</span></h3>
                       <p className={`text-[10px] mt-2 font-medium ${summaryStats.net >= 0 ? 'text-indigo-600/60' : 'text-orange-600/60'}`}>بازه: {summaryStats.label}</p>
                   </div>
                   <div className="p-3 bg-white/50 rounded-2xl relative z-10">{summaryStats.net >= 0 ? <CheckCircle className="text-indigo-500 w-6 h-6"/> : <AlertCircle className="text-orange-500 w-6 h-6"/>}</div>
                   <div className={`absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-50 blur-xl group-hover:scale-110 transition-transform ${summaryStats.net >= 0 ? 'bg-indigo-100 dark:bg-indigo-800' : 'bg-orange-100 dark:bg-orange-800'}`}></div>
               </div>
           </div>
       </div>
       
       {/* Search & Filters */}
       <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl border border-gray-100 dark:border-slate-700 mb-6 shadow-sm">
            {/* ... Filters content same as previous ... */}
            <div className="flex flex-col md:flex-row gap-3 items-center p-2">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="جستجو در تراکنش‌ها..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-4 pr-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-900 border-none outline-none focus:ring-2 focus:ring-primary-500/20 transition text-sm font-medium"
                    />
                </div>
                
                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end">
                    
                    {/* Project Filter */}
                    <div className="relative" ref={projectMenuRef}>
                        <button onClick={() => setOpenProjectMenu(!openProjectMenu)} className={`h-10 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${filterProject !== 'All' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>
                            <Briefcase size={16}/>
                            <span>{filterProject !== 'All' ? (projects.find(p => p.id === filterProject)?.title || 'پروژه') : 'پروژه...'}</span>
                            <ChevronDown size={12} className={`transition-transform ${openProjectMenu ? 'rotate-180' : ''}`}/>
                        </button>
                        {openProjectMenu && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150 origin-top-right max-h-60 overflow-y-auto custom-scrollbar">
                                <button onClick={() => { setFilterProject('All'); setOpenProjectMenu(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition ${filterProject === 'All' ? 'bg-purple-50 text-purple-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                    همه پروژه‌ها
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                                {projects.map(p => (
                                    <button key={p.id} onClick={() => { setFilterProject(p.id); setOpenProjectMenu(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition flex justify-between ${filterProject === p.id ? 'bg-purple-50 text-purple-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                        {p.title}
                                        {filterProject === p.id && <Check size={12}/>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Entity Filter */}
                    <div className="relative" ref={entityMenuRef}>
                        <button onClick={() => setOpenEntityMenu(!openEntityMenu)} className={`h-10 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${filterEntity !== 'All' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>
                            <Users size={16}/>
                            <span>{filterEntity !== 'All' ? (clients.find(c => c.id === filterEntity)?.name || 'مشتری') : 'مشتری / گروه...'}</span>
                            <ChevronDown size={12} className={`transition-transform ${openEntityMenu ? 'rotate-180' : ''}`}/>
                        </button>
                        {openEntityMenu && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150 origin-top-right max-h-60 overflow-y-auto custom-scrollbar">
                                <button onClick={() => { setFilterEntity('All'); setOpenEntityMenu(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition ${filterEntity === 'All' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                    همه تراکنش‌ها
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                                <span className="px-2 text-[10px] text-gray-400 font-bold mb-1">مشتریان و کانکشن‌ها</span>
                                {clients.map(c => (
                                    <button key={c.id} onClick={() => { setFilterEntity(c.id); setOpenEntityMenu(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition flex justify-between ${filterEntity === c.id ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                        {c.name}
                                        {filterEntity === c.id && <Check size={12}/>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Payee Filter (New) */}
                    <div className="relative" ref={payeeMenuRef}>
                        <button onClick={() => setOpenPayeeMenu(!openPayeeMenu)} className={`h-10 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${filterPayee !== 'All' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>
                            <UserIcon size={16}/>
                            <span>{filterPayee !== 'All' ? (users.find(u => u.id === filterPayee)?.firstName || 'شخص') : 'پرداخت به...'}</span>
                            <ChevronDown size={12} className={`transition-transform ${openPayeeMenu ? 'rotate-180' : ''}`}/>
                        </button>
                        {openPayeeMenu && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150 origin-top-right max-h-60 overflow-y-auto custom-scrollbar">
                                <button onClick={() => { setFilterPayee('All'); setOpenPayeeMenu(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition ${filterPayee === 'All' ? 'bg-amber-50 text-amber-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                    همه اشخاص
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                                {users.map(u => (
                                    <button key={u.id} onClick={() => { setFilterPayee(u.id); setOpenPayeeMenu(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition flex justify-between ${filterPayee === u.id ? 'bg-amber-50 text-amber-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                        {u.firstName} {u.lastName}
                                        {filterPayee === u.id && <Check size={12}/>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-100 dark:bg-slate-900 p-1 rounded-xl flex h-10 items-center">
                        {['All', 'Income', 'Expense'].map(t => (
                            <button key={t} onClick={() => setFilterType(t as any)} className={`px-3 h-8 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ${filterType === t ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                                {t === 'Income' && <ArrowUpCircle size={12} className={filterType === t ? 'text-emerald-500' : ''}/>}
                                {t === 'Expense' && <ArrowDownCircle size={12} className={filterType === t ? 'text-red-500' : ''}/>}
                                {t === 'All' ? 'همه' : t === 'Income' ? 'درآمد' : 'هزینه'}
                            </button>
                        ))}
                    </div>

                    <div className="relative" ref={statusMenuRef}>
                        <button onClick={() => setOpenStatusMenu(!openStatusMenu)} className={`h-10 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${filterStatus !== 'All' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>
                            {filterStatus === 'All' ? 'همه وضعیت‌ها' : filterStatus === 'Registered' ? 'ثبت‌شده' : filterStatus === 'Approved' ? 'تایید نهایی' : 'لغو شده'}
                            <ChevronDown size={12} className={`transition-transform ${openStatusMenu ? 'rotate-180' : ''}`}/>
                        </button>
                        {openStatusMenu && (
                            <div className="absolute top-full left-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-1 animate-in fade-in zoom-in-95 duration-150 origin-top-left">
                                {['All', 'Registered', 'Approved', 'Cancelled'].map(s => (
                                    <button key={s} onClick={() => { setFilterStatus(s as any); setOpenStatusMenu(false); }} className="w-full text-right px-3 py-2 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center justify-between text-gray-600 dark:text-gray-300">
                                        {s === 'All' ? 'همه' : s === 'Registered' ? 'ثبت‌شده' : s === 'Approved' ? 'تایید نهایی' : 'لغو شده'}
                                        {filterStatus === s && <Check size={12} className="text-primary-600"/>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative" ref={dateMenuRef}>
                        <button onClick={() => setOpenDateMenu(!openDateMenu)} className={`h-10 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${dateFilter !== 'All' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>
                            <Calendar size={16}/>
                            <span>{getDateLabel(dateFilter)}</span>
                            <ChevronDown size={12} className={`transition-transform ${openDateMenu ? 'rotate-180' : ''}`}/>
                        </button>
                        {openDateMenu && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                                {['All', 'Today', 'Week', 'Month'].map(opt => (
                                    <button key={opt} onClick={() => { setDateFilter(opt as any); setOpenDateMenu(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition flex items-center justify-between ${dateFilter === opt ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                        {getDateLabel(opt)}
                                        {dateFilter === opt && <Check size={12}/>}
                                    </button>
                                ))}
                                <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                                <div className="px-1">
                                     <button onClick={() => setDateFilter('Custom')} className={`w-full text-right px-3 py-2 text-xs rounded-lg font-medium transition flex items-center justify-between ${dateFilter === 'Custom' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
                                        بازه زمانی دلخواه
                                        {dateFilter === 'Custom' && <Check size={12}/>}
                                    </button>
                                    {dateFilter === 'Custom' && (
                                        <div className="mt-2">
                                            <JalaliDatePicker isRange startDate={customDateRange.start} endDate={customDateRange.end} onRangeChange={(s, e) => setCustomDateRange({start: s, end: e})} label="" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setShowAdvanced(!showAdvanced)} className={`h-10 w-10 flex items-center justify-center rounded-xl border transition ${showAdvanced ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 hover:bg-gray-50'}`} title="فیلترهای پیشرفته">
                        <Filter size={18}/>
                    </button>
                </div>
            </div>

            {showAdvanced && (
                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4 fade-in">
                    <div className="relative" ref={advCategoryRef}>
                        <div onClick={() => setOpenAdvCategory(!openAdvCategory)} className={`h-10 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer border select-none ${advFilters.categoryId ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Tag size={16} className={`shrink-0 ${advFilters.categoryId ? 'text-primary-600' : 'text-gray-400'}`}/>
                                <span className="truncate">{getSelectedLabel('Category', advFilters.categoryId)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {advFilters.categoryId && <button onClick={(e) => { e.stopPropagation(); setAdvFilters({...advFilters, categoryId: ''}); }} className="p-1 hover:bg-black/10 rounded-full transition"><X size={12}/></button>}
                                <ChevronDown size={12} className={`transition-transform duration-200 text-gray-400 ${openAdvCategory ? 'rotate-180' : ''}`}/>
                            </div>
                        </div>
                        {openAdvCategory && (
                            <div className="absolute top-[calc(100%+4px)] right-0 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-[60] p-1 max-h-60 overflow-y-auto custom-scrollbar">
                                <button onClick={() => { setAdvFilters({...advFilters, categoryId: ''}); setOpenAdvCategory(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg transition ${!advFilters.categoryId ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>همه دسته‌ها</button>
                                {categories.filter(c => !c.parentId).map(c => (
                                    <button key={c.id} onClick={() => { setAdvFilters({...advFilters, categoryId: c.id}); setOpenAdvCategory(false); }} className={`w-full text-right px-3 py-2 text-xs rounded-lg transition flex justify-between items-center ${advFilters.categoryId === c.id ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}><span>{c.name}</span>{advFilters.categoryId === c.id && <Check size={12}/>}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
       </div>

       <div className="flex justify-between items-center mb-6">
           <div>
               <h2 className="text-xl font-black text-gray-800 dark:text-white tracking-tight">لیست تراکنش‌ها</h2>
               <p className="text-xs text-gray-400 mt-1">مدیریت و پیگیری تراکنش‌های {activeTab === FinanceCategory.Agency ? 'آژانس' : 'شخصی'}</p>
           </div>
           <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }} 
                className="bg-primary-600 hover:bg-primary-700 transition active:scale-95 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-primary-500/30"
            >
               <Plus size={20} /> ثبت تراکنش
           </button>
       </div>

       {/* CONDITIONAL RENDER: SPLIT VIEW IF ENTITY SELECTED */}
       {filterEntity !== 'All' ? renderSplitView() : (
           <div className="overflow-x-auto pb-20">
               <table className="w-full border-separate border-spacing-y-3">
                   <thead className="text-gray-400 text-xs uppercase tracking-wider opacity-60">
                       <tr>
                           <th className="px-4 py-2 w-10 text-center">#</th>
                           <th className="px-4 py-2 text-right">عنوان و جزئیات</th>
                           <th className="px-4 py-2 text-center w-48">مبلغ</th>
                           <th className="px-4 py-2 text-center w-40">تاریخ / پرداخت</th>
                           <th className="px-4 py-2 text-center w-40">وضعیت</th>
                           <th className="px-4 py-2 w-16"></th>
                       </tr>
                   </thead>
                   <tbody>
                       {groupedItems.length > 0 ? groupedItems.map((groupOrItem, gIdx) => renderGroup(groupOrItem, gIdx)) : <tr><td colSpan={6} className="text-center py-12 text-gray-400">هیچ تراکنشی یافت نشد</td></tr>}
                   </tbody>
               </table>
           </div>
       )}

       {/* Modals ... */}
       {/* ... Confirmation Modals ... */}
       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="ثبت تراکنش جدید" size="md">
           <form onSubmit={handleSubmit} className="space-y-5">
               <div className="flex gap-2 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                   <button type="button" onClick={() => { setFormData({...formData, type: TransactionType.Income, categoryId: undefined}); setSelectedParentCat(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${formData.type === TransactionType.Income ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}><ArrowUpCircle size={16}/> درآمد</button>
                   <button type="button" onClick={() => { setFormData({...formData, type: TransactionType.Expense, categoryId: undefined}); setSelectedParentCat(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${formData.type === TransactionType.Expense ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}><ArrowDownCircle size={16}/> هزینه</button>
               </div>

               <div>
                   <label className="block text-sm font-bold mb-1">عنوان تراکنش <span className="text-red-500">*</span></label>
                   <input placeholder="مثلاً: دریافت قسط اول پروژه..." value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 outline-none focus:border-primary-500 transition" required autoFocus/>
               </div>
               
               <CurrencyInput label="مبلغ تراکنش" value={formData.amount} onChange={(val: number) => setFormData({...formData, amount: val})} required disabled={!!formData.invoiceId && formData.type === TransactionType.Income} placeholder={!!formData.invoiceId && formData.type === TransactionType.Income ? "محاسبه خودکار از پرداخت‌ها" : "0"}/>
               
               {/* Categories */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                       <label className="block text-sm font-bold mb-1">دسته‌بندی</label>
                       <select value={selectedParentCat} onChange={(e) => { const val = e.target.value; setSelectedParentCat(val); setFormData(prev => ({...prev, categoryId: val || undefined})); }} className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 outline-none cursor-pointer">
                           <option value="">انتخاب دسته (اختیاری)</option>
                           {categories.filter(c => c.type === (formData.type === TransactionType.Income ? 'income' : 'expense') && !c.parentId && c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                   </div>
                   <div>
                       <label className="block text-sm font-bold mb-1">زیر‌دسته</label>
                       <select value={formData.categoryId || ''} onChange={(e) => setFormData(prev => ({...prev, categoryId: e.target.value || selectedParentCat || undefined}))} disabled={!selectedParentCat} className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 outline-none cursor-pointer disabled:opacity-50">
                           <option value={selectedParentCat || ''}>(پیش‌فرض دسته اصلی)</option>
                           {selectedParentCat ? categories.filter(c => c.parentId === selectedParentCat && c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>) : []}
                       </select>
                   </div>
               </div>

               {/* Linked Entities */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                   <div>
                       <label className="block text-xs font-bold mb-1 text-gray-500">فاکتور مرتبط</label>
                       <select value={formData.invoiceId || ''} onChange={(e) => handleInvoiceSelect(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-sm outline-none">
                           <option value="">بدون فاکتور</option>
                           {invoices.map(i => <option key={i.id} value={i.id}>{i.title || 'بدون عنوان'} — #{toPersianDigits(i.number)}</option>)}
                       </select>
                   </div>
                   <div>
                       <label className="block text-xs font-bold mb-1 text-gray-500">پروژه</label>
                       <select value={formData.projectId || ''} onChange={(e) => handleProjectSelect(e.target.value)} disabled={!!formData.invoiceId} className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-sm outline-none disabled:opacity-50">
                           <option value="">انتخاب پروژه</option>
                           {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                       </select>
                   </div>
                   <div>
                       <label className="block text-xs font-bold mb-1 text-gray-500">مشتری / طرف حساب</label>
                       <select value={formData.clientId || ''} onChange={(e) => handleClientSelect(e.target.value)} disabled={!!formData.invoiceId || (!!formData.projectId && projects.find(p => p.id === formData.projectId)?.sourceType === 'Client')} className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-sm outline-none disabled:opacity-50">
                           <option value="">انتخاب طرف حساب</option>
                           {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                   </div>
               </div>

               {/* PAYEE: Only for Expenses */}
               {formData.type === TransactionType.Expense && (
                   <div className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                       <label className="block text-xs font-bold mb-2 text-gray-500 flex items-center gap-1">
                           <UserIcon size={12}/> پرداخت به (گیرنده وجه)
                       </label>
                       <div className="grid grid-cols-2 gap-3">
                           <div>
                               <select className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg outline-none cursor-pointer" value={formData.payeeId || ''} onChange={e => { setFormData(prev => ({...prev, payeeId: e.target.value || undefined, payeeName: undefined})); }}>
                                   <option value="">(انتخاب عضو تیم)</option>
                                   {users.map(u => (<option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>))}
                               </select>
                           </div>
                           <div>
                               <input type="text" placeholder="یا نام شخص / شرکت..." className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg outline-none" value={formData.payeeName || ''} onChange={e => setFormData(prev => ({...prev, payeeName: e.target.value, payeeId: undefined}))} disabled={!!formData.payeeId}/>
                           </div>
                       </div>
                   </div>
               )}

               {/* PARTIAL PAYMENTS: STRICTLY INCOME ONLY */}
               {formData.invoiceId && formData.type === TransactionType.Income && (
                   <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                       <div className="flex justify-between items-center">
                           <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2"><Layers size={16}/> پرداخت‌های فاکتور</h3>
                       </div>
                       
                        {/* Goal 2: Progress Bar */}
                        {(() => {
                            const inv = invoices.find(i => i.id === formData.invoiceId);
                            if(inv) {
                                const stats = getInvoiceGlobalStats(inv.id);
                                const currentPay = formData.amount || 0;
                                const paidTotal = stats.totalPaid + currentPay;
                                const percent = inv.finalAmount > 0 ? Math.min(100, Math.round((paidTotal / inv.finalAmount) * 100)) : 0;
                                const remaining = Math.max(0, inv.finalAmount - paidTotal);
                                
                                return (
                                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3 border border-blue-200 dark:border-blue-700 mb-3">
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <span className="text-blue-700 dark:text-blue-300 font-bold">وضعیت پرداخت فاکتور</span>
                                            <span className="font-bold text-blue-600">{toPersianDigits(percent)}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                                            <div className="h-full bg-blue-500 transition-all duration-500" style={{width: `${percent}%`}}></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                            <span>پرداخت شده: {formatCurrency(paidTotal)}</span>
                                            <span>مانده: {formatCurrency(remaining)}</span>
                                        </div>
                                    </div>
                                );
                            }
                        })()}

                        {/* Goal 1: Installment Count Input */}
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold mb-1 text-blue-700 dark:text-blue-300">تعداد کل اقساط</label>
                                <div className="relative">
                                     <input 
                                        type="number" 
                                        value={formData.installmentTotal || ''} 
                                        onChange={(e) => setFormData({...formData, installmentTotal: Number(e.target.value)})}
                                        disabled={!!invoices.find(i => i.id === formData.invoiceId)?.plannedInstallmentsCount && !isEditingInstallmentCount}
                                        className="w-full p-2 text-sm rounded-lg border border-blue-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:text-gray-500"
                                        placeholder="مثلاً 4"
                                     />
                                     {!!invoices.find(i => i.id === formData.invoiceId)?.plannedInstallmentsCount && !isEditingInstallmentCount && (
                                         <button 
                                            type="button" 
                                            onClick={() => setIsEditingInstallmentCount(true)}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 bg-white dark:bg-slate-700 rounded-full p-1 shadow-sm"
                                            title="ویرایش تعداد اقساط"
                                         >
                                             <Edit2 size={12}/>
                                         </button>
                                     )}
                                </div>
                            </div>
                        </div>

                       <div className="space-y-2">
                           {formData.partialPayments?.map((p, idx) => (
                               <div key={p.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm">
                                   <div className="flex justify-between items-center text-xs">
                                       <span className="font-bold">{formatCurrency(p.amount)}</span>
                                       <button type="button" onClick={() => handleRemovePayment(p.id)} className="text-red-500"><X size={14}/></button>
                                   </div>
                               </div>
                           ))}
                       </div>
                       {!showPartialPaymentForm ? (
                           <button type="button" onClick={() => setShowPartialPaymentForm(true)} className="w-full py-2 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center justify-center gap-1"><Plus size={14}/> افزودن پرداخت جدید</button>
                       ) : (
                           <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3">
                               <CurrencyInput placeholder="مبلغ پرداخت" value={newPayment.amount} onChange={(v: number) => setNewPayment({...newPayment, amount: v})}/>
                               <button type="button" onClick={handleAddPayment} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition">تایید</button>
                           </div>
                       )}
                   </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className={formData.partialPayments && formData.partialPayments.length > 0 ? 'opacity-50 pointer-events-none' : ''}>
                       <JalaliDatePicker label="تاریخ تراکنش" value={formData.date} onChange={(d: string) => setFormData({...formData, date: d})} />
                   </div>
                   <div>
                       <label className="block text-sm font-bold mb-1">روش پرداخت</label>
                       <select value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})} className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 outline-none cursor-pointer"><option value="Card">کارت به کارت</option><option value="Cash">نقدی</option><option value="Gateway">درگاه پرداخت</option><option value="Transfer">پایا / ساتنا</option><option value="Other">سایر</option></select>
                   </div>
               </div>

               <div>
                   <label className="block text-sm font-bold mb-1 text-gray-500">وضعیت اولیه</label>
                   <div className="flex gap-2 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                       <button type="button" onClick={() => setFormData({ ...formData, status: 'Registered' })} className={`flex-1 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${formData.status !== 'Approved' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}><Clock size={16} /> ثبت‌شده</button>
                       <button type="button" onClick={() => setFormData({ ...formData, status: 'Approved' })} className={`flex-1 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${formData.status === 'Approved' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}><ShieldCheck size={16} /> تایید نهایی</button>
                   </div>
               </div>

               <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-slate-700">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition">انصراف</button>
                   <button type="submit" className="px-8 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-500/20">ثبت تراکنش</button>
               </div>
           </form>
       </Modal>

        {approveId && (
            <Modal isOpen={true} onClose={() => setApproveId(null)} title="تایید نهایی تراکنش" size="sm">
                <div className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 font-medium leading-relaxed">
                        آیا از تایید نهایی این تراکنش اطمینان دارید؟ <br/>
                        <span className="text-xs text-gray-400">پس از تایید، تراکنش قفل خواهد شد.</span>
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setApproveId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition">انصراف</button>
                        <button onClick={performApprove} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20">تایید نهایی</button>
                    </div>
                </div>
            </Modal>
        )}

        {confirmId && (
            <Modal isOpen={true} onClose={() => setConfirmId(null)} title="لغو تراکنش" size="sm">
                <div className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 font-medium leading-relaxed">
                        آیا از لغو این تراکنش اطمینان دارید؟ <br/>
                        <span className="text-xs text-red-500">تراکنش لغو شده در محاسبات مالی لحاظ نخواهد شد.</span>
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setConfirmId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition">انصراف</button>
                        <button onClick={performCancel} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition shadow-lg shadow-red-500/20">لغو تراکنش</button>
                    </div>
                </div>
            </Modal>
        )}

        {restoreId && (
            <Modal isOpen={true} onClose={() => setRestoreId(null)} title="بازگردانی تراکنش" size="sm">
                <div className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 font-medium leading-relaxed">
                        آیا می‌خواهید این تراکنش را به وضعیت فعال بازگردانید؟
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setRestoreId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition">انصراف</button>
                        <button onClick={performRestore} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">بازگردانی</button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default FinanceView;
