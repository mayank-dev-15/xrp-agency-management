import { Transaction, TransactionType, LedgerScopeType, LedgerSnapshot } from '../types';
import { api } from './db';

export interface LedgerFilters {
  dateRange?: { start: string; end: string };
  categoryId?: string;
  type?: 'income' | 'expense' | 'all';
}

export interface LedgerResult {
  totalIncomeConfirmed: number;
  totalExpenseConfirmed: number;
  netProfitConfirmed: number;
  breakdownByCategory: Record<string, number>;
  breakdownByProject: Record<string, number>;
  breakdownByTeamMember: Record<string, number>;
}

export const LedgerEngine = {
  async compute(scopeType: LedgerScopeType, scopeId: string, filters?: LedgerFilters): Promise<LedgerResult> {
    const allTransactions = await api.transactions.getAll();
    const allInvoices = await api.invoices.getAll();
    
    // Filter by scope
    let scopedTransactions = allTransactions.filter(t => t.status === 'Approved'); // Only FINAL_CONFIRMED
    
    if (scopeType === 'project') {
      scopedTransactions = scopedTransactions.filter(t => {
        if (t.projectId === scopeId) return true;
        if (t.invoiceId) {
          const inv = allInvoices.find(i => i.id === t.invoiceId);
          if (inv && inv.projectId === scopeId) return true;
        }
        return false;
      });
    } else if (scopeType === 'teamMember') {
      scopedTransactions = scopedTransactions.filter(t => t.payeeId === scopeId);
    } else if (scopeType === 'client') {
      scopedTransactions = scopedTransactions.filter(t => t.clientId === scopeId);
    }
    
    // Apply additional filters
    if (filters) {
      if (filters.type && filters.type !== 'all') {
        const tType = filters.type === 'income' ? TransactionType.Income : TransactionType.Expense;
        scopedTransactions = scopedTransactions.filter(t => t.type === tType);
      }
      if (filters.categoryId) {
        scopedTransactions = scopedTransactions.filter(t => t.categoryId === filters.categoryId);
      }
      if (filters.dateRange) {
        scopedTransactions = scopedTransactions.filter(t => t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end);
      }
    }

    const result: LedgerResult = {
      totalIncomeConfirmed: 0,
      totalExpenseConfirmed: 0,
      netProfitConfirmed: 0,
      breakdownByCategory: {},
      breakdownByProject: {},
      breakdownByTeamMember: {}
    };

    for (const t of scopedTransactions) {
      if (t.type === TransactionType.Income) {
        result.totalIncomeConfirmed += t.amount;
      } else if (t.type === TransactionType.Expense) {
        result.totalExpenseConfirmed += t.amount;
      }

      if (t.categoryId) {
        result.breakdownByCategory[t.categoryId] = (result.breakdownByCategory[t.categoryId] || 0) + t.amount;
      }
      if (t.projectId) {
        result.breakdownByProject[t.projectId] = (result.breakdownByProject[t.projectId] || 0) + t.amount;
      }
      if (t.payeeId) {
        result.breakdownByTeamMember[t.payeeId] = (result.breakdownByTeamMember[t.payeeId] || 0) + t.amount;
      }
    }

    result.netProfitConfirmed = result.totalIncomeConfirmed - result.totalExpenseConfirmed;

    return result;
  },
  
  generateChecksum(transactions: Transaction[]): string {
    const str = transactions
      .filter(t => t.status === 'Approved')
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(t => `${t.id}:${t.amount}:${t.status}`)
      .join('|');
      
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
};

const snapshotCache: Record<string, LedgerSnapshot> = {};

export const LedgerSnapshotService = {
  getSnapshotId(scopeType: LedgerScopeType, scopeId: string): string {
    return `${scopeType}_${scopeId}`;
  },

  async getSnapshot(scopeType: LedgerScopeType, scopeId: string): Promise<LedgerSnapshot> {
    const id = this.getSnapshotId(scopeType, scopeId);
    let snapshot = snapshotCache[id];
    
    if (!snapshot) {
      snapshot = await this.rebuild(scopeType, scopeId);
    }
    
    return snapshot;
  },

  async rebuild(scopeType: LedgerScopeType, scopeId: string): Promise<LedgerSnapshot> {
    const result = await LedgerEngine.compute(scopeType, scopeId);
    
    const allTransactions = await api.transactions.getAll();
    const allInvoices = await api.invoices.getAll();
    let scopedTransactions = allTransactions.filter(t => t.status === 'Approved');
    if (scopeType === 'project') {
      scopedTransactions = scopedTransactions.filter(t => {
        if (t.projectId === scopeId) return true;
        if (t.invoiceId) {
          const inv = allInvoices.find(i => i.id === t.invoiceId);
          if (inv && inv.projectId === scopeId) return true;
        }
        return false;
      });
    } else if (scopeType === 'teamMember') {
      scopedTransactions = scopedTransactions.filter(t => t.payeeId === scopeId);
    } else if (scopeType === 'client') {
      scopedTransactions = scopedTransactions.filter(t => t.clientId === scopeId);
    }
    
    const checksum = LedgerEngine.generateChecksum(scopedTransactions);
    
    const snapshot: LedgerSnapshot = {
      id: this.getSnapshotId(scopeType, scopeId),
      scopeType,
      scopeId,
      totalIncomeConfirmed: result.totalIncomeConfirmed,
      totalExpenseConfirmed: result.totalExpenseConfirmed,
      netProfitConfirmed: result.netProfitConfirmed,
      breakdownByCategory: result.breakdownByCategory,
      breakdownByProject: result.breakdownByProject,
      breakdownByTeamMember: result.breakdownByTeamMember,
      updatedAt: new Date().toISOString(),
      checksum
    };
    
    snapshotCache[snapshot.id] = snapshot;
    return snapshot;
  },

  async markDirty(transaction: Transaction) {
    const scopesToRebuild: { type: LedgerScopeType, id: string }[] = [
      { type: 'global', id: 'all' }
    ];
    
    if (transaction.projectId) {
      scopesToRebuild.push({ type: 'project', id: transaction.projectId });
    }
    if (transaction.payeeId) {
      scopesToRebuild.push({ type: 'teamMember', id: transaction.payeeId });
    }
    if (transaction.clientId) {
      scopesToRebuild.push({ type: 'client', id: transaction.clientId });
    }
    
    for (const scope of scopesToRebuild) {
      await this.rebuild(scope.type, scope.id);
    }
    
    // Dispatch event so UI can re-render
    window.dispatchEvent(new Event('ledgerUpdated'));
  }
};
