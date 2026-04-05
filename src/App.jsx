import { useState, useEffect, useRef, useMemo } from 'react';
import { subscribe, listCards, createCard, updateCard, deleteCard, listPayPeriods, seedPayPeriods, updatePayPeriodAmount, updatePayPeriod, addPayPeriod, deletePayPeriod, updateAllPayPeriodDefaults, loadTabNames, saveTabNames, loadTabOrder, saveTabOrder, loadGroupOrder, saveGroupOrder, loadGroupCollapsed, saveGroupCollapsed, exportAll, importAll } from './store';
import { fmt, fmtDate, daysUntil, resolveStatus, avgScore, scoreColor, scoreBarPct, isCCType, isBankType, isCardOrBank, NETWORKS, CARD_TYPES, BILL_TYPES, BILL_FREQUENCIES, BANK_ACCOUNT_TYPES, INVESTMENT_TYPES, PAYMENT_STATUSES, STATUS_COLORS, TAB_DEFS, DEFAULT_TAB_ORDER, DEFAULT_GROUP_ORDER, getPaidMonths, currentMonthKey } from './utils';
import { TabIcon, PlusIcon, TrashIcon, ChevronIcon } from './components/Icons';
import LiveCountdown from './components/LiveCountdown';
import MonthPaidToggle from './components/MonthPaidToggle';

// ── Re-render on store changes ──────────────────────────────────
function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick(t => t + 1)), []);
}

// ── Tab icon map ────────────────────────────────────────────────
const ICON_MAP = { all: 'list', cc: 'card', bills: 'bill', banks: 'bank', investments: 'invest', scores: 'score', payperiods: 'pay', settings: 'settings' };

function defaultTypeForTab(tab) {
  return TAB_DEFS.find(t => t.key === tab)?.addType ?? 'Credit';
}

