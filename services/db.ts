
import { User, Client, Project, Transaction, Log, UserRole, UserStatus, AppSettings, Task, FinanceCategory, Department, Message, ChatThread, TransactionType, Invoice, Notification, NotificationType, ProjectStatus, ManagerialBroadcast, NotificationPriority, TransactionCategoryItem } from '../types';
import { generateId, DEFAULT_ROLE_PERMISSIONS, DEFAULT_SIDEBAR_CONFIG, daysBetween } from '../utils';

// Keys
const KEYS = {
  USERS: 'xrm_users',
  CLIENTS: 'xrm_clients',
  PROJECTS: 'xrm_projects',
  TRANSACTIONS: 'xrm_transactions',
  LOGS: 'xrm_logs',
  TASKS: 'xrm_tasks',
  DEPARTMENTS: 'xrm_departments',
  MESSAGES: 'xrm_messages',
  THREADS: 'xrm_threads',
  SETTINGS: 'xrm_settings',
  INVOICES: 'xrm_invoices',
  NOTIFICATIONS: 'xrm_notifications',
  BROADCASTS: 'xrm_broadcasts',
  CATEGORIES: 'xrm_transaction_categories',
  CURRENT_USER: 'xrm_current_user'
};

// ... (InitDB and other helpers remain unchanged) ...
// Initialize Data
export const initDB = () => {
  if (!localStorage.getItem(KEYS.USERS)) {
    const adminUser: User = {
      id: 'admin-1',
      username: '09117540145',
      passwordHash: '1234',
      firstName: 'مدیر',
      lastName: 'کل',
      role: UserRole.Admin,
      status: UserStatus.Active,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(KEYS.USERS, JSON.stringify([adminUser]));
  }
  if (!localStorage.getItem(KEYS.CLIENTS)) localStorage.setItem(KEYS.CLIENTS, '[]');
  if (!localStorage.getItem(KEYS.PROJECTS)) localStorage.setItem(KEYS.PROJECTS, '[]');
  if (!localStorage.getItem(KEYS.TRANSACTIONS)) localStorage.setItem(KEYS.TRANSACTIONS, '[]');
  if (!localStorage.getItem(KEYS.TASKS)) localStorage.setItem(KEYS.TASKS, '[]');
  if (!localStorage.getItem(KEYS.DEPARTMENTS)) localStorage.setItem(KEYS.DEPARTMENTS, '[]');
  if (!localStorage.getItem(KEYS.MESSAGES)) localStorage.setItem(KEYS.MESSAGES, '[]');
  if (!localStorage.getItem(KEYS.THREADS)) localStorage.setItem(KEYS.THREADS, '[]');
  if (!localStorage.getItem(KEYS.LOGS)) localStorage.setItem(KEYS.LOGS, '[]');
  if (!localStorage.getItem(KEYS.INVOICES)) localStorage.setItem(KEYS.INVOICES, '[]');
  if (!localStorage.getItem(KEYS.NOTIFICATIONS)) localStorage.setItem(KEYS.NOTIFICATIONS, '[]');
  if (!localStorage.getItem(KEYS.BROADCASTS)) localStorage.setItem(KEYS.BROADCASTS, '[]');
  
  if (!localStorage.getItem(KEYS.CATEGORIES)) {
      const defaultCategories: TransactionCategoryItem[] = [
          { id: 'cat-inc-1', name: 'پروژه', type: 'income', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-inc-2', name: 'ریتینر', type: 'income', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-inc-3', name: 'مشاوره', type: 'income', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-exp-1', name: 'حقوق / فریلنسر', type: 'expense', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-exp-2', name: 'ابزارها', type: 'expense', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-exp-3', name: 'هاست و دامنه', type: 'expense', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-exp-4', name: 'تبلیغات', type: 'expense', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-exp-5', name: 'اداری', type: 'expense', isActive: true, createdAt: new Date().toISOString() },
          { id: 'cat-exp-6', name: 'سایر', type: 'expense', isActive: true, createdAt: new Date().toISOString() },
      ];
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(defaultCategories));
  }

  if (!localStorage.getItem(KEYS.SETTINGS)) {
     const defaultSettings: AppSettings = {
         themeColor: '#14b8a6',
         menuTitles: {},
         projectTypes: ['Web', 'Mobile', 'UI/UX', 'SEO', 'Other'],
         sidebarConfig: DEFAULT_SIDEBAR_CONFIG,
         rolePermissions: DEFAULT_ROLE_PERMISSIONS
     };
     localStorage.setItem(KEYS.SETTINGS, JSON.stringify(defaultSettings));
  } else {
     const existing = JSON.parse(localStorage.getItem(KEYS.SETTINGS)!);
     if(!existing.sidebarConfig || !existing.rolePermissions) {
         const merged = {
             ...existing,
             sidebarConfig: existing.sidebarConfig || DEFAULT_SIDEBAR_CONFIG,
             rolePermissions: existing.rolePermissions || DEFAULT_ROLE_PERMISSIONS
         };
         localStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
     }
  }
};

const delay = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

const getItems = <T>(key: string): T[] => {
  const str = localStorage.getItem(key);
  return str ? JSON.parse(str) : [];
};

const saveItems = (key: string, items: any[]) => {
  localStorage.setItem(key, JSON.stringify(items));
};

const createNotificationInternal = (
    userId: string, 
    type: NotificationType, 
    title: string, 
    message: string, 
    link?: string, 
    relatedId?: string,
    priority: NotificationPriority = 'Normal',
    isManagerial: boolean = false,
    expiryDate?: string,
    batchId?: string
) => {
    const items = getItems<Notification>(KEYS.NOTIFICATIONS);
    const isDuplicate = items.some(n => 
        n.userId === userId && 
        n.type === type && 
        n.title === title && 
        n.message === message && 
        !n.isRead &&
        (new Date().getTime() - new Date(n.createdAt).getTime() < 24 * 60 * 60 * 1000) 
    );

    if (isDuplicate && type === 'System') return; 

    items.push({
        id: generateId(),
        userId,
        type,
        title,
        message,
        link,
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedId,
        priority,
        isManagerial,
        expiryDate,
        batchId
    });
    saveItems(KEYS.NOTIFICATIONS, items);
    window.dispatchEvent(new Event('notificationUpdated'));
};

const splitName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    const lastName = parts.pop();
    const firstName = parts.join(' ');
    return { firstName, lastName: lastName || '' };
};

