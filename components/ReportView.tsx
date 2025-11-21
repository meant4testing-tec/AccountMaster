
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, ReportSummary, PageData } from '../types';
import { calculateSummary, getInitialBalance, saveInitialBalance } from '../services/storageService';
import { downloadExcel } from '../services/excelService';
import { Button } from './ui/Button';
import { FileText, Download, ArrowLeft, Wallet, PenLine, Save, X, Loader2, Trash2, Pencil, Search, AlertTriangle, Printer } from 'lucide-react';
import { ITEMS_PER_PAGE } from '../constants';

// Declare html2pdf globally
declare var html2pdf: any;

interface ReportViewProps {
  transactions: Transaction[];
  onBack: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ 
  transactions, 
  onBack,
  onEditTransaction,
  onDeleteTransaction
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [receipts, setReceipts] = useState<Transaction[]>([]);
  const [expenditures, setExpenditures] = useState<Transaction[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Initial Balance State
  const [initialBalance, setInitialBalance] = useState(0);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState('0');

  // Delete Modal State
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary] = useState<ReportSummary>({
    openingBalance: 0,
    totalReceipts: 0,
    totalExpenditures: 0,
    closingBalance: 0
  });

  // Load initial balance on mount
  useEffect(() => {
    const bal = getInitialBalance();
    setInitialBalance(bal);
    setTempBalance(bal.toString());

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const result = calculateSummary(transactions, startDate, endDate, initialBalance);
      
      let filteredAll = result.filtered;
      let currentSummary = { ...result.summary };

      // Apply Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filteredAll = filteredAll.filter(t => 
          (t.particulars || '').toLowerCase().includes(q) ||
          t.party.toLowerCase().includes(q) ||
          t.amount.toString().includes(q) || 
          t.date.includes(q)
        );

        // Recalculate totals for the visible (searched) items
        const filteredReceiptsTotal = filteredAll
            .filter(t => t.type === TransactionType.RECEIPT)
            .reduce((sum, t) => sum + t.amount, 0);
            
        const filteredExpendituresTotal = filteredAll
            .filter(t => t.type === TransactionType.EXPENDITURE)
            .reduce((sum, t) => sum + t.amount, 0);
            
        currentSummary.totalReceipts = filteredReceiptsTotal;
        currentSummary.totalExpenditures = filteredExpendituresTotal;
      }
      
      // Split filtered data
      setReceipts(filteredAll.filter(t => t.type === TransactionType.RECEIPT));
      setExpenditures(filteredAll.filter(t => t.type === TransactionType.EXPENDITURE));
      
