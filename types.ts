export enum TransactionType {
  RECEIPT = 'RECEIPT',
  EXPENDITURE = 'EXPENDITURE'
}

export interface Transaction {
  id: string;
  date: string; // ISO String YYYY-MM-DD
  type: TransactionType;
  purpose: string;
  labels: string;
  party: string; // 'Received From' or 'Paid To'
  amount: number;
  timestamp: number; // For sorting if dates are equal
}

export interface ReportSummary {
  openingBalance: number;
  totalReceipts: number;
  totalExpenditures: number;
  closingBalance: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}