import { getTransactions, getCategories, getPayPeriods } from '../store';
import { formatCurrency, getMonthRange, isPast } from '../utils';

export default function Dashboard({ onNavigate }) {
  const txs = getTransactions();
  const categories = getCategories();
  const payPeriods = getPayPeriods();
  const month = getMonthRange(0);

  // This month's transactions
  const monthTxs = txs.filter((t) => t.date >= month.start && t.date <= month.end);
  const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  // Top expense categories this month
  const expenseByCategory = {};
  monthTxs
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      expenseByCategory[t.categoryId] = (expenseByCategory[t.categoryId] || 0) + t.amount;
    });
  const topCategories = Object.entries(expenseByCategory)
    .map(([catId, total]) => ({ cat: categories.find((c) => c.id === catId), total }))
    .filter((c) => c.cat)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Next pay date
  const today = new Date().toISOString().split('T')[0];
  const nextPay = payPeriods.find((p) => p.date >= today);

  // Recent transactions
  const recent = txs.slice(0, 5);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Finance Tracker</h1>
      <p className="text-sm text-[var(--text-muted)]">{month.label}</p>

      {/* Balance card */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white">
        <p className="text-sm opacity-80">Monthly Balance</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(balance)}</p>
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <p className="opacity-70">Income</p>
            <p className="font-semibold text-green-300">+{formatCurrency(income)}</p>
          </div>
          <div>
            <p className="opacity-70">Expenses</p>
            <p className="font-semibold text-red-300">-{formatCurrency(expenses)}</p>
          </div>
        </div>
      </div>

      {/* Next pay */}
      {nextPay && (
        <button
          onClick={() => onNavigate('pay')}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left active:opacity-80"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Next Payday</p>
              <p className="font-semibold mt-1">
                {new Date(nextPay.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <p className="text-xl font-bold text-[var(--green)]">{formatCurrency(nextPay.amount)}</p>
          </div>
        </button>
      )}

      {/* Top spending categories */}
      {topCategories.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Top Spending</p>
            <button onClick={() => onNavigate('categories')} className="text-xs text-[var(--accent)]">
              All Categories →
            </button>
          </div>
          <div className="space-y-3">
            {topCategories.map(({ cat, total }) => {
              const pct = expenses > 0 ? (total / expenses) * 100 : 0;
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>
                      {cat.icon} {cat.name}
                    </span>
                    <span className="font-mono text-[var(--text-secondary)]">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Recent Transactions</p>
          <button onClick={() => onNavigate('transactions')} className="text-xs text-[var(--accent)]">
            View All →
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            No transactions yet. Tap the Log tab to add one!
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              return (
                <div key={tx.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon || '📝'}</span>
                    <div>
                      <p className="text-sm font-medium">{tx.note || cat?.name || 'Transaction'}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold font-mono ${
                      tx.type === 'income' ? 'text-[var(--green)]' : 'text-[var(--red)]'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick add button */}
      <button
        onClick={() => onNavigate('transactions')}
        className="w-full rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.98] text-white font-semibold py-4 text-lg transition-all"
      >
        + Add Transaction
      </button>
    </div>
  );
}