      setSummary(currentSummary);
    }
  }, [startDate, endDate, transactions, initialBalance, searchQuery]);

  // --- PAGINATION LOGIC FOR PDF ---
  const preparePagedData = (): PageData[] => {
    const pages: PageData[] = [];
    const maxItems = ITEMS_PER_PAGE;
    
    // Determine total pages needed
    const totalItems = Math.max(receipts.length, expenditures.length);
    const totalPages = Math.max(1, Math.ceil(totalItems / maxItems));
    
    let currentRunningBalance = summary.openingBalance;

    for (let i = 0; i < totalPages; i++) {
      const startIdx = i * maxItems;
      const endIdx = startIdx + maxItems;
      
      // Get slice for this page
      const pageReceiptsRaw = receipts.slice(startIdx, endIdx);
      const pageExpendituresRaw = expenditures.slice(startIdx, endIdx);

      // Calculate Page Specific Totals
      const pageTotalReceipts = pageReceiptsRaw.reduce((sum, t) => sum + t.amount, 0);
      const pageTotalExpenditures = pageExpendituresRaw.reduce((sum, t) => sum + t.amount, 0);

      // Pad arrays with nulls to ensure alignment if one side is shorter
      const paddedReceipts = [...pageReceiptsRaw];
      const paddedExpenditures = [...pageExpendituresRaw];
      
      while (paddedReceipts.length < maxItems) paddedReceipts.push(null);
      while (paddedExpenditures.length < maxItems) paddedExpenditures.push(null);

      // Calculate Closing Balance for this page (to be C/F)
      const closingBalanceCF = currentRunningBalance + pageTotalReceipts - pageTotalExpenditures;

      pages.push({
        pageNumber: i + 1,
        totalPages,
        receipts: paddedReceipts,
        expenditures: paddedExpenditures,
        openingBalanceBF: currentRunningBalance,
        pageTotalReceipts,
        pageTotalExpenditures,
        closingBalanceCF
      });

      // Update running balance for next iteration (next page's B/F)
      currentRunningBalance = closingBalanceCF;
    }

    return pages;
  };

  const generateHTML = (pages: PageData[]) => {
    let htmlContent = `
      <style>
        /* Reset defaults */
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { background: white; }
        
        /* 
           PDF GEOMETRY CONTROL: STANDARD A4 PIXELS
           A4 Landscape @ 96DPI is approx 1123px x 794px.
           We match this exactly to prevent cutoff or shifting.
        */
        .pdf-page {
          width: 1122px; 
          height: 750px; /* Slightly less than 794px to leave bottom buffer and prevent blank pages */
          padding: 40px 50px; /* Internal margins: 40px Top/Bottom, 50px Left/Right */
          background-color: #ffffff;
          font-family: sans-serif;
          position: relative;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
          page-break-after: always; 
          overflow: hidden;
        }

        /* Do not break after the last page */
        .pdf-page:last-child {
          page-break-after: avoid;
        }
        
        .header { text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 10px; width: 100%; position: relative; }
        .title { font-size: 28px; font-weight: 900; color: #312e81; text-transform: uppercase; letter-spacing: 1px; }
        .subtitle { font-size: 14px; color: #64748b; font-weight: 600; margin-top: 5px; }
        
        .grid-container { display: flex; width: 100%; border: 2px solid #cbd5e1; flex-grow: 1; }
        .col-half { width: 50%; display: flex; flex-direction: column; }
        .border-right { border-right: 2px solid #cbd5e1; }
        
        .section-head { padding: 10px; text-align: center; font-size: 16px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
        .bg-green { background-color: #d1fae5 !important; color: #065f46 !important; }
        .bg-red { background-color: #ffe4e6 !important; color: #9f1239 !important; }
        
        .balance-row { background-color: #f1f5f9 !important; font-weight: 700; font-size: 12px; display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #334155; }
        
        .tbl-header { display: flex; background: #f8fafc !important; font-size: 12px; font-weight: 800; color: #475569; padding: 8px 5px; border-bottom: 1px solid #94a3b8; }
        
        .tbl-row { display: flex; font-size: 12px; padding: 6px 5px; border-bottom: 1px solid #e2e8f0; align-items: flex-start; min-height: 32px; }
        
        .cell { padding: 0 4px; white-space: normal; word-wrap: break-word; overflow: hidden; line-height: 1.4; }
        
        /* COLUMN CONFIG UPDATED: Date expanded to prevent wrapping */
        .w-date { width: 15%; white-space: nowrap; } /* Increased from 12% and forced nowrap */
        .w-party { width: 27%; font-weight: 600; color: #1e293b; } /* Decreased from 28% */
        .w-part { width: 38%; color: #475569; } /* Decreased from 40% */
        .w-amt { width: 20%; text-align: right; font-weight: 700; }
        
        .footer-totals { margin-top: auto; border: 2px solid #cbd5e1; border-top: none; width: 100%; }
        .footer-row { display: flex; font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        .total-label { font-weight: 800; text-transform: uppercase; color: #1e293b; }
        
        /* New Placement for Powered By Edutor */
        .powered-by { position: absolute; top: 20px; left: 40px; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .page-no { position: absolute; top: 45px; right: 60px; font-size: 11px; color: #64748b; font-weight: 600; }
        
        .txt-green { color: #059669 !important; }
        .txt-red { color: #e11d48 !important; }
        
        @media print {
          body { background: none; }
          .pdf-page { break-after: page; box-shadow: none; margin: 0; width: 1122px; height: 794px; }
        }
      </style>
    `;

    pages.forEach(page => {
      // ORDER: Date, Recv From/Paid To, Particulars, Amount
      const receiptsRows = page.receipts.map(t => t ? `
        <div class="tbl-row">
          <div class="cell w-date">${t.date}</div>
          <div class="cell w-party">${t.party}</div>
          <div class="cell w-part">${t.particulars || '-'}</div>
          <div class="cell w-amt txt-green">${formatCurrency(t.amount)}</div>
        </div>
      ` : `<div class="tbl-row"><div class="cell" style="height:20px">&nbsp;</div></div>`).join('');

      const expRows = page.expenditures.map(t => t ? `
        <div class="tbl-row">
          <div class="cell w-date">${t.date}</div>
          <div class="cell w-party">${t.party}</div>
          <div class="cell w-part">${t.particulars || '-'}</div>
          <div class="cell w-amt txt-red">${formatCurrency(t.amount)}</div>
        </div>
      ` : `<div class="tbl-row"><div class="cell" style="height:20px">&nbsp;</div></div>`).join('');

      // Calculations for Footer Logic
      const leftGrandTotal = page.openingBalanceBF + page.pageTotalReceipts;
      const rightGrandTotal = page.pageTotalExpenditures + page.closingBalanceCF;

      htmlContent += `
        <div class="pdf-page">
          <div class="powered-by">Powered by Edutor</div>
          <div class="page-no">Page ${page.pageNumber} of ${page.totalPages}</div>
          <div class="header">
            <h1 class="title">Account Master Report</h1>
            <div class="subtitle">Period: ${startDate} to ${endDate} ${searchQuery ? `(Filtered: "${searchQuery}")` : ''}</div>
          </div>
          <div class="grid-container">
            <div class="col-half border-right">
              <div class="section-head bg-green">Credit (Receipts)</div>
              <div class="balance-row">
                <span>Brought Forward (B/F)</span>
                <span>${formatCurrency(page.openingBalanceBF)}</span>
              </div>
              <div class="tbl-header">
                <div class="cell w-date">Date</div>
                <div class="cell w-party">Recv. From</div>
                <div class="cell w-part">Particulars</div>
                <div class="cell w-amt">Amount</div>
              </div>
              ${receiptsRows}
            </div>
            <div class="col-half">
              <div class="section-head bg-red">Debit (Expenditure)</div>
              <div class="balance-row"><span>&nbsp;</span><span>&nbsp;</span></div>
              <div class="tbl-header">
                <div class="cell w-date">Date</div>
                <div class="cell w-party">Paid To</div>
                <div class="cell w-part">Particulars</div>
                <div class="cell w-amt">Amount</div>
              </div>
              ${expRows}
            </div>
          </div>
          <div class="footer-totals">
            <!-- Row 1: Page Totals -->
            <div class="footer-row" style="background: #f8fafc !important;">
              <div style="width:50%; display:flex; justify-content:space-between; padding-right:10px; border-right:2px solid #cbd5e1">
                 <span class="total-label">Page Total Receipts</span>
                 <span class="font-bold txt-green">${formatCurrency(page.pageTotalReceipts)}</span>
              </div>
              <div style="width:50%; display:flex; justify-content:space-between; padding-left:10px;">
                 <span class="total-label">Page Total Expenditure</span>
                 <span class="font-bold txt-red">${formatCurrency(page.pageTotalExpenditures)}</span>
              </div>
            </div>
            
            <!-- Row 2: Intermediate Totals (B/F + Page) & C/F -->
            <div class="footer-row" style="background: #fff !important; border-bottom: none; padding-top: 4px; padding-bottom: 4px;">
               <div style="width:50%; display:flex; justify-content:space-between; padding-right:10px; border-right:2px solid #cbd5e1">
                 <span class="total-label" style="color: #64748b;">Total (B/F + PAGE)</span>
                 <span class="font-bold" style="color: #312e81;">${formatCurrency(leftGrandTotal)}</span>
               </div>
               <div style="width:50%; display:flex; justify-content:space-between; padding-left:10px;">
                 <span class="total-label" style="color: #64748b;">Carried Forward (C/F)</span>
                 <span class="font-bold" style="color: #312e81;">${formatCurrency(page.closingBalanceCF)}</span>
               </div>
            </div>

            <!-- Row 3: Grand Total (Balanced) -->
            <div class="footer-row" style="background: #f1f5f9 !important; border-top: 1px solid #cbd5e1; border-bottom:none;">
              <div style="width:50%; display:flex; justify-content:space-between; padding-right:10px; border-right:2px solid #cbd5e1">
                 <span class="total-label">Grand Total</span>
                 <span class="font-bold text-slate-800">${formatCurrency(leftGrandTotal)}</span>
              </div>
              <div style="width:50%; display:flex; justify-content:space-between; padding-left:10px;">
                 <span class="total-label">Grand Total</span>
                 <span class="font-bold text-slate-800">${formatCurrency(rightGrandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    return htmlContent;
  }

  const handleNativePrint = () => {
    const pages = preparePagedData();
    const content = generateHTML(pages);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print the report.");
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Account Master Report</title>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleDownloadPDF = async () => {
    if (typeof html2pdf === 'undefined') {
      alert("PDF Generator not ready. Please check internet connection.");
      return;
    }

    setIsGeneratingPdf(true);
    
    const pages = preparePagedData();
    const content = generateHTML(pages);
    
    // Viewport Takeover Strategy
    const containerId = 'pdf-viewport-takeover';
    let container = document.getElementById(containerId);
    if (container) container.remove();
    
    container = document.createElement('div');
    container.id = containerId;
    // Cover entire screen
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.zIndex = '99999';
    container.style.backgroundColor = '#525252';
    container.style.overflow = 'auto';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    
    // Inner Wrapper: EXACTLY A4 Width in Pixels
    const innerWrapper = document.createElement('div');
    innerWrapper.id = 'pdf-inner-wrapper';
    innerWrapper.style.width = '1122px'; 
    innerWrapper.style.minWidth = '1122px';
    innerWrapper.style.margin = '0 auto';
    innerWrapper.style.backgroundColor = 'white';
    innerWrapper.innerHTML = content;
    
    container.appendChild(innerWrapper);
    document.body.appendChild(container);
    
    const msg = document.createElement('div');
    msg.innerHTML = "Generating PDF... Please wait.";
    msg.style.position = 'fixed';
    msg.style.top = '20px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.background = 'rgba(0,0,0,0.8)';
    msg.style.color = 'white';
    msg.style.padding = '10px 20px';
    msg.style.borderRadius = '20px';
    msg.style.zIndex = '100000';
    msg.style.fontWeight = 'bold';
    document.body.appendChild(msg);

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // CSS-Controlled Geometry: 1:1 Pixel Mapping to A4
    // We use unit: 'px' and format: [1122, 794] which is A4 Landscape @ 96dpi.
    // Margins are 0 because we used CSS padding inside .pdf-page to create them.
    const opt = {
      margin: 0,
      filename: `AccountMaster_Report_${startDate}_${endDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        scrollY: 0,
        logging: false,
        width: 1122,
        windowWidth: 1122 
      },
      jsPDF: { unit: 'px', format: [1122, 794], orientation: 'landscape' }
    };

    try {
      await html2pdf().set(opt).from(innerWrapper).save();
    } catch (error) {
      console.error("PDF Error", error);
      alert("Error generating PDF. Try the 'Print' button instead.");
    } finally {
      if (document.body.contains(container)) document.body.removeChild(container);
      if (document.body.contains(msg)) document.body.removeChild(msg);
      setIsGeneratingPdf(false);
    }
  };

  const handleExcel = () => {
    downloadExcel([...receipts, ...expenditures], summary, { startDate, endDate });
  };

  const handleSaveInitialBalance = () => {
    const val = parseFloat(tempBalance);
    if (!isNaN(val)) {
      saveInitialBalance(val);
      setInitialBalance(val);
      setIsEditingBalance(false);
    }
  };

  const initiateDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    setDeleteConfirmationId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmationId) {
      onDeleteTransaction(deleteConfirmationId);
      setDeleteConfirmationId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmationId(null);
  };

  const handleEditClick = (t: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onEditTransaction(t);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const showBalancing = searchQuery.trim() === '';

  return (
    <div className="space-y-6 pb-24 relative">
      
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelDelete}></div>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 transform scale-100 transition-all">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
                <p className="text-slate-500 mt-1">Are you sure to delete this entry?</p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                >
                  Yes
                </button>
                <button 
                  onClick={cancelDelete}
                  className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-bold hover:bg-rose-600 active:scale-95 transition-all shadow-lg shadow-rose-200"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        <h2 className="text-2xl font-bold text-slate-800">Financial Report</h2>
        <div className="w-20"></div> 
      </div>

      {/* Controls Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 no-print space-y-4" data-html2canvas-ignore="true">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Search by particulars, party, amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
          />
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
            />
          </div>
        </div>

        {/* Initial Balance Config */}
        <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between border border-slate-200">
          <div className="flex items-center space-x-2 text-slate-700">
             <Wallet className="w-4 h-4 text-slate-400" />
             <span className="text-sm font-semibold">Initial Opening Balance (C/F)</span>
          </div>
          <div className="flex items-center space-x-2">
            {isEditingBalance ? (
              <>
                <input 
                  type="number" 
                  value={tempBalance}
                  onChange={(e) => setTempBalance(e.target.value)}
                  className="w-24 p-1 text-sm border rounded focus:ring-2 focus:ring-emerald-400 outline-none"
                />
                <button onClick={handleSaveInitialBalance} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"><Save className="w-4 h-4"/></button>
                <button onClick={() => setIsEditingBalance(false)} className="p-1 text-rose-500 hover:bg-rose-100 rounded"><X className="w-4 h-4"/></button>
              </>
            ) : (
              <>
                <span className="font-bold text-slate-800">{formatCurrency(initialBalance)}</span>
                <button onClick={() => setIsEditingBalance(true)} className="p-1 text-slate-400 hover:text-indigo-600"><PenLine className="w-3 h-3"/></button>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
           <Button 
            onClick={handleNativePrint} 
            variant="outline" 
            className="flex-1" 
            icon={<Printer className="w-4 h-4" />}
          >
            Print
          </Button>
          <Button 
            onClick={handleDownloadPDF} 
            variant="secondary" 
            className="flex-1" 
            disabled={isGeneratingPdf}
            icon={isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
          >
            {isGeneratingPdf ? 'Working...' : 'Save PDF'}
          </Button>
          <Button onClick={handleExcel} variant="success" className="flex-1" icon={<FileText className="w-4 h-4" />}>
            Excel
          </Button>
        </div>
      </div>

      {/* Main Report Content (Screen View) */}
      <div ref={reportRef} className="bg-white p-4 rounded-2xl shadow-none md:shadow-sm md:border border-slate-100 w-full">
        
        <div className="text-center mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-3xl font-bold text-indigo-900 uppercase tracking-wide">Account Master Report</h1>
            <p className="text-slate-500 mt-2 font-medium">Period: {startDate} to {endDate}</p>
            {searchQuery && <p className="text-indigo-500 text-xs mt-1 font-bold">Filtered by: "{searchQuery}"</p>}
            <p className="text-xs text-slate-400 mt-1">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          
          {/* RECEIPTS SECTION */}
          <div className="rounded-xl border-2 border-emerald-100 overflow-hidden flex flex-col h-full">
            <div className="bg-emerald-100 p-3 border-b border-emerald-200">
               <h3 className="text-center font-bold text-emerald-800 uppercase tracking-widest text-sm">Credit (Receipts)</h3>
            </div>
            
            {showBalancing && (
              <div className="bg-emerald-50/50 p-3 flex justify-between items-center border-b border-emerald-100 text-sm">
                <span className="font-semibold text-emerald-900">Opening Balance (B/F)</span>
                <span className="font-bold text-emerald-900">{formatCurrency(summary.openingBalance)}</span>
              </div>
            )}

            <div className="flex-grow overflow-x-auto">
              <table className="w-full min-w-[600px] text-[10px] text-left table-fixed">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="p-1 font-semibold w-[12%]">Date</th>
                    <th className="p-1 font-semibold w-[28%]">Recv. From</th>
                    <th className="p-1 font-semibold w-[30%]">Particulars</th>
                    <th className="p-1 font-semibold text-right w-[17%]">Amount</th>
                    <th className="p-1 font-semibold w-[13%] action-buttons text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {receipts.map(t => (
                    <tr key={t.id} className="hover:bg-emerald-50/30 odd:bg-white even:bg-slate-50/50">
                      <td className="p-1 text-slate-500 align-top">{t.date}</td>
                      <td className="p-1 text-slate-800 font-semibold align-top break-words">{t.party}</td>
                      <td className="p-1 text-slate-700 font-medium align-top break-words">{t.particulars || '-'}</td>
                      <td className="p-1 text-right font-bold text-emerald-600 align-top">{formatCurrency(t.amount)}</td>
                      <td className="p-1 text-right action-buttons align-top relative">
                        <div className="relative z-50 flex flex-row justify-center gap-2">
                          <button 
                            type="button"
                            onClick={(e) => handleEditClick(t, e)} 
                            className="p-3 bg-indigo-100 text-indigo-700 rounded-lg shadow-sm hover:bg-indigo-200 active:bg-indigo-300 transition-all duration-100 active:scale-95 cursor-pointer touch-manipulation touch-action-manipulation"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4 pointer-events-none"/>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => initiateDelete(t.id, e)} 
                            className="p-3 bg-rose-100 text-rose-700 rounded-lg shadow-sm hover:bg-rose-200 active:bg-rose-300 transition-all duration-100 active:scale-95 cursor-pointer touch-manipulation touch-action-manipulation"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 pointer-events-none"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {receipts.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400 text-xs italic">No receipts found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

             <div className="bg-emerald-100 p-3 flex justify-between items-center border-t border-emerald-200 mt-auto">
               <span className="font-bold text-emerald-900 text-xs uppercase">{searchQuery ? 'Filtered Total' : 'Total Receipts'}</span>
               <span className="font-bold text-emerald-900 text-sm">{formatCurrency(summary.totalReceipts)}</span>
            </div>

            {showBalancing && (
              <div className="bg-slate-800 p-3 flex justify-between items-center text-white border-t border-slate-700">
                <span className="font-bold text-xs uppercase">Grand Total</span>
                <span className="font-bold text-sm">{formatCurrency(summary.openingBalance + summary.totalReceipts)}</span>
              </div>
            )}
          </div>

          {/* EXPENDITURE SECTION */}
          <div className="rounded-xl border-2 border-rose-100 overflow-hidden flex flex-col h-full">
            <div className="bg-rose-100 p-3 border-b border-rose-200">
               <h3 className="text-center font-bold text-rose-800 uppercase tracking-widest text-sm">Debit (Expenditure)</h3>
            </div>

            <div className="flex-grow overflow-x-auto">
              <table className="w-full min-w-[600px] text-[10px] text-left table-fixed">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="p-1 font-semibold w-[12%]">Date</th>
                    <th className="p-1 font-semibold w-[28%]">Paid To</th>
                    <th className="p-1 font-semibold w-[30%]">Particulars</th>
                    <th className="p-1 font-semibold text-right w-[17%]">Amount</th>
                    <th className="p-1 font-semibold w-[13%] action-buttons text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenditures.map(t => (
                    <tr key={t.id} className="hover:bg-rose-50/30 odd:bg-white even:bg-slate-50/50">
                      <td className="p-1 text-slate-500 align-top">{t.date}</td>
                      <td className="p-1 text-slate-800 font-semibold align-top break-words">{t.party}</td>
                      <td className="p-1 text-slate-700 font-medium align-top break-words">{t.particulars || '-'}</td>
                      <td className="p-1 text-right font-bold text-rose-600 align-top">{formatCurrency(t.amount)}</td>
                      <td className="p-1 text-right action-buttons align-top relative">
                         <div className="relative z-50 flex flex-row justify-center gap-2">
                          <button 
                            type="button"
                            onClick={(e) => handleEditClick(t, e)} 
                            className="p-3 bg-indigo-100 text-indigo-700 rounded-lg shadow-sm hover:bg-indigo-200 active:bg-indigo-300 transition-all duration-100 active:scale-95 cursor-pointer touch-manipulation touch-action-manipulation"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4 pointer-events-none"/>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => initiateDelete(t.id, e)} 
                            className="p-3 bg-rose-100 text-rose-700 rounded-lg shadow-sm hover:bg-rose-200 active:bg-rose-300 transition-all duration-100 active:scale-95 cursor-pointer touch-manipulation touch-action-manipulation"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 pointer-events-none"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                   {expenditures.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400 text-xs italic">No expenditures found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-rose-100 p-3 flex justify-between items-center border-t border-rose-200 mt-auto">
               <span className="font-bold text-rose-900 text-xs uppercase">{searchQuery ? 'Filtered Total' : 'Total Expenditure'}</span>
               <span className="font-bold text-rose-900 text-sm">{formatCurrency(summary.totalExpenditures)}</span>
            </div>

             {showBalancing && (
              <>
                <div className="bg-indigo-50 p-3 flex justify-between items-center border-t border-indigo-100">
                  <span className="font-bold text-indigo-900 text-xs uppercase">Closing Balance (C/F)</span>
                  <span className="font-bold text-indigo-700 text-sm">{formatCurrency(summary.closingBalance)}</span>
                </div>

                <div className="bg-slate-800 p-3 flex justify-between items-center text-white border-t border-slate-700">
                  <span className="font-bold text-xs uppercase">Grand Total</span>
                  <span className="font-bold text-sm">{formatCurrency(summary.totalExpenditures + summary.closingBalance)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="mt-8 text-center border-t border-slate-100 pt-4 text-[10px] text-slate-400">
          <p>Powered by Edutor</p>
        </div>
      </div>
    </div>
  );
}
