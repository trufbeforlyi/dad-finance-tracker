import { useState, useRef, useEffect } from 'react';
import { getPayPeriods, savePayPeriods, generatePayPeriods } from '../store';
import { formatCurrency, formatDate, isPast } from '../utils';

function SetupForm({ onSetup }) {
  const [startDate, setStartDate] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!startDate || isNaN(amt) || amt <= 0) return;
    onSetup(startDate, amt);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="text-center py-8">
        <p className="text-5xl mb-4">💰</p>
        <h2 className="text-xl font-bold">Set Up Pay Periods</h2>
        <p className="text-sm text-[var(--text-muted)] mt-2 max-w-xs mx-auto">
          Enter your next pay date and typical pay amount. We'll generate a bi-weekly schedule for 5 years.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Next Pay Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full mt-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Pay Amount</label>
          <div className="relative mt-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border)] pl-10 pr-4 py-3 text-xl font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!startDate || !amount}
          className="w-full rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 py-3.5 font-semibold text-white active:scale-[0.98] transition-all"
        >
          Generate Schedule
        </button>
      </form>
    </div>
  );
}

function EditableAmount({ period, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(period.amount));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setValue(String(period.amount));
  }, [period.amount]);

  const handleSave = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      setValue(String(period.amount));
      setEditing(false);
      return;
    }
    onSave(period.id, num);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[var(--text-muted)]">$</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setValue(String(period.amount));
              setEditing(false);
            }
          }}
          onBlur={handleSave}
          className="w-24 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-2 py-1 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm font-semibold font-mono text-[var(--green)] active:opacity-70"
      title="Tap to edit"
    >
      {formatCurrency(period.amount)}
    </button>
  );
}

export default function PayPeriods() {
  const [filter, setFilter] = useState('upcoming');
  const periods = getPayPeriods();

  if (periods.length === 0) {
    return <SetupForm onSetup={(date, amt) => generatePayPeriods(date, amt)} />;
  }

  const today = new Date().toISOString().split('T')[0];
  const pastPeriods = periods.filter((p) => isPast(p.date));
  const futurePeriods = periods.filter((p) => !isPast(p.date));

  const totalEarned = pastPeriods.reduce((s, p) => s + p.amount, 0);
  const totalRemaining = futurePeriods.reduce((s, p) => s + p.amount, 0);

  let filtered;
  if (filter === 'upcoming') filtered = futurePeriods;
  else if (filter === 'past') filtered = pastPeriods;
  else filtered = periods;

  const handleAmountSave = (id, amount) => {
    const updated = periods.map((p) => (p.id === id ? { ...p, amount } : p));
    savePayPeriods(updated);
  };

  const handleReset = () => {
    if (confirm('Reset all pay periods? This cannot be undone.')) {
      savePayPeriods([]);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pay Periods</h1>
        <button
          onClick={handleReset}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--red)] px-3 py-1.5 rounded-lg border border-[var(--border)]"
        >
          Reset
        </button>
      </div>
      <p className="text-sm text-[var(--text-muted)]">Bi-weekly schedule · Tap amounts to edit</p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Earned</p>
          <p className="text-lg font-bold text-[var(--green)] mt-1">{formatCurrency(totalEarned)}</p>
          <p className="text-xs text-[var(--text-muted)]">{pastPeriods.length} periods</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Remaining</p>
          <p className="text-lg font-bold mt-1">{formatCurrency(totalRemaining)}</p>
          <p className="text-xs text-[var(--text-muted)]">{futurePeriods.length} periods</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex rounded-xl bg-[var(--bg-input)] p-1">
        {[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'past', label: 'Past' },
          { id: 'all', label: 'All' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === t.id
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        {filtered.length} period{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Period list */}
      <div className="space-y-2">
        {filtered.map((period) => {
          const past = isPast(period.date);
          const isNext = !past && period.date === futurePeriods[0]?.date;
          return (
            <div
              key={period.id}
              className={`flex items-center justify-between rounded-xl border bg-[var(--bg-card)] px-4 py-3 transition-all ${
                past ? 'opacity-50 border-[var(--border)]' : isNext ? 'border-[var(--green)]/40 ring-1 ring-[var(--green)]/20' : 'border-[var(--border)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
                    past ? 'bg-[var(--bg-input)] text-[var(--text-muted)]' : isNext ? 'bg-[var(--green)]/10 text-[var(--green)]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  {past ? '✓' : '💰'}
                </div>
                <div>
                  <p className="text-sm font-medium">{formatDate(period.date)}</p>
                  {isNext && (
                    <p className="text-[10px] font-semibold text-[var(--green)] uppercase tracking-wider">
                      Next Payday
                    </p>
                  )}
                </div>
              </div>
              <EditableAmount period={period} onSave={handleAmountSave} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
