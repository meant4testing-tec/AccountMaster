import React, { useState, useEffect } from 'react';
import { TransactionForm } from './components/TransactionForm';
import { ReportView } from './components/ReportView';
import { getTransactions, saveTransaction } from './services/storageService';
import { Transaction, TransactionType } from './types';
import { PieChart, PlusCircle, History } from 'lucide-react';
import { CURRENCY_SYMBOL } from './constants';

function App() {
  const [view, setView] = useState<'home' | 'report'>('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    setTransactions(getTransactions());
  }, []);

  const handleSaveTransaction = (t: Transaction) => {
    const updated = saveTransaction(t);
    setTransactions(updated);
    showNotification(`Saved ${t.type === 'RECEIPT' ? 'Receipt' : 'Expenditure'} of ${CURRENCY_SYMBOL}${t.amount}`);
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 relative">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm no-print">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg">
              AM
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">Account Master</span>
          </div>
          <nav className="flex space-x-1">
            <button 
              onClick={() => setView('home')}
              className={`p-2 rounded-lg transition-all ${view === 'home' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <PlusCircle className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setView('report')}
              className={`p-2 rounded-lg transition-all ${view === 'report' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <PieChart className="w-6 h-6" />
            </button>
          </nav>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-4 left-4 md:left-auto md:w-auto z-50 animate-bounce no-print">
           <div className="bg-slate-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-center text-sm font-medium">
             {notification}
           </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        {view === 'home' && (
          <div className="max-w-3xl mx-auto space-y-8 fade-in">
            <div className="text-center space-y-2 mb-8">
               <h1 className="text-3xl font-bold text-slate-900">New Transaction</h1>
               <p className="text-slate-500">Record your income or expenses to track your wealth.</p>
            </div>
            
            <TransactionForm onSave={handleSaveTransaction} />

            {/* Recent Mini List */}
            <div className="mt-10">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold text-slate-700 flex items-center">
                   <History className="w-4 h-4 mr-2" /> Recent Activity
                 </h3>
                 <button onClick={() => setView('report')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
               </div>
               
               <div className="space-y-3">
                  {transactions.slice(-3).reverse().map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                       <div>
                          <div className="font-bold text-slate-800">{t.purpose}</div>
                          <div className="text-xs text-slate-400">{t.date} • {t.party}</div>
                       </div>
                       <div className={`font-bold ${t.type === TransactionType.RECEIPT ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === TransactionType.RECEIPT ? '+' : '-'} {CURRENCY_SYMBOL}{t.amount}
                       </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
                      No recent transactions. Start adding!
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {view === 'report' && (
          <ReportView 
            transactions={transactions} 
            onBack={() => setView('home')} 
          />
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-slate-200 p-2 text-center text-[10px] text-slate-400 z-40 no-print">
         Designed & Developed by Subrata
      </footer>
    </div>
  );
}

export default App;