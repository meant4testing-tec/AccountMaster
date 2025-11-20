import React, { useState } from 'react';
import { TransactionType, Transaction } from '../types';
import { Button } from './ui/Button';
import { Plus, Calendar, Tag, User, FileText } from 'lucide-react';
import { CURRENCY_SYMBOL } from '../constants';

interface TransactionFormProps {
  onSave: (t: Transaction) => void;
  initialType?: TransactionType;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ onSave, initialType = TransactionType.RECEIPT }) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('');
  const [labels, setLabels] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !purpose || !party) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date,
      type,
      purpose,
      labels,
      party,
      amount: parseFloat(amount),
      timestamp: Date.now()
    };

    onSave(newTransaction);
    
    // Reset form
    setPurpose('');
    setAmount('');
    setParty('');
    setLabels('');
  };

  const isReceipt = type === TransactionType.RECEIPT;
  const themeColor = isReceipt ? "text-emerald-600" : "text-rose-600";
  const themeBg = isReceipt ? "bg-emerald-50" : "bg-rose-50";
  const themeBorder = isReceipt ? "focus:border-emerald-500 focus:ring-emerald-200" : "focus:border-rose-500 focus:ring-rose-200";

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="flex p-1 bg-slate-100 rounded-t-2xl">
        <button
          type="button"
          onClick={() => setType(TransactionType.RECEIPT)}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
            isReceipt ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'
          }`}
        >
          RECEIPT (IN)
        </button>
        <button
          type="button"
          onClick={() => setType(TransactionType.EXPENDITURE)}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
            !isReceipt ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'
          }`}
        >
          EXPENDITURE (OUT)
        </button>
      </div>

      <form onSubmit={handleSubmit} className={`p-6 space-y-5 ${themeBg}`}>
        
        <div className="space-y-1">
          <label className={`text-xs font-bold uppercase tracking-wider ${themeColor} flex items-center`}>
            <Calendar className="w-4 h-4 mr-1" /> Date
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
            <User className="w-4 h-4 mr-1" /> {isReceipt ? 'Received From' : 'Paid To'}
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
            <FileText className="w-4 h-4 mr-1" /> Purpose
          </label>
          <input
            type="text"
            required
            placeholder="Short description"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={`w-full p-3 rounded-xl border border-slate-200 bg-white ${themeBorder} outline-none transition-all`}
          />
        </div>

        <div className="space-y-1">
          <label className={`text-xs font-bold uppercase tracking-wider ${themeColor} flex items-center`}>
            <Tag className="w-4 h-4 mr-1" /> Labels
          </label>
          <input
            type="text"
            placeholder="e.g. Rent, Salary, Sales"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            className={`w-full p-3 rounded-xl border border-slate-200 bg-white ${themeBorder} outline-none transition-all`}
          />
        </div>

        <div className="space-y-1">
          <label className={`text-xs font-bold uppercase tracking-wider ${themeColor} flex items-center`}>
            <span className="mr-1">{CURRENCY_SYMBOL}</span> Amount
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

        <div className="pt-2">
          <Button 
            type="submit" 
            fullWidth 
            variant={isReceipt ? 'success' : 'danger'}
            icon={<Plus className="w-5 h-5" />}
          >
            Save {isReceipt ? 'Receipt' : 'Expenditure'}
          </Button>
        </div>
      </form>
    </div>
  );
};