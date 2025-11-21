import React, { useState, useEffect } from 'react';
import { TransactionType, Transaction } from '../types';
import { Button } from './ui/Button';
import { Plus, Calendar, User, Edit, FileEdit } from 'lucide-react';
import { CURRENCY_SYMBOL } from '../constants';

interface TransactionFormProps {
  onSave: (t: Transaction) => void;
  initialData?: Transaction | null;
  onCancelEdit?: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onSave, 
  initialData,
  onCancelEdit 
}) => {
  const [type, setType] = useState<TransactionType>(TransactionType.RECEIPT);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [particulars, setParticulars] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');

  // Load initial data if in Edit Mode
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setDate(initialData.date);
      setParticulars(initialData.particulars || '');
      setParty(initialData.party);
      setAmount(initialData.amount.toString());
    } else {
      // Reset to default if no initialData
      resetForm();
    }
  }, [initialData]);

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setParticulars('');
    setParty('');
    setAmount('');
    // Note: We don't reset Type, user might want to add multiple Receipts
  };

  const generateId = () => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only Date, Party, and Amount are mandatory
    if (!amount || !party || !date) return;

    const transaction: Transaction = {
      id: initialData ? initialData.id : generateId(),
      date,
      type,
      particulars,
      party,
      amount: parseFloat(amount),
      timestamp: initialData ? initialData.timestamp : Date.now()
    };

    onSave(transaction);
    
    if (!initialData) {
      resetForm();
    }
  };

  const isReceipt = type === TransactionType.RECEIPT;
  const themeColor = isReceipt ? "text-emerald-600" : "text-rose-600";
  const themeBg = isReceipt ? "bg-emerald-50" : "bg-rose-50";
  const themeBorder = isReceipt ? "focus:border-emerald-500 focus:ring-emerald-200" : "focus:border-rose-500 focus:ring-rose-200";

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
      <div className="flex p-1 bg-slate-100 rounded-t-2xl">
        <button
          type="button"
          onClick={() => setType(TransactionType.RECEIPT)}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
            isReceipt ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'
          }`}
          disabled={!!initialData} // Disable type switching in edit mode
        >
          RECEIPT (IN)
        </button>
        <button
          type="button"
          onClick={() => setType(TransactionType.EXPENDITURE)}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
            !isReceipt ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'
          }`}
          disabled={!!initialData} // Disable type switching in edit mode
        >
          EXPENDITURE (OUT)
        </button>
      </div>

      <form onSubmit={handleSubmit} className={`p-6 space-y-5 ${themeBg}`}>
        
        {initialData && (
          <div className="bg-indigo-100 text-indigo-800 p-2 rounded-lg text-center text-sm font-bold mb-4">
            EDITING MODE
          </div>
        )}

        <div className="space-y-1">
          <label className={`text-xs font-bold uppercase tracking-wider ${themeColor} flex items-center`}>
            <Calendar className="w-4 h-4 mr-1" /> Date <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`w-full p-3 rounded-xl border border-slate-200 bg-white ${themeBorder} outline-none transition-all`}
          />
        </div>

        <div className="space-y-1">
          <label className={`text-xs font-bold uppercase tracking-wider ${themeColor} flex items-center`}>
            <User className="w-4 h-4 mr-1" /> {isReceipt ? 'Received From' : 'Paid To'} <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            required
            placeholder={isReceipt ? "e.g. Client Name" : "e.g. Vendor Name"}
            value={party}
            onChange={(e) => setParty(e.target.value)}
            className={`w-full p-3 rounded-xl border border-slate-200 bg-white ${themeBorder} outline-none transition-all`}
          />
        </div>

        <div className="space-y-1">
          <label className={`text-xs font-bold uppercase tracking-wider ${themeColor} flex items-center`}>
            <span className="mr-1">{CURRENCY_SYMBOL}</span> Amount <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full p-3 pl-10 text-xl font-bold rounded-xl border border-slate-200 bg-white ${themeBorder} outline-none transition-all`}
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{CURRENCY_SYMBOL}</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className={`text-xs font-bold uppercase tracking-wider ${themeColor} flex items-center`}>
            <FileEdit className="w-4 h-4 mr-1" /> Particulars <span className="text-slate-400 text-[10px] lowercase ml-1">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="Details of item/service"
            value={particulars}
            onChange={(e) => setParticulars(e.target.value)}
            className={`w-full p-3 rounded-xl border border-slate-200 bg-white ${themeBorder} outline-none transition-all`}
          />
        </div>

        <div className="pt-2 flex gap-3">
          {initialData && onCancelEdit && (
            <Button 
              type="button" 
              variant="secondary"
              onClick={onCancelEdit}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            fullWidth={!initialData} 
            variant={isReceipt ? 'success' : 'danger'}
            icon={initialData ? <Edit className="w-5 h-5"/> : <Plus className="w-5 h-5" />}
            className={initialData ? "flex-1" : ""}
          >
            {initialData ? 'Update Transaction' : (isReceipt ? 'Save Receipt' : 'Save Expenditure')}
          </Button>
        </div>
      </form>
    </div>
  );
};