import { LedgerSnapshotService } from './ledger';

export const api = {
  auth: {
    login: async (username: string, password: string): Promise<User | null> => {
      await delay();
      const users = getItems<User>(KEYS.USERS);
      const user = users.find(u => u.username === username && u.passwordHash === password && u.status !== UserStatus.Deleted);
      if (user) {
        if (user.status === UserStatus.Inactive) {
            return null;
        }
        user.lastLoginAt = new Date().toISOString();
        saveItems(KEYS.USERS, users);
        api.logs.add(user.id, 'LOGIN', 'ورود به سیستم');
        const notifs = getItems<Notification>(KEYS.NOTIFICATIONS);
        if(!notifs.some(n => n.userId === user.id && n.type === 'System' && n.title.includes('خوش'))) {
            createNotificationInternal(user.id, 'System', 'خوش آمدید', `به سیستم جامع مدیریت XRM خوش آمدید.`, '/dashboard');
        }
        if (user.role !== UserRole.Admin) {
            const admins = users.filter(u => u.role === UserRole.Admin);
            admins.forEach(admin => {
                createNotificationInternal(
                    admin.id, 
                    'System', 
                    'ورود کاربر', 
                    `${user.firstName} ${user.lastName} وارد سیستم شد.`, 
                    '/team'
                );
            });
        }
      }
      return user || null;
    }
  },
  automation: {
      runChecks: async () => {
          const projects = getItems<Project>(KEYS.PROJECTS);
          const now = new Date();
          projects.forEach(p => {
              if(p.status === ProjectStatus.Active && p.deadline) {
                  const days = daysBetween(now, new Date(p.deadline));
                  if(days <= (p.deadlineWarningDays || 3) && days >= 0) {
                      p.members.forEach(mId => {
                          createNotificationInternal(
                              mId, 
                              'Project', 
                              'هشدار ددلاین', 
                              `پروژه "${p.title}" به مهلت تحویل نزدیک است (${days} روز مانده).`, 
                              '/projects', 
                              p.id,
                              'High'
                          );
                      });
                  }
              }
          });
      }
  },
  settings: {
     get: async (): Promise<AppSettings> => {
         const str = localStorage.getItem(KEYS.SETTINGS);
         if (!str) return { 
            themeColor: '#14b8a6', menuTitles: {}, projectTypes: [], 
            sidebarConfig: DEFAULT_SIDEBAR_CONFIG, 
            rolePermissions: DEFAULT_ROLE_PERMISSIONS 
         };
         const parsed = JSON.parse(str);
         return Array.isArray(parsed) ? parsed[0] : parsed;
     },
     update: async (settings: AppSettings, userId: string) => {
         localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
         api.logs.add(userId, 'UPDATE_SETTINGS', 'بروزرسانی تنظیمات سیستم');
     }
  },
  users: {
    getAll: async () => { await delay(); return getItems<User>(KEYS.USERS).filter(u => u.status !== UserStatus.Deleted); },
    create: async (user: User, operatorId: string) => {
      await delay();
      const items = getItems<User>(KEYS.USERS);
      if (items.some(u => u.username === user.username && u.status !== UserStatus.Deleted)) throw new Error("نام کاربری تکراری است");
      items.push(user);
      saveItems(KEYS.USERS, items);
      api.logs.add(operatorId, 'CREATE_USER', `ایجاد کاربر ${user.firstName} ${user.lastName}`);
      createNotificationInternal(user.id, 'System', 'ایجاد حساب کاربری', 'حساب کاربری شما ایجاد شد. لطفاً اطلاعات خود را تکمیل کنید.', '/settings');
      return user;
    },
    update: async (user: User, operatorId: string) => {
      await delay();
      const items = getItems<User>(KEYS.USERS);
      const idx = items.findIndex(u => u.id === user.id);
      if (idx > -1) {
        items[idx] = user;
        saveItems(KEYS.USERS, items);
        api.logs.add(operatorId, 'UPDATE_USER', `ویرایش کاربر ${user.firstName}`);
      }
      return user;
    },
    delete: async (id: string, operatorId: string) => {
      await delay();
      let items = getItems<User>(KEYS.USERS);
      items = items.filter(u => u.id !== id);
      saveItems(KEYS.USERS, items);
      api.logs.add(operatorId, 'DELETE_USER', `حذف دائمی کاربر ${id}`);
    }
  },
  departments: {
      getAll: async () => { await delay(); return getItems<Department>(KEYS.DEPARTMENTS); },
      create: async (dept: Department, userId: string) => {
          const items = getItems<Department>(KEYS.DEPARTMENTS);
          items.push(dept);
          saveItems(KEYS.DEPARTMENTS, items);
          return dept;
      },
      delete: async (id: string, userId: string) => {
          await delay();
          let items = getItems<Department>(KEYS.DEPARTMENTS);
          const dept = items.find(d => d.id === id);
          if (dept) {
            items = items.filter(d => d.id !== id); 
            saveItems(KEYS.DEPARTMENTS, items);
            api.logs.add(userId, 'DELETE_DEPARTMENT', `حذف دپارتمان ${dept.name}`);
          }
      }
  },
  clients: {
    getAll: async () => { await delay(); return getItems<Client>(KEYS.CLIENTS); },
    create: async (client: Client, userId: string) => {
      await delay();
      const items = getItems<Client>(KEYS.CLIENTS);
      if (client.username && client.password) {
          const { firstName, lastName } = splitName(client.name);
          const newUser: User = {
              id: generateId(),
              username: client.username,
              passwordHash: client.password,
              firstName: firstName,
              lastName: lastName,
              role: UserRole.ClientUser,
              status: UserStatus.Active,
              createdAt: new Date().toISOString(),
              avatarUrl: client.avatarUrl
          };
          const users = getItems<User>(KEYS.USERS);
          if (users.some(u => u.username === newUser.username && u.status !== UserStatus.Deleted)) {
              console.warn("Username exists for client user creation");
          } else {
              users.push(newUser);
              saveItems(KEYS.USERS, users);
              client.relatedUserId = newUser.id;
              api.logs.add(userId, 'CREATE_USER_AUTO', `ایجاد خودکار کاربر برای مشتری ${client.name}`);
          }
      }
      items.push(client);
      saveItems(KEYS.CLIENTS, items);
      api.logs.add(userId, 'CREATE_CLIENT', `ایجاد مشتری ${client.name}`);
      return client;
    },
    update: async (client: Client, userId: string) => {
      await delay();
      const items = getItems<Client>(KEYS.CLIENTS);
      const idx = items.findIndex(c => c.id === client.id);
      if (idx > -1) {
        const users = getItems<User>(KEYS.USERS);
        if (client.relatedUserId) {
            const userIdx = users.findIndex(u => u.id === client.relatedUserId);
            if (userIdx > -1) {
                if (client.username && client.password) {
                    const { firstName, lastName } = splitName(client.name);
                    users[userIdx].firstName = firstName;
                    users[userIdx].lastName = lastName;
                    users[userIdx].username = client.username;
                    users[userIdx].passwordHash = client.password;
                    users[userIdx].avatarUrl = client.avatarUrl;
                    users[userIdx].status = UserStatus.Active;
                } else {
                    users[userIdx].status = UserStatus.Inactive;
                }
            }
        } else if (client.username && client.password) {
            const { firstName, lastName } = splitName(client.name);
            const newUser: User = {
                id: generateId(),
                username: client.username,
                passwordHash: client.password,
                firstName: firstName,
                lastName: lastName,
                role: UserRole.ClientUser,
                status: UserStatus.Active,
                createdAt: new Date().toISOString(),
                avatarUrl: client.avatarUrl
            };
            if (!users.some(u => u.username === newUser.username && u.status !== UserStatus.Deleted)) {
                users.push(newUser);
                client.relatedUserId = newUser.id;
            }
        }
        saveItems(KEYS.USERS, users);
        items[idx] = client;
        saveItems(KEYS.CLIENTS, items);
        api.logs.add(userId, 'UPDATE_CLIENT', `ویرایش مشتری ${client.name}`);
      }
    },
    delete: async (id: string, userId: string) => {
      await delay();
      let items = getItems<Client>(KEYS.CLIENTS);
      const client = items.find(c => c.id === id);
      if (client) {
        if (client.relatedUserId) {
            const users = getItems<User>(KEYS.USERS);
            const userIdx = users.findIndex(u => u.id === client.relatedUserId);
            if (userIdx > -1) {
                users[userIdx].status = UserStatus.Deleted;
                saveItems(KEYS.USERS, users);
            }
        }
        items = items.filter(c => c.id !== id);
        saveItems(KEYS.CLIENTS, items);
        api.logs.add(userId, 'DELETE_CLIENT', `حذف دائمی مشتری ${client.name}`);
      }
    }
  },
  projects: {
    getAll: async () => { await delay(); return getItems<Project>(KEYS.PROJECTS); },
    create: async (project: Project, userId: string) => {
      await delay();
      const items = getItems<Project>(KEYS.PROJECTS);
      
      if (project.totalBudget > 0) {
          project.budget = {
              total: project.totalBudget,
              currency: 'Toman', 
              notes: `بودجه اولیه پروژه ${project.title}`,
              lastUpdated: new Date().toISOString()
          };
      }

      items.push(project);
      saveItems(KEYS.PROJECTS, items);
      api.logs.add(userId, 'CREATE_PROJECT', `ایجاد پروژه ${project.title}`);
      
      return project;
    },
    update: async (project: Project, userId: string) => {
      await delay();
      const items = getItems<Project>(KEYS.PROJECTS);
      const idx = items.findIndex(p => p.id === project.id);
      if (idx > -1) {
        const oldProject = items[idx];
        items[idx] = project;
        saveItems(KEYS.PROJECTS, items);
        api.logs.add(userId, 'UPDATE_PROJECT', `ویرایش پروژه ${project.title}`);
        if (oldProject.status !== project.status) {
            project.members?.forEach(mId => {
                createNotificationInternal(mId, 'Project', 'تغییر وضعیت پروژه', `وضعیت پروژه "${project.title}" به ${project.status} تغییر یافت.`, '/projects', project.id);
            });
        }
        const newMembers = project.members.filter(m => !oldProject.members.includes(m));
        newMembers.forEach(mId => {
             createNotificationInternal(mId, 'Project', 'عضویت در پروژه', `شما به پروژه "${project.title}" اضافه شدید.`, '/projects', project.id);
        });
      }
    },
    delete: async (id: string, userId: string) => {
      await delay();
      let items = getItems<Project>(KEYS.PROJECTS);
      const project = items.find(p => p.id === id);
      if (project) {
        items = items.filter(p => p.id !== id);
        saveItems(KEYS.PROJECTS, items);
        api.logs.add(userId, 'DELETE_PROJECT', `حذف دائمی پروژه ${project.title}`);
      }
    }
  },
  invoices: {
    getAll: async () => { await delay(); return getItems<Invoice>(KEYS.INVOICES); },
    getById: async (id: string) => { 
        await delay(); 
        const items = getItems<Invoice>(KEYS.INVOICES);
        return items.find(i => i.id === id) || null;
    },
    create: async (invoice: Invoice, userId: string) => {
        await delay();
        const items = getItems<Invoice>(KEYS.INVOICES);
        items.push(invoice);
        saveItems(KEYS.INVOICES, items);
        api.logs.add(userId, 'CREATE_INVOICE', `ایجاد فاکتور شماره ${invoice.number}`);
        if(invoice.clientId) {
            const clients = getItems<Client>(KEYS.CLIENTS);
            const client = clients.find(c => c.id === invoice.clientId);
            if(client && client.relatedUserId) {
                createNotificationInternal(client.relatedUserId, 'Financial', 'صدور فاکتور جدید', `فاکتور شماره ${invoice.number} برای شما صادر شد.`, `/invoices/${invoice.id}/print`, invoice.id);
            }
        }
        return invoice;
    },
    update: async (invoice: Invoice, userId: string) => {
        await delay();
        const items = getItems<Invoice>(KEYS.INVOICES);
        const idx = items.findIndex(i => i.id === invoice.id);
        if(idx > -1) {
            const oldInvoice = items[idx];
            items[idx] = invoice;
            saveItems(KEYS.INVOICES, items);
            api.logs.add(userId, 'UPDATE_INVOICE', `ویرایش فاکتور شماره ${invoice.number}`);
            if (oldInvoice.status !== invoice.status) {
                 if (invoice.clientId) {
                     const client = getItems<Client>(KEYS.CLIENTS).find(c => c.id === invoice.clientId);
                     if (client?.relatedUserId) {
                         createNotificationInternal(client.relatedUserId, 'Financial', 'تغییر وضعیت فاکتور', `وضعیت فاکتور ${invoice.number} به ${invoice.status} تغییر یافت.`, `/invoices/${invoice.id}/print`, invoice.id);
                     }
                 }
            }
        }
        return invoice;
    },
    delete: async (id: string, userId: string) => {
        await delay();
        let items = getItems<Invoice>(KEYS.INVOICES);
        const invoice = items.find(i => i.id === id);
        if(invoice) {
            items = items.filter(i => i.id !== id);
            saveItems(KEYS.INVOICES, items);
            api.logs.add(userId, 'DELETE_INVOICE', `حذف فاکتور شماره ${invoice.number}`);
        }
    }
  },
  categories: {
      getAll: async () => { await delay(); return getItems<TransactionCategoryItem>(KEYS.CATEGORIES); },
      getUsageCount: async (id: string) => {
          await delay();
          const items = getItems<TransactionCategoryItem>(KEYS.CATEGORIES);
          const transactions = getItems<Transaction>(KEYS.TRANSACTIONS);
          // Check direct usage or usage of children
          const childIds = items.filter(c => c.parentId === id).map(c => c.id);
          const allRelatedIds = [id, ...childIds];
          
          return transactions.filter(t => t.categoryId && allRelatedIds.includes(t.categoryId)).length;
      },
      create: async (category: TransactionCategoryItem, userId: string) => {
          const items = getItems<TransactionCategoryItem>(KEYS.CATEGORIES);
          items.push(category);
          saveItems(KEYS.CATEGORIES, items);
          api.logs.add(userId, 'CREATE_CATEGORY', `ایجاد دسته‌بندی ${category.name}`);
          return category;
      },
      update: async (category: TransactionCategoryItem, userId: string) => {
          const items = getItems<TransactionCategoryItem>(KEYS.CATEGORIES);
          const idx = items.findIndex(c => c.id === category.id);
          if (idx > -1) {
              items[idx] = category;
              saveItems(KEYS.CATEGORIES, items);
              api.logs.add(userId, 'UPDATE_CATEGORY', `ویرایش دسته‌بندی ${category.name}`);
          }
      },
      delete: async (id: string, userId: string): Promise<'deleted' | 'soft_deleted'> => {
          await delay();
          let items = getItems<TransactionCategoryItem>(KEYS.CATEGORIES);
          const transactions = getItems<Transaction>(KEYS.TRANSACTIONS);
          // Recursively find children usage
          const childIds = items.filter(c => c.parentId === id).map(c => c.id);
          const allIdsToCheck = [id, ...childIds];
          
          const isUsed = transactions.some(t => t.categoryId && allIdsToCheck.includes(t.categoryId));
          
          const targetCat = items.find(c => c.id === id);
          if (!targetCat) return 'deleted';
          
          if (isUsed) {
              // Archive
              const idx = items.findIndex(c => c.id === id);
              if (idx > -1) {
                  items[idx].isActive = false; // Soft delete
                  // Also archive children
                  items.forEach(c => {
                      if(c.parentId === id) c.isActive = false;
                  });
              }
              saveItems(KEYS.CATEGORIES, items);
              api.logs.add(userId, 'SOFT_DELETE_CATEGORY', `غیرفعال‌سازی دسته‌بندی ${targetCat.name} (استفاده شده)`);
              return 'soft_deleted';
          } else {
              // Hard delete
              items = items.filter(c => c.id !== id && c.parentId !== id);
              saveItems(KEYS.CATEGORIES, items);
              api.logs.add(userId, 'DELETE_CATEGORY', `حذف کامل دسته‌بندی ${targetCat.name}`);
              return 'deleted';
          }
      }
  },
  transactions: {
    getAll: async () => { await delay(); return getItems<Transaction>(KEYS.TRANSACTIONS); },
    create: async (transaction: Transaction, userId: string) => {
      await delay();
      const items = getItems<Transaction>(KEYS.TRANSACTIONS);
      items.push(transaction);
      saveItems(KEYS.TRANSACTIONS, items);
      api.logs.add(userId, 'CREATE_TRANSACTION', `تراکنش ${transaction.type} مبلغ ${transaction.amount}`);
      await LedgerSnapshotService.markDirty(transaction);
      return transaction;
    },
    update: async (transaction: Transaction) => {
        await delay();
        const items = getItems<Transaction>(KEYS.TRANSACTIONS);
        const idx = items.findIndex(t => t.id === transaction.id);
        if (idx > -1) {
            items[idx] = transaction;
            saveItems(KEYS.TRANSACTIONS, items);
            await LedgerSnapshotService.markDirty(transaction);
        }
        return transaction;
    },
    delete: async (id: string, userId: string) => {
       await delay();
       let items = getItems<Transaction>(KEYS.TRANSACTIONS);
       const transaction = items.find(t => t.id === id);
       if (transaction) {
           items = items.filter(t => t.id !== id);
           saveItems(KEYS.TRANSACTIONS, items);
           api.logs.add(userId, 'DELETE_TRANSACTION', `حذف تراکنش`);
           await LedgerSnapshotService.markDirty(transaction);
       }
    }
  },
  tasks: {
      getAll: async () => { await delay(); return getItems<Task>(KEYS.TASKS); },
      create: async (task: Task) => {
          await delay();
          const items = getItems<Task>(KEYS.TASKS);
          items.push(task);
          saveItems(KEYS.TASKS, items);
          if(task.assignedTo) {
              createNotificationInternal(task.assignedTo, 'Task', 'تسک جدید', `تسک "${task.title}" به شما اختصاص یافت.`, '/dashboard', task.id);
          }
          return task;
      },
      update: async (task: Task) => {
          const items = getItems<Task>(KEYS.TASKS);
          const idx = items.findIndex(t => t.id === task.id);
          if(idx > -1) {
              const oldTask = items[idx];
              items[idx] = task;
              saveItems(KEYS.TASKS, items);
              if (!oldTask.isDone && task.isDone && task.assignedTo) {
                  createNotificationInternal(task.assignedTo, 'Task', 'تسک انجام شد', `تسک "${task.title}" با موفقیت تکمیل شد.`, '/dashboard', task.id);
              }
          }
      },
      delete: async (id: string, userId: string) => {
          await delay();
          let items = getItems<Task>(KEYS.TASKS);
          const task = items.find(t => t.id === id);
          if (task) {
             items = items.filter(t => t.id !== id);
             saveItems(KEYS.TASKS, items);
             api.logs.add(userId, 'DELETE_TASK', `حذف تسک: ${task.title}`);
          }
      }
  },
  messages: {
      getThreads: async () => getItems<ChatThread>(KEYS.THREADS),
      getMessages: async (threadId: string) => getItems<Message>(KEYS.MESSAGES).filter(m => m.threadId === threadId),
      getUnreadMessagesCount: async (userId: string) => {
          const threads = getItems<ChatThread>(KEYS.THREADS).filter(t => t.participants.includes(userId));
          const threadIds = threads.map(t => t.id);
          const messages = getItems<Message>(KEYS.MESSAGES);
          return messages.filter(m => threadIds.includes(m.threadId) && m.senderId !== userId && !m.isSeen).length;
      },
      createThread: async (thread: ChatThread) => {
          const items = getItems<ChatThread>(KEYS.THREADS);
          items.push(thread);
          saveItems(KEYS.THREADS, items);
          return thread;
      },
      sendMessage: async (msg: Message) => {
          const items = getItems<Message>(KEYS.MESSAGES);
          items.push(msg);
          saveItems(KEYS.MESSAGES, items);
          const threads = getItems<ChatThread>(KEYS.THREADS);
          const tIdx = threads.findIndex(t => t.id === msg.threadId);
          if(tIdx > -1) {
              const thread = threads[tIdx];
              thread.lastMessage = msg.content;
              thread.updatedAt = msg.createdAt;
              saveItems(KEYS.THREADS, threads);
              const users = getItems<User>(KEYS.USERS);
              const sender = users.find(u => u.id === msg.senderId);
              const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'کاربر ناشناس';
              const isGroup = thread.type === 'group' || thread.type === 'broadcast';
              const title = isGroup ? 'پیام گروهی جدید' : 'پیام خصوصی جدید';
              const contentPreview = msg.content.length > 30 ? msg.content.substring(0, 30) + '...' : msg.content;
              thread.participants.forEach(pId => {
                  if (pId !== msg.senderId) {
                      createNotificationInternal(
                          pId, 
                          'Message', 
                          title, 
                          `از طرف ${senderName}: ${contentPreview}`, 
                          '/messages', 
                          msg.threadId
                      );
                  }
              });
              window.dispatchEvent(new Event('messagesUpdated'));
          }
          return msg;
      },
      markThreadAsRead: async (threadId: string, userId: string) => {
          const messages = getItems<Message>(KEYS.MESSAGES);
          let changed = false;
          messages.forEach(m => {
              if (m.threadId === threadId && m.senderId !== userId && !m.isSeen) {
                  m.isSeen = true;
                  changed = true;
              }
          });
          if (changed) {
              saveItems(KEYS.MESSAGES, messages);
              window.dispatchEvent(new Event('messagesUpdated'));
          }
      },
      deleteThread: async (id: string, userId: string) => {
          await delay();
          let items = getItems<ChatThread>(KEYS.THREADS);
          const thread = items.find(t => t.id === id);
          if (thread) {
              items = items.filter(t => t.id !== id);
              saveItems(KEYS.THREADS, items);
              api.logs.add(userId, 'DELETE_THREAD', `حذف گفتگو ${thread.name || id}`);
          }
      }
  },
  notifications: {
      getAll: async (userId: string) => {
          await delay();
          let items = getItems<Notification>(KEYS.NOTIFICATIONS);
          const now = new Date();
          const validItems = items.filter(n => {
              if (n.userId !== userId) return false;
              if (n.expiryDate && new Date(n.expiryDate) < now) return false;
              return true;
          });
          return validItems.reverse();
      },
      create: async (notification: Notification) => {
          createNotificationInternal(
              notification.userId, 
              notification.type, 
              notification.title, 
              notification.message, 
              notification.link, 
              notification.relatedId,
              notification.priority,
              notification.isManagerial,
              notification.expiryDate,
              notification.batchId
          );
      },
      createBroadcast: async (broadcast: ManagerialBroadcast, recipientIds: string[]) => {
          const broadcasts = getItems<ManagerialBroadcast>(KEYS.BROADCASTS);
          broadcasts.push({
              ...broadcast,
              recipientCount: recipientIds.length
          });
          saveItems(KEYS.BROADCASTS, broadcasts);
          for (const userId of recipientIds) {
              createNotificationInternal(
                  userId,
                  'Managerial',
                  broadcast.title,
                  broadcast.message,
                  undefined, 
                  undefined,
                  broadcast.priority,
                  true, 
                  broadcast.expiryDate,
                  broadcast.id
              );
          }
          api.logs.add(broadcast.adminId, 'SEND_BROADCAST', `ارسال اعلان مدیریتی: ${broadcast.title}`);
      },
      getBroadcasts: async () => {
          await delay();
          return getItems<ManagerialBroadcast>(KEYS.BROADCASTS).reverse();
      },
      getBroadcastStats: async (batchId: string) => {
          await delay();
          const allNotifications = getItems<Notification>(KEYS.NOTIFICATIONS);
          const related = allNotifications.filter(n => n.batchId === batchId);
          const total = related.length;
          const seen = related.filter(n => n.isRead).length;
          const readers = related.filter(n => n.isRead).map(n => n.userId); 
          return { total, seen, readers };
      },
      markAsRead: async (id: string, userId: string) => {
          const items = getItems<Notification>(KEYS.NOTIFICATIONS);
          const idx = items.findIndex(n => n.id === id && n.userId === userId);
          if(idx > -1) {
              items[idx].isRead = true;
              saveItems(KEYS.NOTIFICATIONS, items);
              window.dispatchEvent(new Event('notificationUpdated'));
          }
      },
      markAllAsRead: async (userId: string) => {
          const items = getItems<Notification>(KEYS.NOTIFICATIONS);
          let changed = false;
          items.forEach(n => {
              if (n.userId === userId && !n.isRead) {
                  n.isRead = true;
                  changed = true;
              }
          });
          if(changed) {
              saveItems(KEYS.NOTIFICATIONS, items);
              window.dispatchEvent(new Event('notificationUpdated'));
          }
      }
  },
  logs: {
    getAll: async () => { await delay(); return getItems<Log>(KEYS.LOGS).reverse(); },
    add: (userId: string, action: string, details: string) => {
      const items = getItems<Log>(KEYS.LOGS);
      items.push({
        id: generateId(),
        userId,
        action,
        details,
        timestamp: new Date().toISOString()
      });
      saveItems(KEYS.LOGS, items);
    }
  }
};