// ══════════════════════════════════════════════════════════════════
export default function App() {
  useStore();

  const cards = listCards();
  const payPeriods = listPayPeriods();

  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState(null); // { id, field }
  const [editValue, setEditValue] = useState('');
  const [sortField, setSortField] = useState('date_due');
  const [sortDir, setSortDir] = useState('asc');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [payFilter, setPayFilter] = useState('upcoming');
  const [editingPayId, setEditingPayId] = useState(null);
  const [editingPayValue, setEditingPayValue] = useState('');
  const [tabNames, setTabNamesState] = useState(() => {
    const saved = loadTabNames();
    const defaults = {};
    TAB_DEFS.forEach(t => { defaults[t.key] = t.defaultName; });
    return { ...defaults, ...saved };
  });
  const [tabOrder, setTabOrderState] = useState(() => loadTabOrder() || DEFAULT_TAB_ORDER);
  const [groupOrder, setGroupOrderState] = useState(() => loadGroupOrder() || DEFAULT_GROUP_ORDER);
  const [groupCollapsed, setGroupCollapsedState] = useState(() => loadGroupCollapsed());

  const inputRef = useRef(null);
  const payInputRef = useRef(null);

  useEffect(() => { setSortField('date_due'); setSortDir('asc'); }, [tab]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  useEffect(() => { if (editingPayId && payInputRef.current) { payInputRef.current.focus(); payInputRef.current.select(); } }, [editingPayId]);

  // Don't auto-seed — let user set up pay periods themselves

  // ── Counts ──
  const counts = {
    all: cards.filter(c => c.card_type !== 'CreditScore').length,
    cc: cards.filter(c => isCCType(c.card_type)).length,
    bills: cards.filter(c => c.card_type === 'Bill').length,
    banks: cards.filter(c => isBankType(c.card_type)).length,
    investments: cards.filter(c => c.card_type === 'Investment').length,
    scores: cards.filter(c => c.card_type === 'CreditScore' || (isCardOrBank(c.card_type) && (c.score_equifax != null || c.score_experian != null || c.score_transunion != null))).length,
    payperiods: payPeriods.length,
  };

  // ── Filtered & sorted cards ──
  const tabDef = TAB_DEFS.find(t => t.key === tab);
  const filtered = useMemo(() => {
    if (!tabDef) return [];
    const f = cards.filter(tabDef.filter);
    const m = sortDir === 'asc' ? 1 : -1;
    return f.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      return av < bv ? -1 * m : av > bv ? 1 * m : 0;
    });
  }, [cards, tab, sortField, sortDir]);

  const toggleSort = (f) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  };

  // ── Cell editing ──
  const startEdit = (card, field) => {
    setEditing({ id: card.id, field });
    const v = card[field];
    setEditValue(v != null ? String(v) : '');
  };

  const commitEdit = () => {
    if (!editing) return;
    const card = cards.find(c => c.id === editing.id);
    if (!card) { setEditing(null); return; }
    const u = { ...card };
    const { field } = editing;
    if (['amount_due', 'min_payment', 'credit_limit', 'balance'].includes(field)) {
      const n = parseFloat(editValue);
      u[field] = isNaN(n) ? card[field] : n;
      if (field === 'amount_due' && u.amount_due === 0) u.status = 'Pending';
    } else if (['score_equifax', 'score_experian', 'score_transunion'].includes(field)) {
      const n = parseInt(editValue, 10);
      u[field] = isNaN(n) ? null : Math.min(850, Math.max(300, n));
    } else if (field === 'card_name') {
      u.card_name = editValue.trim() || card.card_name;
    } else if (field === 'date_due') {
      u.date_due = editValue || card.date_due;
    }
    setEditing(null);
    updateCard(u);
  };

  const commitSelectEdit = (card, field, value) => {
    const u = { ...card, [field]: value };
    if (field === 'status' && value === 'Paid') {
      const d = new Date(card.date_due + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      u.date_due = d.toISOString().split('T')[0];
      u.status = 'Pending';
    }
    if (field === 'card_type') {
      if (value !== 'Bill') u.bill_type = null;
      if (value !== 'Bank') u.bank_account_type = null;
      if (value !== 'Investment') u.investment_account_type = null;
    }
    setEditing(null);
    updateCard(u);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); };

  // ── Toggle paid month ──
  const togglePaidMonth = (card, month) => {
    const months = getPaidMonths(card);
    const next = months.includes(month) ? months.filter(m => m !== month) : [...months, month];
    updateCard({ ...card, paid_months: JSON.stringify(next) });
  };

  // ── Add item ──
  const addItem = (overrideType) => {
    setShowAddMenu(false);
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const dateStr = nextMonth.toISOString().split('T')[0];
    const type = overrideType || tabDef?.addType || 'Credit';
    createCard({
      card_name: type === 'Bill' ? 'New Bill' : type === 'Bank' ? 'New Account' : type === 'Debit' ? 'New Debit Card' : type === 'Investment' ? 'New Investment' : type === 'CreditScore' ? 'Credit Karma' : 'New Card',
      card_network: 'Visa', card_type: type,
      amount_due: 0, min_payment: 0, date_due: dateStr, credit_limit: 0,
      status: 'Pending',
      bill_type: type === 'Bill' ? 'Phone' : null,
      bill_frequency: type === 'Bill' ? 'Monthly' : null,
      bank_account_type: type === 'Bank' || type === 'Debit' ? 'Checking' : null,
      investment_account_type: type === 'Investment' ? 'Brokerage' : null,
      balance: 0, is_pinned: 0, is_protected: 0, paid_months: '[]',
    });
  };

  // ── Group collapse ──
  const toggleCollapse = (key) => {
    const next = { ...groupCollapsed, [key]: !groupCollapsed[key] };
    setGroupCollapsedState(next);
    saveGroupCollapsed(next);
  };

  // ── Score helpers ──
  const allScoredItems = cards.filter(c => c.card_type === 'CreditScore' || (isCardOrBank(c.card_type) && (c.score_equifax != null || c.score_experian != null || c.score_transunion != null)));
  const allAvgScores = allScoredItems.map(c => avgScore(c)).filter(s => s != null);
  const overallAvgScore = allAvgScores.length ? Math.round(allAvgScores.reduce((a, b) => a + b, 0) / allAvgScores.length) : null;

  // ── Status badge ──
  const statusBadge = (card) => {
    const s = resolveStatus(card);
    return <span className={`badge ${STATUS_COLORS[s] || 'bg-dark-600 text-dark-300'}`}>{s}</span>;
  };

  // ── Editable cell renderer ──
  const editableCell = (card, field, display, inputType = 'text', className = '') => {
    if (editing?.id === card.id && editing.field === field) {
      return <input ref={inputRef} type={inputType} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} className={`!py-1 !px-2 ${className}`} />;
    }
    return <span className="cursor-pointer hover:text-accent-hover transition-colors" onClick={() => startEdit(card, field)}>{display}</span>;
  };

  const selectCell = (card, field, options, display) => {
    if (editing?.id === card.id && editing.field === field) {
      return <select value={editValue} onChange={e => commitSelectEdit(card, field, e.target.value)} onBlur={() => setEditing(null)} className="!py-1 !px-2" autoFocus>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>;
    }
    return <span className="cursor-pointer hover:text-accent-hover transition-colors" onClick={() => startEdit(card, field)}>{display}</span>;
  };

  // ── Score editor inline ──
  const scoreEditor = (card) => {
    const bureaus = [
      { key: 'score_equifax', label: 'EQ' },
      { key: 'score_experian', label: 'EX' },
      { key: 'score_transunion', label: 'TU' },
    ];
    const avg = avgScore(card);
    return (
      <div className="flex flex-col gap-0.5 mt-1">
        {avg != null && <span className={`text-xs font-semibold ${scoreColor(avg)}`}>Avg: {avg}</span>}
        <div className="flex gap-2">
          {bureaus.map(b => (
            <div key={b.key} className="flex items-center gap-0.5">
              {editing?.id === card.id && editing.field === b.key ? (
                <input ref={inputRef} type="number" min="300" max="850" placeholder={b.label} value={editValue}
                  onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown}
                  className="!py-0 !px-1 w-14 text-xs" />
              ) : (
                <span className={`text-xs cursor-pointer hover:text-accent-hover transition-colors ${card[b.key] != null ? scoreColor(card[b.key]) : 'text-dark-500'}`}
                  onClick={() => startEdit(card, b.key)} title={`${b.label}: ${card[b.key] ?? 'Click to set'}`}>
                  {b.label}: {card[b.key] ?? '—'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Table row (reusable) ──
  const renderRow = (card, cols) => (
    <tr key={card.id} className={`table-row group ${card.is_pinned ? 'bg-dark-700/40' : ''}`}>
      {/* Name */}
      <td className="px-3 md:px-5 py-3">
        <div>
          <div className="flex items-center gap-1.5">
            {card.is_pinned ? <span className="text-yellow-400 text-xs">📌</span> : null}
            {editableCell(card, 'card_name', <span className="text-dark-100 font-medium">{card.card_name}</span>)}
            {card.is_protected ? <span className="text-dark-500 text-xs">🔒</span> : null}
          </div>
          {isCardOrBank(card.card_type) && scoreEditor(card)}
          {card.card_type === 'Bill' && (
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              {selectCell(card, 'bill_type', BILL_TYPES, <span className="text-xs text-dark-400 inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400" />{card.bill_type || 'Select type'}</span>)}
              <span className="text-dark-600">·</span>
              {selectCell(card, 'bill_frequency', BILL_FREQUENCIES, <span className="text-xs text-dark-500">{card.bill_frequency || 'Monthly'}</span>)}
            </div>
          )}
          {card.card_type === 'Investment' && (
            <div className="mt-0.5">
              {selectCell(card, 'investment_account_type', INVESTMENT_TYPES, <span className="text-xs text-dark-400 inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />{card.investment_account_type || 'Select type'}</span>)}
            </div>
          )}
        </div>
      </td>
      {cols.network && <td className="px-3 md:px-5 py-3 hidden md:table-cell">{!isCCType(card.card_type) ? <span className="text-dark-500">—</span> : selectCell(card, 'card_network', NETWORKS, <span className="text-dark-200">{card.card_network}</span>)}</td>}
      {cols.balance && <td className="px-3 md:px-5 py-3 text-right">{editableCell(card, 'balance', <span className="text-dark-100 font-mono">{fmt(card.balance || 0)}</span>, 'number', 'w-28 text-right')}</td>}
      {cols.creditLimit && <td className="px-3 md:px-5 py-3 text-right hidden md:table-cell">{!isCCType(card.card_type) ? <span className="text-dark-500">—</span> : editableCell(card, 'credit_limit', <span className="text-dark-100 font-mono">{card.credit_limit ? fmt(card.credit_limit) : '—'}</span>, 'number', 'w-28 text-right')}</td>}
      {cols.amountDue && <td className="px-3 md:px-5 py-3 text-right">{editableCell(card, 'amount_due', <span className={`font-mono ${card.amount_due === 0 ? 'text-green-400' : 'text-dark-100'}`}>{fmt(card.amount_due)}</span>, 'number', 'w-28 text-right')}</td>}
      {cols.minPayment && <td className="px-3 md:px-5 py-3 text-right hidden lg:table-cell">{!isCCType(card.card_type) ? <span className="text-dark-500">—</span> : editableCell(card, 'min_payment', <span className="text-dark-300 font-mono">{card.min_payment ? fmt(card.min_payment) : '—'}</span>, 'number', 'w-24 text-right')}</td>}
      {cols.dateDue && <td className="px-3 md:px-5 py-3"><span className="cursor-pointer hover:text-accent-hover transition-colors inline-flex items-center flex-wrap" onClick={() => startEdit(card, 'date_due')}>{editing?.id === card.id && editing.field === 'date_due' ? <input ref={inputRef} type="date" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} className="!py-1 !px-2" /> : <><span className="text-dark-100">{fmtDate(card.date_due)}</span><LiveCountdown dateStr={card.date_due} /></>}</span></td>}
      {cols.status && <td className="px-3 md:px-5 py-3">{selectCell(card, 'status', PAYMENT_STATUSES, statusBadge(card))}</td>}
      <td className="px-3 md:px-5 py-3 text-right">
        {card.is_protected ? <span className="text-dark-600 text-xs">🔒</span> : (
          <button onClick={() => { if (confirm('Delete this item?')) deleteCard(card.id); }} className="opacity-0 group-hover:opacity-100 text-dark-500 hover:text-red-400 transition-all p-1 rounded hover:bg-red-500/10"><TrashIcon /></button>
        )}
      </td>
    </tr>
  );

  // ── Column configs ──
  const groupColumns = (key) => {
    switch (key) {
      case 'cc': return { network: true, creditLimit: true, amountDue: true, minPayment: true, dateDue: true, status: true, balance: false };
      case 'bills': return { network: false, creditLimit: false, amountDue: true, minPayment: false, dateDue: true, status: true, balance: false };
      case 'banks': return { network: false, creditLimit: false, amountDue: false, minPayment: false, dateDue: false, status: false, balance: true };
      case 'investments': return { network: false, creditLimit: false, amountDue: false, minPayment: false, dateDue: false, status: false, balance: true };
      default: return { network: true, creditLimit: true, amountDue: true, minPayment: true, dateDue: true, status: true, balance: true };
    }
  };

  // ── Sortable TH ──
  const ThSort = ({ field, label, align }) => {
    const icon = sortField !== field ? '⇅' : sortDir === 'asc' ? '↑' : '↓';
    const cls = sortField === field ? 'text-accent' : 'text-dark-600';
    return <th className={`text-${align} text-xs font-medium text-dark-400 uppercase tracking-wider px-3 md:px-5 py-3 cursor-pointer select-none hover:text-dark-200 transition-colors`} onClick={() => toggleSort(field)}>{label}<span className={`${cls} ml-1`}>{icon}</span></th>;
  };

  // ══════════════════════════════════════════════════════════════════
  // ── RENDER ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col md:flex-row bg-dark-800">
      {/* ── Desktop Sidebar ── */}
      <div className="desktop-sidebar w-52 shrink-0 border-r border-dark-700/50 bg-dark-800/80 flex-col px-3 py-4 overflow-y-auto hidden">
        <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3 px-3">Categories</p>
        {tabOrder.map(key => (
          <div key={key} className={`sidebar-item ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            <TabIcon icon={ICON_MAP[key]} />
            <span className="truncate">{tabNames[key]}</span>
            <span className="ml-auto text-xs opacity-60">{counts[key] ?? ''}</span>
          </div>
        ))}
        <div className={`sidebar-item ${tab === 'settings' ? 'active' : ''} mt-2`} onClick={() => setTab('settings')}>
          <TabIcon icon="settings" />
          <span>Settings</span>
        </div>
        {overallAvgScore != null && (
          <div className="mt-auto pt-4 px-3 border-t border-dark-700/50">
            <p className="text-xs text-dark-400 mb-1">Avg Credit Score</p>
            <p className={`text-2xl font-bold ${scoreColor(overallAvgScore)}`}>{overallAvgScore}</p>
          </div>
        )}
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mobile-nav fixed bottom-0 left-0 right-0 border-t border-dark-700/50 bg-dark-800 z-50 hidden">
        {['all', 'cc', 'bills', 'banks', 'payperiods', 'settings'].map(key => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 flex flex-col items-center py-2 pt-2.5 transition-colors ${tab === key ? 'text-accent-hover' : 'text-dark-400'}`}>
            <TabIcon icon={ICON_MAP[key] || 'settings'} />
            <span className="text-[10px] mt-0.5 font-medium">{key === 'all' ? 'All' : key === 'cc' ? 'Cards' : key === 'settings' ? 'More' : (tabNames[key] || key).split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto main-content">
        <div className="px-4 md:px-8 pb-8 pt-4 md:pt-6 max-w-6xl">

          {tab === 'settings' ? (
            <SettingsPage cards={cards} payPeriods={payPeriods} />
          ) : tab === 'all' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-dark-100">{tabNames.all || 'Everything'}</h1>
                <div className="relative">
                  <button onClick={() => setShowAddMenu(!showAddMenu)} className="btn-primary"><PlusIcon /> Add Item ▾</button>
                  {showAddMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-dark-700 border border-dark-600 rounded-lg shadow-xl py-1 min-w-[180px]">
                        {[
                          { type: 'Credit', label: 'Credit Card', icon: 'card' },
                          { type: 'Debit', label: 'Debit Card', icon: 'bank' },
                          { type: 'Bill', label: 'Bill', icon: 'bill' },
                          { type: 'Bank', label: 'Bank Account', icon: 'bank' },
                          { type: 'Investment', label: 'Investment', icon: 'invest' },
                        ].map(opt => (
                          <button key={opt.type} onClick={() => addItem(opt.type)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 hover:text-dark-100 transition-colors text-left">
                            <TabIcon icon={opt.icon} />{opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Credit Score Banner */}
              {(() => {
                const bureaus = [
                  { key: 'score_equifax', label: 'Equifax', gradient: 'from-blue-600 to-blue-400' },
                  { key: 'score_experian', label: 'Experian', gradient: 'from-emerald-600 to-emerald-400' },
                  { key: 'score_transunion', label: 'TransUnion', gradient: 'from-purple-600 to-purple-400' },
                ];
                const bureauAvgs = bureaus.map(b => {
                  const scores = allScoredItems.filter(c => c[b.key] != null).map(c => c[b.key]);
                  const avg = scores.length ? Math.round(scores.reduce((a, x) => a + x, 0) / scores.length) : null;
                  return { ...b, avg };
                });
                if (!bureauAvgs.some(b => b.avg != null)) return null;
                return (
                  <div className="card !p-4 cursor-pointer hover:border-accent/20 transition-colors" onClick={() => setTab('scores')}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2"><TabIcon icon="score" /><span className="text-dark-400 text-xs uppercase tracking-wider font-semibold">Credit Scores</span></div>
                      {overallAvgScore != null && <div className="flex items-center gap-2"><span className="text-dark-500 text-xs">Overall</span><span className={`text-2xl font-bold ${scoreColor(overallAvgScore)}`}>{overallAvgScore}</span></div>}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {bureauAvgs.map(b => (
                        <div key={b.key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-dark-400 text-xs font-medium">{b.label}</span>
                            {b.avg != null && <span className={`text-lg font-bold ${scoreColor(b.avg)}`}>{b.avg}</span>}
                          </div>
                          <div className="progress-bar"><div className={`progress-bar-fill bg-gradient-to-r ${b.gradient}`} style={{ width: b.avg ? `${scoreBarPct(b.avg)}%` : '0%' }} /></div>
                          <div className="flex justify-between mt-0.5"><span className="text-dark-600 text-[10px]">300</span><span className="text-dark-600 text-[10px]">850</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'cc', items: filtered.filter(c => isCCType(c.card_type)), val: f => fmt(f.reduce((s, c) => s + c.amount_due, 0)), sub: 'due' },
                  { key: 'bills', items: filtered.filter(c => c.card_type === 'Bill'), val: f => fmt(f.reduce((s, c) => s + c.amount_due, 0)), sub: 'due' },
                  { key: 'banks', items: filtered.filter(c => isBankType(c.card_type)), val: f => fmt(f.reduce((s, c) => s + (c.balance || 0), 0)), sub: 'total balance' },
                  { key: 'investments', items: filtered.filter(c => c.card_type === 'Investment'), val: f => fmt(f.reduce((s, c) => s + (c.balance || 0), 0)), sub: 'total balance' },
                ].filter(g => g.items.length > 0).map(g => (
                  <div key={g.key} className="card cursor-pointer hover:border-accent/30 transition-colors" onClick={() => setTab(g.key)}>
                    <div className="flex items-center gap-2 mb-2"><TabIcon icon={ICON_MAP[g.key]} /><span className="text-dark-400 text-xs uppercase tracking-wider">{tabNames[g.key]}</span></div>
                    <p className="text-xl font-bold text-dark-100">{g.val(g.items)}</p>
                    <p className="text-dark-500 text-xs">{g.sub}</p>
                  </div>
                ))}
              </div>

              {/* Grouped tables */}
              {groupOrder.filter(k => {
                const items = k === 'cc' ? filtered.filter(c => isCCType(c.card_type))
                  : k === 'bills' ? filtered.filter(c => c.card_type === 'Bill')
                  : k === 'banks' ? filtered.filter(c => isBankType(c.card_type))
                  : filtered.filter(c => c.card_type === 'Investment');
                return items.length > 0;
              }).map(k => {
                const items = k === 'cc' ? filtered.filter(c => isCCType(c.card_type))
                  : k === 'bills' ? filtered.filter(c => c.card_type === 'Bill')
                  : k === 'banks' ? filtered.filter(c => isBankType(c.card_type))
                  : filtered.filter(c => c.card_type === 'Investment');
                const cols = groupColumns(k);
                const collapsed = !!groupCollapsed[k];
                const total = k === 'cc' || k === 'bills' ? fmt(items.reduce((s, c) => s + c.amount_due, 0)) + ' due' : fmt(items.reduce((s, c) => s + (c.balance || 0), 0)) + ' total';

                return (
                  <div key={k} className="card !p-0 overflow-hidden">
                    <div className="px-4 md:px-5 py-3 flex items-center gap-2 cursor-pointer select-none hover:bg-dark-700/30 transition-colors" onClick={() => toggleCollapse(k)}>
                      <ChevronIcon open={!collapsed} />
                      <TabIcon icon={ICON_MAP[k]} />
                      <h3 className="text-dark-200 font-semibold text-sm">{tabNames[k]}</h3>
                      <span className="text-dark-500 text-xs">({items.length})</span>
                      {collapsed && <span className="ml-auto text-dark-400 text-xs font-mono">{total}</span>}
                    </div>
                    {!collapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                          <thead>
                            <tr className="border-t border-b border-dark-600/50">
                              <th className="text-left text-xs font-medium text-dark-400 uppercase tracking-wider px-3 md:px-5 py-2">Name</th>
                              {cols.network && <th className="text-left text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-2 hidden md:table-cell">Network</th>}
                              {cols.balance && <th className="text-right text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-2">Balance</th>}
                              {cols.creditLimit && <th className="text-right text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-2 hidden md:table-cell">Limit</th>}
                              {cols.amountDue && <th className="text-right text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-2">Due</th>}
                              {cols.minPayment && <th className="text-right text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-2 hidden lg:table-cell">Min</th>}
                              {cols.dateDue && <th className="text-left text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-2">Date</th>}
                              {cols.status && <th className="text-left text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-2">Status</th>}
                              <th className="px-3 md:px-5 py-2 w-12"></th>
                            </tr>
                          </thead>
                          <tbody>{items.map(card => renderRow(card, cols))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : tab === 'scores' ? (
            <ScoresPage cards={cards} allScoredItems={allScoredItems} overallAvgScore={overallAvgScore} editing={editing} editValue={editValue} setEditValue={setEditValue} startEdit={startEdit} commitEdit={commitEdit} handleKeyDown={handleKeyDown} inputRef={inputRef} deleteCard={deleteCard} addItem={addItem} tabDef={tabDef} />
          ) : tab === 'payperiods' ? (
            <PayPeriodsPage payPeriods={payPeriods} payFilter={payFilter} setPayFilter={setPayFilter} editingPayId={editingPayId} setEditingPayId={setEditingPayId} editingPayValue={editingPayValue} setEditingPayValue={setEditingPayValue} payInputRef={payInputRef} tabNames={tabNames} />
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-dark-100">{tabNames[tab]}</h1>
                  <p className="text-dark-400 text-sm mt-1">{filtered.length} item{filtered.length !== 1 ? 's' : ''} · {fmt(filtered.reduce((s, c) => s + c.amount_due, 0))} total due</p>
                </div>
                <button onClick={() => addItem()} className="btn-primary"><PlusIcon /> {tabDef?.addLabel}</button>
              </div>

              {filtered.length === 0 ? (
                <div className="card text-center py-16">
                  <p className="text-dark-400 text-lg mb-2">No items yet</p>
                  <button onClick={() => addItem()} className="btn-primary mx-auto"><PlusIcon /> {tabDef?.addLabel}</button>
                </div>
              ) : (
                <div className="card !p-0 overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-dark-600/50">
                        <ThSort field="card_name" label="Name" align="left" />
                        {(tab === 'cc' || tab === 'all') && <ThSort field="card_network" label="Network" align="left" />}
                        {(tab === 'banks' || tab === 'investments') && <ThSort field="balance" label="Balance" align="right" />}
                        {tab === 'cc' && <ThSort field="credit_limit" label="Limit" align="right" />}
                        {tab !== 'banks' && tab !== 'investments' && <ThSort field="amount_due" label="Due" align="right" />}
                        {tab === 'cc' && <ThSort field="min_payment" label="Min" align="right" />}
                        {tab !== 'banks' && tab !== 'investments' && <ThSort field="date_due" label="Date" align="left" />}
                        {tab !== 'banks' && tab !== 'investments' && <th className="text-left text-xs font-medium text-dark-400 uppercase px-3 md:px-5 py-3">Status</th>}
                        <th className="px-3 md:px-5 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>{filtered.map(card => renderRow(card, groupColumns(tab)))}</tbody>
                    <tfoot>
                      <tr className="border-t-2 border-dark-600">
                        <td className="px-3 md:px-5 py-3 text-dark-300 font-semibold text-sm" colSpan={2}>Totals</td>
                        {(tab === 'banks' || tab === 'investments') && <td className="px-3 md:px-5 py-3 text-right"><span className="text-dark-200 font-mono font-semibold">{fmt(filtered.reduce((s, c) => s + (c.balance || 0), 0))}</span></td>}
                        {tab === 'cc' && <td className="px-3 md:px-5 py-3 text-right hidden md:table-cell"><span className="text-dark-200 font-mono font-semibold">{fmt(filtered.reduce((s, c) => s + (c.credit_limit || 0), 0))}</span></td>}
                        {tab !== 'banks' && tab !== 'investments' && <td className="px-3 md:px-5 py-3 text-right"><span className="font-mono font-bold text-dark-100">{fmt(filtered.reduce((s, c) => s + c.amount_due, 0))}</span></td>}
                        {tab === 'cc' && <td className="px-3 md:px-5 py-3 text-right hidden lg:table-cell"><span className="text-dark-300 font-mono">{fmt(filtered.filter(c => isCCType(c.card_type)).reduce((s, c) => s + (c.min_payment || 0), 0))}</span></td>}
                        {tab !== 'banks' && tab !== 'investments' && <td></td>}
                        {tab !== 'banks' && tab !== 'investments' && <td></td>}
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── SCORES PAGE ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function ScoresPage({ cards, allScoredItems, overallAvgScore, editing, editValue, setEditValue, startEdit, commitEdit, handleKeyDown, inputRef, deleteCard, addItem, tabDef }) {
  const standaloneScores = cards.filter(c => c.card_type === 'CreditScore');
  const bureaus = [
    { key: 'score_equifax', label: 'Equifax', gradient: 'from-blue-600 to-blue-400' },
    { key: 'score_experian', label: 'Experian', gradient: 'from-emerald-600 to-emerald-400' },
    { key: 'score_transunion', label: 'TransUnion', gradient: 'from-purple-600 to-purple-400' },
  ];
  const bureauData = bureaus.map(b => {
    const entries = allScoredItems.filter(c => c[b.key] != null).map(c => ({ id: c.id, name: c.card_name, score: c[b.key], isStandalone: c.card_type === 'CreditScore' }));
    const avg = entries.length ? Math.round(entries.reduce((s, x) => s + x.score, 0) / entries.length) : null;
    return { ...b, entries, avg };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-dark-100">Credit Scores</h1>
        <button onClick={() => addItem('CreditScore')} className="btn-primary"><PlusIcon /> Add Score</button>
      </div>

      {overallAvgScore != null && (
        <div className="card text-center py-8">
          <p className="text-dark-400 text-sm uppercase tracking-wider mb-2">Overall Average Score</p>
          <p className={`text-6xl font-bold ${scoreColor(overallAvgScore)}`}>{overallAvgScore}</p>
          <p className={`text-sm mt-1 ${scoreColor(overallAvgScore)}`}>
            {overallAvgScore >= 750 ? 'Excellent' : overallAvgScore >= 700 ? 'Good' : overallAvgScore >= 650 ? 'Fair' : overallAvgScore >= 600 ? 'Poor' : 'Very Poor'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bureauData.map(b => (
          <div key={b.key} className="card">
            <h3 className="text-dark-200 font-semibold text-lg mb-4">{b.label}</h3>
            {b.avg != null ? (
              <>
                <p className={`text-4xl font-bold ${scoreColor(b.avg)} mb-1`}>{b.avg}</p>
                <div className="progress-bar mt-2 mb-4"><div className={`progress-bar-fill bg-gradient-to-r ${b.gradient}`} style={{ width: `${scoreBarPct(b.avg)}%` }} /></div>
                <div className="space-y-2">
                  {b.entries.map(e => (
                    <div key={e.id + b.key} className="flex items-center justify-between text-sm">
                      <span className="text-dark-400 truncate mr-2">{e.name}{e.isStandalone && <span className="ml-1 text-xs text-accent/60">★</span>}</span>
                      <span className={`font-mono font-medium ${scoreColor(e.score)}`}>{e.score}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-dark-500 text-sm">No scores recorded</p>}
          </div>
        ))}
      </div>

      {standaloneScores.length > 0 && (
        <div className="card !p-0 overflow-x-auto">
          <div className="px-5 py-3 border-b border-dark-600/50"><h3 className="text-dark-300 text-sm font-semibold uppercase tracking-wider">Score Sources</h3></div>
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-dark-600/50">
                <th className="text-left text-xs text-dark-400 uppercase px-5 py-3">Source</th>
                <th className="text-center text-xs text-dark-400 uppercase px-5 py-3">Equifax</th>
                <th className="text-center text-xs text-dark-400 uppercase px-5 py-3">Experian</th>
                <th className="text-center text-xs text-dark-400 uppercase px-5 py-3">TransUnion</th>
                <th className="text-center text-xs text-dark-400 uppercase px-5 py-3">Avg</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {standaloneScores.map(card => {
                const avg = avgScore(card);
                return (
                  <tr key={card.id} className="table-row group">
                    <td className="px-5 py-3">
                      {editing?.id === card.id && editing.field === 'card_name' ? (
                        <input ref={inputRef} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} className="!py-1 !px-2 w-full max-w-xs" />
                      ) : (
                        <span className="text-dark-100 font-medium cursor-pointer hover:text-accent-hover transition-colors" onClick={() => startEdit(card, 'card_name')}>{card.card_name}</span>
                      )}
                    </td>
                    {['score_equifax', 'score_experian', 'score_transunion'].map(sk => (
                      <td key={sk} className="px-5 py-3 text-center">
                        {editing?.id === card.id && editing.field === sk ? (
                          <input ref={inputRef} type="number" min="300" max="850" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} className="!py-1 !px-2 w-20 text-center mx-auto" />
                        ) : (
                          <span className={`font-mono font-medium cursor-pointer hover:text-accent-hover transition-colors ${card[sk] != null ? scoreColor(card[sk]) : 'text-dark-500'}`} onClick={() => startEdit(card, sk)}>{card[sk] ?? '—'}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-center">{avg != null ? <span className={`font-mono font-bold ${scoreColor(avg)}`}>{avg}</span> : <span className="text-dark-500">—</span>}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => { if (confirm('Delete?')) deleteCard(card.id); }} className="opacity-0 group-hover:opacity-100 text-dark-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10"><TrashIcon /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <p className="text-dark-400 text-xs uppercase tracking-wider mb-3">Score Ranges</p>
        <div className="flex gap-4 flex-wrap text-sm">
          <span className="text-red-400">300–599 Very Poor</span>
          <span className="text-orange-400">600–649 Poor</span>
          <span className="text-yellow-400">650–699 Fair</span>
          <span className="text-green-300">700–749 Good</span>
          <span className="text-green-400">750–850 Excellent</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── PAY PERIODS PAGE ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function PayPeriodsPage({ payPeriods, payFilter, setPayFilter, editingPayId, setEditingPayId, editingPayValue, setEditingPayValue, payInputRef, tabNames }) {
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [cellValue, setCellValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [setupAmount, setSetupAmount] = useState('');
  const [editingEarned, setEditingEarned] = useState(false);
  const [earnedValue, setEarnedValue] = useState('');
  const cellRef = useRef(null);
  const earnedRef = useRef(null);

  useEffect(() => { if (editingCell && cellRef.current) { cellRef.current.focus(); cellRef.current.select(); } }, [editingCell]);
  useEffect(() => { if (editingEarned && earnedRef.current) { earnedRef.current.focus(); earnedRef.current.select(); } }, [editingEarned]);

  const ppIsPast = d => { const t = new Date(); t.setHours(0,0,0,0); return new Date(d + 'T00:00:00') < t; };
  const ppIsUpcoming = d => { const t = new Date(); t.setHours(0,0,0,0); const dd = new Date(d + 'T00:00:00'); const tw = new Date(t); tw.setDate(tw.getDate() + 14); return dd >= t && dd <= tw; };
  const ppYear = d => d.split('-')[0];
  const ppYears = [...new Set(payPeriods.map(p => ppYear(p.date)))].sort();
  const pastPP = payPeriods.filter(p => ppIsPast(p.date));
  const futurePP = payPeriods.filter(p => !ppIsPast(p.date));

  // Earned = per-period pay rate (from first period, or 0)
  const earnedPerPeriod = payPeriods.length > 0 ? payPeriods[0].amount : 0;
  const totalFuture = futurePP.reduce((s, p) => s + p.amount, 0);
  const totalPast = pastPP.reduce((s, p) => s + p.amount, 0);
  const totalAll = totalPast + totalFuture;

  let ppFiltered = payPeriods;
  if (payFilter === 'upcoming') ppFiltered = futurePP;
  else if (payFilter === 'past') ppFiltered = pastPP;
  else if (payFilter !== 'all') ppFiltered = payPeriods.filter(p => ppYear(p.date) === payFilter);
  const filteredTotal = ppFiltered.reduce((s, p) => {
    if (ppIsPast(p.date)) return s + (p.actual != null ? p.actual : p.amount);
    return s + p.amount;
  }, 0);

  // ── Cell edit commit ──
  const commitCellEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    if (field === 'amount' || field === 'actual') {
      const num = parseFloat(cellValue);
      if (!isNaN(num) && num >= 0) {
        updatePayPeriod(id, { [field]: num });
      } else if (field === 'actual' && cellValue.trim() === '') {
        // Clear actual to revert to expected
        updatePayPeriod(id, { actual: null });
      }
    } else if (field === 'date') {
      if (cellValue) updatePayPeriod(id, { date: cellValue });
    }
    setEditingCell(null);
  };

  const startCellEdit = (pp, field) => {
    const val = field === 'actual' ? (pp.actual != null ? String(pp.actual) : '') : String(pp[field] ?? '');
    setEditingCell({ id: pp.id, field });
    setCellValue(val);
  };

  const cellKeyDown = (e) => {
    if (e.key === 'Enter') commitCellEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  // ── Add pay period ──
  const handleAdd = () => {
    const amt = parseFloat(newAmount);
    if (!newDate || isNaN(amt)) return;
    addPayPeriod({ date: newDate, amount: amt });
    setNewDate('');
    setNewAmount('');
    setShowAddForm(false);
  };

  // ── Bulk update future amounts ──
  const handleSetupSave = () => {
    const amt = parseFloat(setupAmount);
    if (isNaN(amt) || amt < 0) return;
    updateAllPayPeriodDefaults(amt);
    setShowSetup(false);
    setSetupAmount('');
  };

  // ── Difference display (actual vs expected) ──
  const diffBadge = (pp) => {
    if (pp.actual == null || !ppIsPast(pp.date)) return null;
    const diff = pp.actual - pp.amount;
    if (diff === 0) return null;
    return (
      <span className={`text-xs font-mono ml-1 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
        ({diff > 0 ? '+' : ''}{fmt(diff)})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">{tabNames?.payperiods || 'Pay Periods'}</h1>
          <p className="text-dark-400 text-sm mt-1">Click any cell to edit · Tap Earned to log actual income</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSetup(!showSetup)} className="btn-ghost border border-dark-600 text-xs">⚙️ Set Default Pay</button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary"><PlusIcon /> Add Period</button>
        </div>
      </div>

      {/* Bulk set default pay amount */}
      {showSetup && (
        <div className="card flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-dark-400 uppercase tracking-wide font-medium block mb-1">Default Pay Amount</label>
            <p className="text-xs text-dark-500 mb-2">Updates all future pay periods to this amount</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">$</span>
              <input type="number" step="0.01" min="0" value={setupAmount} onChange={e => setSetupAmount(e.target.value)}
                placeholder="e.g. 2100" className="w-full pl-8" onKeyDown={e => { if (e.key === 'Enter') handleSetupSave(); }} />
            </div>
          </div>
          <button onClick={handleSetupSave} disabled={!setupAmount} className="btn-primary">Update All Future</button>
          <button onClick={() => setShowSetup(false)} className="btn-ghost">Cancel</button>
        </div>
      )}

      {/* Add new pay period */}
      {showAddForm && (
        <div className="card flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs text-dark-400 uppercase tracking-wide font-medium block mb-1">Pay Date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-dark-400 uppercase tracking-wide font-medium block mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">$</span>
              <input type="number" step="0.01" min="0" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" className="pl-8 w-32"
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
            </div>
          </div>
          <button onClick={handleAdd} disabled={!newDate || !newAmount} className="btn-primary">Add</button>
          <button onClick={() => setShowAddForm(false)} className="btn-ghost">Cancel</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-dark-400 text-xs uppercase mb-1">Total</p>
          <p className="text-xl font-bold text-dark-100">{fmt(totalAll)}</p>
          <p className="text-dark-500 text-xs">{payPeriods.length} periods</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-xs uppercase mb-1">Earned</p>
          {editingEarned ? (
            <input ref={earnedRef} type="number" step="0.01" min="0" value={earnedValue}
              onChange={e => setEarnedValue(e.target.value)}
              onBlur={() => {
                const num = parseFloat(earnedValue);
                if (!isNaN(num) && num >= 0) {
                  // Update ALL periods to this amount
                  updateAllPayPeriodDefaults(num);
                }
                setEditingEarned(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') setEditingEarned(false);
              }}
              className="!py-1 !px-2 w-full text-right"
            />
          ) : (
            <p className="text-xl font-bold text-green-400 cursor-pointer hover:text-accent-hover transition-colors"
              onClick={() => { setEditingEarned(true); setEarnedValue(String(earnedPerPeriod)); }}>{fmt(earnedPerPeriod)}</p>
          )}
          <p className="text-dark-500 text-xs">per period</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-xs uppercase mb-1">Remaining</p>
          <p className="text-xl font-bold text-dark-100">{fmt(totalFuture)}</p>
          <p className="text-dark-500 text-xs">{futurePP.length} periods</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-dark-600/50 overflow-x-auto">
        {[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }, { id: 'all', label: 'All' }, ...ppYears.map(y => ({ id: y, label: y }))].map(t => (
          <button key={t.id} onClick={() => setPayFilter(t.id)} className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${payFilter === t.id ? 'border-accent text-dark-100' : 'border-transparent text-dark-400 hover:text-dark-200'}`}>{t.label}</button>
        ))}
      </div>

      <p className="text-dark-400 text-sm">{ppFiltered.length} period{ppFiltered.length !== 1 ? 's' : ''} · {fmt(filteredTotal)} total</p>

      {/* Pay period table */}
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-dark-600/50">
              <th className="text-left text-xs text-dark-400 uppercase px-3 md:px-5 py-3">Date</th>
              <th className="text-right text-xs text-dark-400 uppercase px-3 md:px-5 py-3">Expected</th>
              <th className="text-right text-xs text-dark-400 uppercase px-3 md:px-5 py-3">Actual</th>
              <th className="text-left text-xs text-dark-400 uppercase px-3 md:px-5 py-3">Status</th>
              <th className="px-3 md:px-5 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {ppFiltered.map(pp => {
              const past = ppIsPast(pp.date);
              const upcoming = ppIsUpcoming(pp.date);
              return (
                <tr key={pp.id} className={`table-row group ${past && !pp.actual ? 'opacity-50' : past ? 'opacity-80' : ''} ${upcoming ? 'bg-green-500/5' : ''}`}>
                  {/* Date - editable */}
                  <td className="px-3 md:px-5 py-3">
                    {editingCell?.id === pp.id && editingCell.field === 'date' ? (
                      <input ref={cellRef} type="date" value={cellValue} onChange={e => setCellValue(e.target.value)} onBlur={commitCellEdit} onKeyDown={cellKeyDown} className="!py-1 !px-2" />
                    ) : (
                      <span className="cursor-pointer hover:text-accent-hover transition-colors" onClick={() => startCellEdit(pp, 'date')}>
                        <span className="text-dark-100">{fmtDate(pp.date)}</span>
                        {upcoming && <span className="ml-2 text-[10px] font-semibold text-green-400 uppercase tracking-wide">Upcoming</span>}
                      </span>
                    )}
                  </td>
                  {/* Expected amount - editable */}
                  <td className="px-3 md:px-5 py-3 text-right">
                    {editingCell?.id === pp.id && editingCell.field === 'amount' ? (
                      <input ref={cellRef} type="number" step="0.01" min="0" value={cellValue}
                        onChange={e => setCellValue(e.target.value)} onBlur={commitCellEdit} onKeyDown={cellKeyDown}
                        className="!py-1 !px-2 w-28 text-right ml-auto" />
                    ) : (
                      <span className="text-dark-300 font-mono cursor-pointer hover:text-accent-hover transition-colors"
                        onClick={() => startCellEdit(pp, 'amount')}>{fmt(pp.amount)}</span>
                    )}
                  </td>
                  {/* Actual earned - editable (key feature) */}
                  <td className="px-3 md:px-5 py-3 text-right">
                    {editingCell?.id === pp.id && editingCell.field === 'actual' ? (
                      <input ref={cellRef} type="number" step="0.01" min="0" value={cellValue}
                        onChange={e => setCellValue(e.target.value)} onBlur={commitCellEdit} onKeyDown={cellKeyDown}
                        placeholder="Enter actual"
                        className="!py-1 !px-2 w-28 text-right ml-auto" />
                    ) : (
                      <span className={`font-mono cursor-pointer hover:text-accent-hover transition-colors ${pp.actual != null ? 'text-green-400 font-semibold' : 'text-dark-500'}`}
                        onClick={() => startCellEdit(pp, 'actual')}>
                        {pp.actual != null ? fmt(pp.actual) : past ? '— click to log —' : '—'}
                        {diffBadge(pp)}
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-3 md:px-5 py-3">
                    {past && pp.actual != null ? <span className="badge bg-green-500/20 text-green-400">✓ Received</span>
                      : past ? <span className="badge bg-yellow-500/20 text-yellow-400 cursor-pointer" onClick={() => startCellEdit(pp, 'actual')}>Log Income</span>
                      : upcoming ? <span className="badge bg-blue-500/20 text-blue-400">Next</span>
                      : <span className="badge bg-dark-600 text-dark-300">Scheduled</span>}
                  </td>
                  {/* Delete */}
                  <td className="px-3 md:px-5 py-3 text-right">
                    <button onClick={() => { if (confirm('Delete this pay period?')) deletePayPeriod(pp.id); }}
                      className="opacity-0 group-hover:opacity-100 text-dark-500 hover:text-red-400 transition-all p-1 rounded hover:bg-red-500/10"><TrashIcon /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-dark-600">
              <td className="px-3 md:px-5 py-3 text-dark-300 font-semibold text-sm">Total</td>
              <td className="px-3 md:px-5 py-3 text-right"><span className="text-dark-300 font-mono">{fmt(ppFiltered.reduce((s, p) => s + p.amount, 0))}</span></td>
              <td className="px-3 md:px-5 py-3 text-right"><span className="text-green-400 font-mono font-bold">{fmt(filteredTotal)}</span></td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── SETTINGS PAGE ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function SettingsPage({ cards, payPeriods }) {
  const [importStatus, setImportStatus] = useState('');

  const handleExport = () => {
    const data = exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        importAll(text);
        setImportStatus('✅ Data imported successfully!');
        setTimeout(() => setImportStatus(''), 3000);
      } catch (err) {
        setImportStatus('❌ Import failed: ' + err.message);
        setTimeout(() => setImportStatus(''), 5000);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-dark-100">Settings</h1>

      <div className="card">
        <p className="text-sm font-semibold mb-3">Your Data</p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><p className="text-2xl font-bold">{cards.length}</p><p className="text-xs text-dark-400">Items</p></div>
          <div><p className="text-2xl font-bold">{payPeriods.length}</p><p className="text-xs text-dark-400">Pay Periods</p></div>
        </div>
      </div>

      <div className="card space-y-3">
        <p className="text-sm font-semibold">Backup & Restore</p>
        <p className="text-xs text-dark-400">Data is stored locally. Export a backup to keep it safe or transfer to another device.</p>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-primary flex-1 justify-center">📤 Export</button>
          <button onClick={handleImport} className="btn-ghost flex-1 justify-center border border-dark-600">📥 Import</button>
        </div>
        {importStatus && <p className="text-sm text-center">{importStatus}</p>}
      </div>

      <div className="card space-y-2">
        <p className="text-sm font-semibold">About</p>
        <div className="text-xs text-dark-400 space-y-1">
          <p>💾 All data stored locally on your device</p>
          <p>🔒 No accounts, no cloud, your data stays yours</p>
          <p>📲 Install as app: use your browser's "Add to Home Screen" or install icon</p>
        </div>
      </div>

      <div className="card space-y-3" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
        <p className="text-sm font-semibold text-red-400">Danger Zone</p>
        <button onClick={() => { if (confirm('⚠️ Delete ALL data? This cannot be undone.')) { localStorage.clear(); window.location.reload(); } }}
          className="btn-danger w-full justify-center">🗑️ Delete All Data</button>
      </div>

      <p className="text-xs text-dark-500 text-center pb-4">Made with ❤️ for Dad</p>
    </div>
  );
}
