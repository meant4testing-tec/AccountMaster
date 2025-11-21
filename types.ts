export enum TransactionType {
  RECEIPT = 'RECEIPT',
  EXPENDITURE = 'EXPENDITURE'
}

export interface Transaction {
  id: string;
  date: string; // ISO String YYYY-MM-DD
  type: TransactionType;
  particulars: string; // Main description field now
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

export interface PageData {
  pageNumber: number;
  totalPages: number;
  receipts: (Transaction | null)[]; // null used for padding empty rows
  expenditures: (Transaction | null)[];
  
  // Math for this specific page
  openingBalanceBF: number; // Brought Forward from previous page
  pageTotalReceipts: number;
  pageTotalExpenditures: number;
  closingBalanceCF: number; // Carried Forward to next page
}