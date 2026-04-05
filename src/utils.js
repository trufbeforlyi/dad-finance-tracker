// ── UUID v4 (no dependency) ──────────────────────────────────────
export function v4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Formatting ──────────────────────────────────────────────────
export function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(dateStr) {
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - now.getTime()) / 86400000);
}

export function currentMonthKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export function getPaidMonths(card) {
  try { return JSON.parse(card.paid_months || '[]'); } catch { return []; }
}

export function isPaidThisMonth(card) {
  return getPaidMonths(card).includes(currentMonthKey());
}

export function resolveStatus(card) {
  if (isPaidThisMonth(card)) return 'Paid';
  if (card.amount_due === 0) return 'Pending';
  if (card.status === 'Paid' && card.amount_due > 0) return daysUntil(card.date_due) < 0 ? 'Overdue' : 'Pending';
  if (card.status !== 'Paid' && daysUntil(card.date_due) < 0) return 'Overdue';
  return card.status || 'Pending';
}

export function avgScore(card) {
  const s = [card.score_equifax, card.score_experian, card.score_transunion].filter(v => v != null);
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
}

export function scoreColor(score) {
  if (score >= 750) return 'text-green-400';
  if (score >= 700) return 'text-green-300';
  if (score >= 650) return 'text-yellow-400';
  if (score >= 600) return 'text-orange-400';
  return 'text-red-400';
}

export function scoreBarPct(score) {
  return Math.max(0, Math.min(100, ((score - 300) / 550) * 100));
}

// ── Type helpers ────────────────────────────────────────────────
export const isCCType = t => t === 'Credit' || t === 'Prepaid';
export const isBankType = t => t === 'Bank' || t === 'Debit';
export const isCardOrBank = t => t === 'Credit' || t === 'Debit' || t === 'Prepaid' || t === 'Bank';

// ── Constants ───────────────────────────────────────────────────
export const NETWORKS = ['Visa', 'Mastercard', 'Amex', 'Discover', 'Other'];
export const CARD_TYPES = ['Credit', 'Debit', 'Prepaid', 'Bill', 'Bank', 'Investment', 'CreditScore'];
export const BILL_TYPES = ['Phone', 'Insurance', 'Storage', 'Utilities', 'Internet', 'Rent', 'Subscription', 'Other'];
export const BILL_FREQUENCIES = ['Monthly', 'Quarterly', 'Bi-Yearly', 'Yearly'];
export const BANK_ACCOUNT_TYPES = ['Checking', 'Savings'];
export const INVESTMENT_TYPES = ['Brokerage', 'IRA', 'Roth IRA', '401k', 'OANDA', 'TradingView', 'Other'];
export const PAYMENT_STATUSES = ['Paid', 'Overdue', 'Pending', 'Scheduled', 'Partial'];

export const STATUS_COLORS = {
  Paid: 'bg-green-500/20 text-green-400',
  Overdue: 'bg-red-500/20 text-red-400',
  Pending: 'bg-yellow-500/20 text-yellow-400',
  Scheduled: 'bg-blue-500/20 text-blue-400',
  Partial: 'bg-orange-500/20 text-orange-400',
};

// ── Tab definitions ─────────────────────────────────────────────
export const TAB_DEFS = [
  { key: 'all',         defaultName: 'Everything',     icon: 'list',    filter: c => c.card_type !== 'CreditScore', addLabel: 'Add Item',    addType: 'Credit' },
  { key: 'cc',          defaultName: 'CC',             icon: 'card',    filter: c => isCCType(c.card_type),         addLabel: 'Add Card',    addType: 'Credit' },
  { key: 'bills',       defaultName: 'Bills',          icon: 'bill',    filter: c => c.card_type === 'Bill',        addLabel: 'Add Bill',    addType: 'Bill' },
  { key: 'banks',       defaultName: 'Bank Accounts',  icon: 'bank',    filter: c => isBankType(c.card_type),       addLabel: 'Add Account', addType: 'Bank' },
  { key: 'investments', defaultName: 'Investments',    icon: 'invest',  filter: c => c.card_type === 'Investment',  addLabel: 'Add Account', addType: 'Investment' },
  { key: 'scores',      defaultName: 'Credit Scores',  icon: 'score',   filter: c => c.card_type === 'CreditScore' || (isCardOrBank(c.card_type) && (c.score_equifax != null || c.score_experian != null || c.score_transunion != null)), addLabel: 'Add Score', addType: 'CreditScore' },
  { key: 'payperiods',  defaultName: 'Pay Periods',    icon: 'pay',     filter: () => false, addLabel: '', addType: 'Credit' },
];

export const DEFAULT_TAB_ORDER = TAB_DEFS.map(t => t.key);
export const DEFAULT_GROUP_ORDER = ['cc', 'bills', 'banks', 'investments'];
