import { useState } from 'react';
import { getCategories, addCategory, updateCategory, deleteCategory, getTransactions } from '../store';
import { EMOJI_OPTIONS, COLOR_OPTIONS } from '../utils';

function CategoryForm({ onSave, onCancel, initial = null }) {
  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || '📝');
  const [color, setColor] = useState(initial?.color || '#3b82f6');
  const [type, setType] = useState(initial?.type || 'expense');
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color, type });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type toggle */}
      <div className="flex rounded-xl bg-[var(--bg-input)] p-1">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              type === t
                ? t === 'expense'
                  ? 'bg-[var(--red)] text-white'
                  : 'bg-[var(--green)] text-white'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {t === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="flex items-center justify-center py-4">
        <div
          className="flex items-center gap-3 rounded-2xl px-6 py-4"
          style={{ backgroundColor: color + '20', borderColor: color, borderWidth: 2 }}
        >
          <span className="text-3xl">{icon}</span>
          <span className="text-lg font-bold" style={{ color }}>
            {name || 'Category Name'}
          </span>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groceries"
          className="w-full mt-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          autoFocus
        />
      </div>

      {/* Icon picker */}
      <div>
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Icon</label>
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className="w-full mt-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-4 py-3 text-left text-2xl"
        >
          {icon} <span className="text-sm text-[var(--text-muted)] ml-2">Tap to change</span>
        </button>
        {showEmoji && (
          <div className="grid grid-cols-6 gap-2 mt-2 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { setIcon(e); setShowEmoji(false); }}
                className={`text-2xl p-2 rounded-lg transition-all ${
                  icon === e ? 'bg-[var(--accent)]/20 ring-2 ring-[var(--accent)]' : 'active:bg-[var(--border)]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color picker */}
      <div>
        <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Color</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-10 h-10 rounded-full transition-all ${
                color === c ? 'ring-3 ring-white ring-offset-2 ring-offset-[var(--bg-primary)] scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
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
          disabled={!name.trim()}
          className="flex-1 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 py-3.5 font-semibold text-white active:scale-[0.98] transition-all"
        >
          {initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function Categories() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');

  const categories = getCategories();
  const transactions = getTransactions();

  // Count transactions per category
  const txCountMap = {};
  transactions.forEach((tx) => {
    txCountMap[tx.categoryId] = (txCountMap[tx.categoryId] || 0) + 1;
  });

  const filtered =
    filter === 'all' ? categories : categories.filter((c) => c.type === filter);

  const handleSave = (data) => {
    if (editing) {
      updateCategory(editing.id, data);
    } else {
      addCategory(data);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleEdit = (cat) => {
    setEditing(cat);
    setShowForm(true);
  };

  const handleDelete = (cat) => {
    const count = txCountMap[cat.id] || 0;
    const msg = count > 0
      ? `"${cat.name}" has ${count} transaction(s). Delete anyway?`
      : `Delete "${cat.name}"?`;
    if (confirm(msg)) {
      deleteCategory(cat.id);
    }
  };

  if (showForm) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">{editing ? 'Edit Category' : 'New Category'}</h2>
        <CategoryForm
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
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition-all"
        >
          + New
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex rounded-xl bg-[var(--bg-input)] p-1">
        {[
          { id: 'all', label: 'All' },
          { id: 'expense', label: '💸 Expenses' },
          { id: 'income', label: '💰 Income' },
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

      {/* Category list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="font-semibold">No categories yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Tap + New to create one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0" onClick={() => handleEdit(cat)}>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: cat.color + '20' }}
                >
                  {cat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{cat.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {cat.type === 'expense' ? 'Expense' : 'Income'}
                    {txCountMap[cat.id] ? ` · ${txCountMap[cat.id]} txn${txCountMap[cat.id] > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEdit(cat)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--accent)] text-sm"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--red)] text-sm"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] text-center pt-2">
        Tap a category to edit · {categories.length} total
      </p>
    </div>
  );
}
