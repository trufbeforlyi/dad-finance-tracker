// Simple localStorage-based store with reactive updates

const KEYS = {
  transactions: 'ft-transactions',
  categories: 'ft-categories',
  payPeriods: 'ft-pay-periods',
  settings: 'ft-settings',
};

const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  emit();
}

// ── Default Categories ──────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Groceries', color: '#22c55e', icon: '🛒', type: 'expense' },
  { id: 'cat-2', name: 'Utilities', color: '#eab308', icon: '💡', type: 'expense' },
  { id: 'cat-3', name: 'Gas', color: '#f97316', icon: '⛽', type: 'expense' },
  { id: 'cat-4', name: 'Rent/Mortgage', color: '#ef4444', icon: '🏠', type: 'expense' },
  { id: 'cat-5', name: 'Dining Out', color: '#a855f7', icon: '🍔', type: 'expense' },
  { id: 'cat-6', name: 'Entertainment', color: '#ec4899', icon: '🎬', type: 'expense' },
  { id: 'cat-7', name: 'Healthcare', color: '#14b8a6', icon: '🏥', type: 'expense' },
  { id: 'cat-8', name: 'Transportation', color: '#6366f1', icon: '🚗', type: 'expense' },
  { id: 'cat-9', name: 'Clothing', color: '#f43f5e', icon: '👕', type: 'expense' },
  { id: 'cat-10', name: 'Insurance', color: '#0ea5e9', icon: '🛡️', type: 'expense' },
  { id: 'cat-11', name: 'Salary', color: '#22c55e', icon: '💰', type: 'income' },
  { id: 'cat-12', name: 'Side Income', color: '#3b82f6', icon: '💼', type: 'income' },
  { id: 'cat-13', name: 'Refund', color: '#8b5cf6', icon: '↩️', type: 'income' },
];

// ── Categories ──────────────────────────────────────────────────────────────

export function getCategories() {
  return load(KEYS.categories, DEFAULT_CATEGORIES);
}

export function saveCategories(cats) {
  save(KEYS.categories, cats);
}

export function addCategory(cat) {
  const cats = getCategories();
  cats.push({ ...cat, id: 'cat-' + Date.now() });
  saveCategories(cats);
}

export function updateCategory(id, updates) {
  const cats = getCategories().map((c) => (c.id === id ? { ...c, ...updates } : c));
  saveCategories(cats);
}

export function deleteCategory(id) {
  saveCategories(getCategories().filter((c) => c.id !== id));
}

// ── Transactions ────────────────────────────────────────────────────────────

export function getTransactions() {
  return load(KEYS.transactions, []);
}

export function addTransaction(tx) {
  const txs = getTransactions();
  txs.push({ ...tx, id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
  txs.sort((a, b) => b.date.localeCompare(a.date));
  save(KEYS.transactions, txs);
}

export function updateTransaction(id, updates) {
  const txs = getTransactions().map((t) => (t.id === id ? { ...t, ...updates } : t));
  txs.sort((a, b) => b.date.localeCompare(a.date));
  save(KEYS.transactions, txs);
}

export function deleteTransaction(id) {
  save(KEYS.transactions, getTransactions().filter((t) => t.id !== id));
}

// ── Pay Periods ─────────────────────────────────────────────────────────────

export function getPayPeriods() {
  return load(KEYS.payPeriods, []);
}

export function savePayPeriods(periods) {
  save(KEYS.payPeriods, periods);
}

export function generatePayPeriods(startDate, amount, count = 130) {
  const periods = [];
  const start = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 14);
    periods.push({
      id: 'pp-' + i,
      date: d.toISOString().split('T')[0],
      amount,
    });
  }
  savePayPeriods(periods);
  return periods;
}

// ── Settings ────────────────────────────────────────────────────────────────

export function getSettings() {
  return load(KEYS.settings, { currency: 'USD', payStartDate: '', payAmount: 0 });
}

export function saveSettings(s) {
  save(KEYS.settings, s);
}

// ── Export / Import ─────────────────────────────────────────────────────────

export function exportAllData() {
  return JSON.stringify({
    categories: getCategories(),
    transactions: getTransactions(),
    payPeriods: getPayPeriods(),
    settings: getSettings(),
    exportDate: new Date().toISOString(),
  }, null, 2);
}

export function importAllData(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (data.categories) saveCategories(data.categories);
  if (data.transactions) save(KEYS.transactions, data.transactions);
  if (data.payPeriods) savePayPeriods(data.payPeriods);
  if (data.settings) saveSettings(data.settings);
}
