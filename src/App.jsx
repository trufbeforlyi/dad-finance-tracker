import { useState, useEffect, useSyncExternalStore } from 'react';
import { subscribe } from './store';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import PayPeriods from './pages/PayPeriods';
import Settings from './pages/Settings';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: '📊' },
  { id: 'transactions', label: 'Log', icon: '💸' },
  { id: 'categories', label: 'Tags', icon: '🏷️' },
  { id: 'pay', label: 'Pay', icon: '💰' },
  { id: 'settings', label: 'More', icon: '⚙️' },
];

function useStoreRefresh() {
  // Forces re-render when store changes
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  useStoreRefresh();

  const renderPage = () => {
    switch (tab) {
      case 'dashboard': return <Dashboard onNavigate={setTab} />;
      case 'transactions': return <Transactions />;
      case 'categories': return <Categories />;
      case 'pay': return <PayPeriods />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setTab} />;
    }
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {renderPage()}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[var(--bg-secondary)] z-50">
        <div className="max-w-lg mx-auto flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center py-2 pt-3 transition-colors ${
                tab === t.id
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)] active:text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="text-[10px] mt-1 font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
