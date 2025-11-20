import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, ReportSummary } from '../types';
import { calculateSummary, getInitialBalance, saveInitialBalance } from '../services/storageService';
import { downloadExcel } from '../services/excelService';
import { Button } from './ui/Button';
import { FileText, Download, ArrowLeft, Wallet, PenLine, Save, X, Loader2 } from 'lucide-react';
import { CURRENCY_SYMBOL } from '../constants';

// Declare html2pdf globally
declare var html2pdf: any;

interface ReportViewProps {
  transactions: Transaction[];
  onBack: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ transactions, onBack }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [receipts, setReceipts] = useState<Transaction[]>([]);
  const [expenditures, setExpenditures] = useState<Transaction[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Initial Balance State
  const [initialBalance, setInitialBalance] = useState(0);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState('0');

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
      
      // Split filtered data
      setReceipts(result.filtered.filter(t => t.type === TransactionType.RECEIPT));
      setExpenditures(result.filtered.filter(t => t.type === TransactionType.EXPENDITURE));
      
      setSummary(result.summary);
    }
  }, [startDate, endDate, transactions, initialBalance]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current || typeof html2pdf === 'undefined') {
      alert("PDF Generator not ready. Please wait or check internet connection.");
      return;
    }

    setIsGeneratingPdf(true);
    
    // --- ROBUST PDF GENERATION STRATEGY ---
    // We create a temporary container that overlays the entire screen.
    // This ensures the element is "visible" to the browser's rendering engine.
    
    const containerId = 'pdf-generation-container';
    let container = document.getElementById(containerId);
    if (container) document.body.removeChild(container);

    container = document.createElement('div');
    container.id = containerId;
    
    // Full screen white overlay with high z-index
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%', 
      zIndex: '10000',
      background: '#ffffff',
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '0'
    });

    // Create a wrapper with EXACT A4 Printable Width
    // A4 Landscape width = 297mm. 
    // Margins = 10mm each side. 
    // Printable width = 277mm.
    // In pixels (approx 96DPI): 277mm is ~1047px.
    // We use 1040px to be safe and ensure it fits perfectly centered between margins.
    const contentWidth = '1040px';

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      width: contentWidth, 
      minHeight: '700px',
      background: 'white',
      padding: '0', // No padding here, handled by margins in jsPDF
      margin: '0 auto' // Center in the overlay
    });

    // Clone the report
    const originalElement = reportRef.current;
    const clone = originalElement.cloneNode(true) as HTMLElement;
    
    // Force the clone to take full width of the wrapper
    clone.style.width = '100%';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    
    // Add specific print styles
    const style = document.createElement('style');
    style.innerHTML = `
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .grid-cols-1 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } /* Force 2 cols */
    `;
    wrapper.appendChild(style);
    wrapper.appendChild(clone);
    container.appendChild(wrapper);
    
    // Add a "Generating..." message
    const msg = document.createElement('div');
    msg.innerText = "Generating PDF Report...";
    Object.assign(msg.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '20px',
      borderRadius: '10px',
      zIndex: '10001',
      fontSize: '20px',
      fontWeight: 'bold'
    });
    document.body.appendChild(msg);
    document.body.appendChild(container);

    window.scrollTo(0, 0);

    // Wait a moment for the DOM to paint
    await new Promise(resolve => setTimeout(resolve, 800));

    const opt = {
      margin: 10, // 10mm margins on all sides. content (1040px) will sit in between.
      filename: `AccountMaster_Report_${startDate}_to_${endDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        scrollY: 0,
        windowWidth: 1040 // Match the wrapper width exactly to prevent shifting
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
      await html2pdf().set(opt).from(wrapper).save();
    } catch (error) {
      console.error("PDF Generation Failed", error);
      alert("Failed to generate PDF.");
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        <h2 className="text-2xl font-bold text-slate-800">Financial Report</h2>
        <div className="w-20"></div> {/* Spacer for center alignment */}
      </div>

      {/* Controls Section (Hidden in Print/PDF) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 no-print space-y-4" data-html2canvas-ignore="true">
        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
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
            onClick={handleDownloadPDF} 
            variant="secondary" 
            className="flex-1" 
            disabled={isGeneratingPdf}
            icon={isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
          >
            {isGeneratingPdf ? 'Wait...' : 'Download PDF'}
          </Button>
          <Button onClick={handleExcel} variant="success" className="flex-1" icon={<FileText className="w-4 h-4" />}>
            Export Excel
          </Button>
        </div>
      </div>

      {/* Main Report Content - Ref referenced for PDF Generation */}
      <div ref={reportRef} className="bg-white p-4 rounded-2xl shadow-none md:shadow-sm md:border border-slate-100 w-full">
        
        {/* Report Header */}
        <div className="text-center mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-3xl font-bold text-indigo-900 uppercase tracking-wide">Account Master Report</h1>
            <p className="text-slate-500 mt-2 font-medium">Period: {startDate} to {endDate}</p>
            <p className="text-xs text-slate-400 mt-1">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        {/* Main Side-by-Side Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          
          {/* RECEIPTS SECTION (LEFT / CREDIT LOGIC) */}
          <div className="rounded-xl border-2 border-emerald-100 overflow-hidden flex flex-col h-full">
            <div className="bg-emerald-100 p-3 border-b border-emerald-200">
               <h3 className="text-center font-bold text-emerald-800 uppercase tracking-widest text-sm">Credit (Receipts)</h3>
            </div>
            
            {/* Opening Balance Row */}
            <div className="bg-emerald-50/50 p-3 flex justify-between items-center border-b border-emerald-100 text-sm">
               <span className="font-semibold text-emerald-900">Opening Balance (B/F)</span>
               <span className="font-bold text-emerald-900">{formatCurrency(summary.openingBalance)}</span>
            </div>

            <div className="flex-grow">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="p-2 font-semibold w-16">Date</th>
                    <th className="p-2 font-semibold">Purpose</th>
                    <th className="p-2 font-semibold w-32">Received From</th>
                    <th className="p-2 font-semibold text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {receipts.map(t => (
                    <tr key={t.id} className="hover:bg-emerald-50/30 odd:bg-white even:bg-slate-50/50">
                      <td className="p-2 text-slate-500 whitespace-nowrap">{t.date}</td>
                      <td className="p-2">
                        <div className="text-slate-700 font-medium">{t.purpose}</div>
                        {t.labels && <div className="text-[10px] text-slate-400 bg-slate-100 inline-block px-1 rounded mt-1">{t.labels}</div>}
                      </td>
                      <td className="p-2 text-slate-600 font-medium break-words">{t.party}</td>
                      <td className="p-2 text-right font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                  {receipts.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-400 text-xs italic">No receipts found for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Receipts */}
             <div className="bg-emerald-100 p-3 flex justify-between items-center border-t border-emerald-200 mt-auto">
               <span className="font-bold text-emerald-900 text-xs uppercase">Total Receipts</span>
               <span className="font-bold text-emerald-900 text-sm">{formatCurrency(summary.totalReceipts)}</span>
            </div>

            {/* Grand Total Left */}
            <div className="bg-slate-800 p-3 flex justify-between items-center text-white border-t border-slate-700">
               <span className="font-bold text-xs uppercase">Grand Total</span>
               <span className="font-bold text-sm">{formatCurrency(summary.openingBalance + summary.totalReceipts)}</span>
            </div>
          </div>

          {/* EXPENDITURE SECTION (RIGHT / DEBIT LOGIC) */}
          <div className="rounded-xl border-2 border-rose-100 overflow-hidden flex flex-col h-full">
            <div className="bg-rose-100 p-3 border-b border-rose-200">
               <h3 className="text-center font-bold text-rose-800 uppercase tracking-widest text-sm">Debit (Expenditure)</h3>
            </div>

            <div className="flex-grow">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="p-2 font-semibold w-16">Date</th>
                    <th className="p-2 font-semibold">Purpose</th>
                    <th className="p-2 font-semibold w-32">Paid To</th>
                    <th className="p-2 font-semibold text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenditures.map(t => (
                    <tr key={t.id} className="hover:bg-rose-50/30 odd:bg-white even:bg-slate-50/50">
                      <td className="p-2 text-slate-500 whitespace-nowrap">{t.date}</td>
                      <td className="p-2">
                        <div className="text-slate-700 font-medium">{t.purpose}</div>
                        {t.labels && <div className="text-[10px] text-slate-400 bg-slate-100 inline-block px-1 rounded mt-1">{t.labels}</div>}
                      </td>
                      <td className="p-2 text-slate-600 font-medium break-words">{t.party}</td>
                      <td className="p-2 text-right font-bold text-rose-600 whitespace-nowrap">{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                   {expenditures.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-400 text-xs italic">No expenditures found for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Expenditures */}
            <div className="bg-rose-100 p-3 flex justify-between items-center border-t border-rose-200 mt-auto">
               <span className="font-bold text-rose-900 text-xs uppercase">Total Expenditure</span>
               <span className="font-bold text-rose-900 text-sm">{formatCurrency(summary.totalExpenditures)}</span>
            </div>

            {/* Closing Balance */}
             <div className="bg-indigo-50 p-3 flex justify-between items-center border-t border-indigo-100">
               <span className="font-bold text-indigo-900 text-xs uppercase">Closing Balance (C/F)</span>
               <span className="font-bold text-indigo-700 text-sm">{formatCurrency(summary.closingBalance)}</span>
            </div>

            {/* Grand Total Right */}
            <div className="bg-slate-800 p-3 flex justify-between items-center text-white border-t border-slate-700">
               <span className="font-bold text-xs uppercase">Grand Total</span>
               <span className="font-bold text-sm">{formatCurrency(summary.totalExpenditures + summary.closingBalance)}</span>
            </div>
          </div>
        </div>
        
        {/* PDF Footer within the generated area */}
        <div className="mt-8 text-center border-t border-slate-100 pt-4 text-[10px] text-slate-400">
          <p>Designed & Developed by Subrata</p>
        </div>
      </div>
    </div>
  );
};