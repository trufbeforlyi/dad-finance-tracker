import { useState } from 'react';
import {
  getTransactions,
  getCategories,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '../store';
import { formatCurrency, formatDate, todayStr, getMonthRange } from '../utils';

function TransactionForm({ onSave, onCancel, initial = null }) {
  const categories = getCategories();
  const [type, setType] = useState(initial?.type || 'expense');
  const [amount, setAmount] = useState(initial?.amount?.toString() || '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || '');
  const [date, setDate] = useState(initial?.date || todayStr());
  const [note, setNote] = useState(initial?.note || '');

  const filteredCats = categories.filter((c) => c.type === type);

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !categoryId) return;
    onSave({ type, amount: amt, categoryId, date, note });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type toggle */}
      <div className="flex rounded-xl bg-[var(--bg-input)] p-1">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setCategoryId(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              type === t
                ? t === 'expense'
                  ? 'bg-[var(--red)] text-white'
                  : 'bg-[var(--green)] text-white'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {t === 'expense' ? '💸 Expense' : '💰 Income'}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Amount</label>
        <div className="relative mt-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border)] pl-10 pr-4 py-3.5 text-xl font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            autoFocus
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Category</label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {filteredCats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition-all border ${
                categoryId === cat.id
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="truncate">{cat.name}</span>
            </button>
          ))}
        </div>
        {filteredCats.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] mt-2 text-center py-4">
            No {type} categories yet. Add one in the Tags tab!
          </p>
        )}
      </div>

      {/* Date */}
      <div>
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mt-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Note */}
      <div>
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was this for?"
          className="w-full mt-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-[var(--border)] py-3.5 font-semibold text-[var(--text-secondary)] active:opacity-80"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!amount || !categoryId}
          className="flex-1 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 py-3.5 font-semibold text-white active:scale-[0.98] transition-all"
        >
          {initial ? 'Update' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default function Transactions() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterMonth, setFilterMonth] = useState(0);

  const txs = getTransactions();
  const categories = getCategories();
  const month = getMonthRange(filterMonth);

  const filtered = txs.filter((t) => t.date >= month.start && t.date <= month.end);
  const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const handleSave = (data) => {
    if (editing) {
      updateTransaction(editing.id, data);
    } else {
      addTransaction(data);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleEdit = (tx) => {
    setEditing(tx);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this transaction?')) {
      deleteTransaction(id);
    }
  };

  // Group by date
  const grouped = {};
  filtered.forEach((tx) => {
    if (!grouped[tx.date]) grouped[tx.date] = [];
    grouped[tx.date].push(tx);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (showForm) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">{editing ? 'Edit Transaction' : 'Add Transaction'}</h2>
        <TransactionForm
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          initial={editing}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition-all"
        >
          + Add
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between rounded-xl bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3">
        <button
          onClick={() => setFilterMonth((m) => m - 1)}
          className="text-2xl text-[var(--text-muted)] active:text-[var(--text-primary)] px-2"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-semibold">{month.label}</p>
          <p className="text-xs text-[var(--text-muted)]">
            In: {formatCurrency(income)} · Out: {formatCurrency(expenses)}
          </p>
        </div>
        <button
          onClick={() => setFilterMonth((m) => m + 1)}
          className="text-2xl text-[var(--text-muted)] active:text-[var(--text-primary)] px-2"
        >
          ›
        </button>
      </div>

      {/* Transaction list */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-semibold">No transactions this month</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Tap + Add to log your first one</p>
        </div>
      ) : (
        sortedDates.map((date) => (
          <div key={date}>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium mb-2 px-1">
              {formatDate(date)}
            </p>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden divide-y divide-[var(--border)]">
              {grouped[date].map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-4 py-3 active:bg-[var(--bg-input)] transition-colors"
                    onClick={() => handleEdit(tx)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{cat?.icon || '📝'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tx.note || cat?.name || 'Transaction'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{cat?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p
                        className={`text-sm font-semibold font-mono ${
                          tx.type === 'income' ? 'text-[var(--green)]' : 'text-[var(--red)]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                        className="text-[var(--text-muted)] hover:text-[var(--red)] p-1 text-lg"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
