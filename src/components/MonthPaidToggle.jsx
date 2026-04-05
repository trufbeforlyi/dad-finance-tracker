import { useState } from 'react';
import { currentMonthKey, getPaidMonths, isPaidThisMonth } from '../utils';

export default function MonthPaidToggle({ card, onToggle }) {
  const [showPicker, setShowPicker] = useState(false);
  const paid = isPaidThisMonth(card);
  const paidMonths = getPaidMonths(card);

  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`text-xs px-2 py-0.5 rounded-full transition-colors ${paid ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-dark-600 text-dark-400 hover:bg-dark-500'}`}
      >
        {paid ? '✓ Paid' : 'Mark Paid'}
      </button>
      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 bg-dark-700 border border-dark-600 rounded-lg shadow-xl p-2 min-w-[140px]">
            {months.map(m => {
              const isPaid = paidMonths.includes(m);
              const label = new Date(m + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              return (
                <button key={m} onClick={() => { onToggle(card, m); setShowPicker(false); }}
                  className={`block w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${isPaid ? 'text-green-400 bg-green-500/10' : 'text-dark-300 hover:bg-dark-600'}`}>
                  {isPaid ? '✓ ' : ''}{label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
