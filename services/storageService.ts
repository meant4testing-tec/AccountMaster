import { Transaction, TransactionType } from '../types';
import { STORAGE_KEY, INITIAL_BALANCE_KEY } from '../constants';

export const getTransactions = (): Transaction[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load transactions", e);
    return [];
  }
};

export const saveTransaction = (transaction: Transaction): Transaction[] => {
  const current = getTransactions();
  const updated = [...current, transaction];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const updateTransaction = (transaction: Transaction): Transaction[] => {
  const current = getTransactions();
  const updated = current.map(t => t.id === transaction.id ? transaction : t);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteTransaction = (id: string): Transaction[] => {
  const current = getTransactions();
  // Robust comparison: Convert both to strings to ensure match regardless of stored type
  const updated = current.filter(t => String(t.id) !== String(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const getInitialBalance = (): number => {
  try {
    const data = localStorage.getItem(INITIAL_BALANCE_KEY);
    return data ? parseFloat(data) : 0;
  } catch (e) {
    return 0;
  }
};

export const saveInitialBalance = (amount: number): number => {
  localStorage.setItem(INITIAL_BALANCE_KEY, amount.toString());
  return amount;
};

export const calculateSummary = (
  transactions: Transaction[],
  startDate: string,
  endDate: string,
  manualInitialBalance: number = 0
): { summary: any, filtered: Transaction[] } => {
  
  // Sort all transactions by date/time first
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.timestamp - b.timestamp;
  });

  // Start with the manual initial set by user (C/F from previous history outside app)
  let openingBalance = manualInitialBalance;
  
  let periodReceipts = 0;
  let periodExpenditures = 0;
  const filtered: Transaction[] = [];

  for (const t of sorted) {
    if (t.date < startDate) {
      // Affects opening balance logic: Add previous receipts, subtract previous expenses
      if (t.type === TransactionType.RECEIPT) {
        openingBalance += t.amount;
      } else {
        openingBalance -= t.amount;
      }
    } else if (t.date >= startDate && t.date <= endDate) {
      // In current period
      filtered.push(t);
      if (t.type === TransactionType.RECEIPT) {
        periodReceipts += t.amount;
      } else {
        periodExpenditures += t.amount;
      }
    }
  }

  const closingBalance = openingBalance + periodReceipts - periodExpenditures;

  return {
    filtered,
    summary: {
      openingBalance,
      totalReceipts: periodReceipts,
      totalExpenditures: periodExpenditures,
      closingBalance
    }
  };
};