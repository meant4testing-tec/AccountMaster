import { Transaction, TransactionType, ReportSummary } from '../types';
import { CURRENCY_SYMBOL } from '../constants';

// Global declaration for the loaded script
declare var XLSX: any;

export const downloadExcel = (
  transactions: Transaction[], 
  summary: ReportSummary,
  dateRange: { startDate: string, endDate: string }
) => {
  if (typeof XLSX === 'undefined') {
    alert('Excel library not loaded. Please check your internet connection.');
    return;
  }

  // Split data
  const receipts = transactions.filter(t => t.type === TransactionType.RECEIPT);
  const expenditures = transactions.filter(t => t.type === TransactionType.EXPENDITURE);

  // Sort both lists
  const sortFn = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date);
  receipts.sort(sortFn);
  expenditures.sort(sortFn);

  // Prepare Data for Side-by-Side Sheet
  const maxRows = Math.max(receipts.length, expenditures.length);
  const data = [];

  // Header info
  data.push({ 
    "CREDIT (Receipts)": `Report Period: ${dateRange.startDate} to ${dateRange.endDate}`,
    "DEBIT (Expenditure)": ""
  });
  data.push({}); // Spacer

  // Custom Header Row
  data.push({
    "C_Date": "Date",
    "C_Purpose": "Purpose",
    "C_Labels": "Labels",
    "C_Party": "Received From",
    "C_Amount": `Amount (${CURRENCY_SYMBOL})`,
    "SEP": "|",
    "D_Date": "Date",
    "D_Purpose": "Purpose",
    "D_Labels": "Labels",
    "D_Party": "Paid To",
    "D_Amount": `Amount (${CURRENCY_SYMBOL})`
  });
  
  for (let i = 0; i < maxRows; i++) {
    const r = receipts[i];
    const e = expenditures[i];

    data.push({
      "C_Date": r ? r.date : "",
      "C_Purpose": r ? r.purpose : "",
      "C_Labels": r ? r.labels : "",
      "C_Party": r ? r.party : "",
      "C_Amount": r ? r.amount : "",
      "SEP": "|",
      "D_Date": e ? e.date : "",
      "D_Purpose": e ? e.purpose : "",
      "D_Labels": e ? e.labels : "",
      "D_Party": e ? e.party : "",
      "D_Amount": e ? e.amount : ""
    });
  }

  // Add Totals
  data.push({});
  data.push({
    "C_Party": "Opening Balance (B/F):",
    "C_Amount": summary.openingBalance,
    "SEP": "|",
    "D_Party": "Total Expenditure:",
    "D_Amount": summary.totalExpenditures
  });
  data.push({
    "C_Party": "Total Receipts:",
    "C_Amount": summary.totalReceipts,
    "SEP": "|",
    "D_Party": "Closing Balance (C/F):",
    "D_Amount": summary.closingBalance
  });
  data.push({
    "C_Party": "GRAND TOTAL:",
    "C_Amount": summary.openingBalance + summary.totalReceipts,
    "SEP": "|",
    "D_Party": "GRAND TOTAL:",
    "D_Amount": summary.totalExpenditures + summary.closingBalance
  });


  // 3. Create Worksheet
  const ws = XLSX.utils.json_to_sheet(data, {skipHeader: true});

  // 4. Create Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Account Master Report");

  // 5. Save
  const fileName = `AccountMaster_Report_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};