// ── localStorage-based store (replaces SQLite) ──────────────────
import { v4 } from './utils';

const KEYS = {
  cards: 'ft-cards',
  payPeriods: 'ft-pay-periods',
  auth: 'ft-auth',
  tabNames: 'ft-tab-names',
  tabOrder: 'ft-tab-order',
  groupOrder: 'ft-group-order',
  groupCollapsed: 'ft-group-collapsed',
};

const listeners = new Set();
function emit() { listeners.forEach(fn => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); emit(); }

// ── Credit Cards / Bills / Banks / Investments ──────────────────

export function listCards() {
  return load(KEYS.cards, []).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;
    return (a.date_due || '').localeCompare(b.date_due || '');
  });
}

export function createCard(data) {
  const cards = load(KEYS.cards, []);
  const card = {
    id: v4(),
    card_name: data.card_name || 'New Item',
    card_network: data.card_network || 'Visa',
    card_type: data.card_type || 'Credit',
    amount_due: data.amount_due || 0,
    min_payment: data.min_payment || 0,
    date_due: data.date_due || new Date().toISOString().split('T')[0],
    credit_limit: data.credit_limit || 0,
    score_equifax: data.score_equifax ?? null,
    score_experian: data.score_experian ?? null,
    score_transunion: data.score_transunion ?? null,
    status: data.status || 'Pending',
    bill_type: data.bill_type || null,
    bill_frequency: data.bill_frequency || null,
    bank_account_type: data.bank_account_type || null,
    investment_account_type: data.investment_account_type || null,
    balance: data.balance || 0,
    is_pinned: data.is_pinned || 0,
    is_protected: data.is_protected || 0,
    paid_months: data.paid_months || '[]',
    created_at: new Date().toISOString(),
  };
  cards.push(card);
  save(KEYS.cards, cards);
  return card;
}

export function updateCard(data) {
  const cards = load(KEYS.cards, []).map(c => c.id === data.id ? { ...c, ...data } : c);
  save(KEYS.cards, cards);
}

export function deleteCard(id) {
  const cards = load(KEYS.cards, []);
  const card = cards.find(c => c.id === id);
  if (card?.is_protected) return;
  save(KEYS.cards, cards.filter(c => c.id !== id));
}

// ── Pay Periods ─────────────────────────────────────────────────

export function listPayPeriods() {
  return load(KEYS.payPeriods, []).sort((a, b) => a.date.localeCompare(b.date));
}

export function seedPayPeriods(startDate = '2026-04-03', amount = 0) {
  const periods = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 5);
  let current = new Date(start);
  let i = 0;
  while (current <= end) {
    periods.push({
      id: `pp-${i}`,
      date: current.toISOString().split('T')[0],
      amount,
      created_at: new Date().toISOString(),
    });
    current.setDate(current.getDate() + 14);
    i++;
  }
  save(KEYS.payPeriods, periods);
  return periods;
}

export function updatePayPeriodAmount(id, amount) {
  const periods = load(KEYS.payPeriods, []).map(p => p.id === id ? { ...p, amount } : p);
  save(KEYS.payPeriods, periods);
}

export function updatePayPeriod(id, updates) {
  const periods = load(KEYS.payPeriods, []).map(p => p.id === id ? { ...p, ...updates } : p);
  save(KEYS.payPeriods, periods);
}

export function addPayPeriod(data) {
  const periods = load(KEYS.payPeriods, []);
  periods.push({
    id: 'pp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    date: data.date,
    amount: data.amount || 0,
    actual: data.actual ?? null, // actual amount received (null = not yet received)
    created_at: new Date().toISOString(),
  });
  save(KEYS.payPeriods, periods);
}

export function deletePayPeriod(id) {
  save(KEYS.payPeriods, load(KEYS.payPeriods, []).filter(p => p.id !== id));
}

export function updateAllPayPeriodDefaults(amount) {
  // Update all future periods that haven't been customized
  const today = new Date().toISOString().split('T')[0];
  const periods = load(KEYS.payPeriods, []).map(p => {
    if (p.date >= today) return { ...p, amount };
    return p;
  });
  save(KEYS.payPeriods, periods);
}

// ── Auth (optional PIN) ─────────────────────────────────────────

export function hasPin() { return !!load(KEYS.auth, null); }
export function setPin(pin) { save(KEYS.auth, { pin }); }
export function verifyPin(pin) { const a = load(KEYS.auth, null); return a && a.pin === pin; }
export function removePin() { localStorage.removeItem(KEYS.auth); emit(); }

// ── Tab/Group prefs ─────────────────────────────────────────────

export function loadTabNames() { return load(KEYS.tabNames, {}); }
export function saveTabNames(n) { save(KEYS.tabNames, n); }
export function loadTabOrder() { return load(KEYS.tabOrder, null); }
export function saveTabOrder(o) { save(KEYS.tabOrder, o); }
export function loadGroupOrder() { return load(KEYS.groupOrder, null); }
export function saveGroupOrder(o) { save(KEYS.groupOrder, o); }
export function loadGroupCollapsed() { return load(KEYS.groupCollapsed, {}); }
export function saveGroupCollapsed(c) { save(KEYS.groupCollapsed, c); }

// ── Export / Import ─────────────────────────────────────────────

export function exportAll() {
  return JSON.stringify({
    cards: load(KEYS.cards, []),
    payPeriods: load(KEYS.payPeriods, []),
    tabNames: load(KEYS.tabNames, {}),
    tabOrder: load(KEYS.tabOrder, null),
    groupOrder: load(KEYS.groupOrder, null),
    groupCollapsed: load(KEYS.groupCollapsed, {}),
    exportDate: new Date().toISOString(),
  }, null, 2);
}

export function importAll(jsonStr) {
  const d = JSON.parse(jsonStr);
  if (d.cards) save(KEYS.cards, d.cards);
  if (d.payPeriods) save(KEYS.payPeriods, d.payPeriods);
  if (d.tabNames) save(KEYS.tabNames, d.tabNames);
  if (d.tabOrder) save(KEYS.tabOrder, d.tabOrder);
  if (d.groupOrder) save(KEYS.groupOrder, d.groupOrder);
  if (d.groupCollapsed) save(KEYS.groupCollapsed, d.groupCollapsed);
}
