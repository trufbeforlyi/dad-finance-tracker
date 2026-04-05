import { useState } from 'react';
import { exportAllData, importAllData, getTransactions, getCategories, getPayPeriods } from '../store';

export default function Settings() {
  const [importStatus, setImportStatus] = useState('');

  const txCount = getTransactions().length;
  const catCount = getCategories().length;
  const ppCount = getPayPeriods().length;

  const handleExport = () => {
    const data = exportAllData();
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
        importAllData(text);
        setImportStatus('✅ Data imported successfully!');
        setTimeout(() => setImportStatus(''), 3000);
      } catch (err) {
        setImportStatus('❌ Import failed: ' + err.message);
        setTimeout(() => setImportStatus(''), 5000);
      }
    };
    input.click();
  };

  const handleClearAll = () => {
    if (confirm('⚠️ Delete ALL data? This cannot be undone.\n\nTransactions, categories, pay periods — everything.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Data summary */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <p className="text-sm font-semibold mb-3">Your Data</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold">{txCount}</p>
            <p className="text-xs text-[var(--text-muted)]">Transactions</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{catCount}</p>
            <p className="text-xs text-[var(--text-muted)]">Categories</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{ppCount}</p>
            <p className="text-xs text-[var(--text-muted)]">Pay Periods</p>
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
        <p className="text-sm font-semibold">Backup & Restore</p>
        <p className="text-xs text-[var(--text-muted)]">
          Your data is stored locally on this device. Export a backup to keep it safe or transfer to another device.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] py-3 font-semibold text-white text-sm active:scale-[0.98] transition-all"
          >
            📤 Export Backup
          </button>
          <button
            onClick={handleImport}
            className="flex-1 rounded-xl border border-[var(--border)] py-3 font-semibold text-[var(--text-secondary)] text-sm active:opacity-80"
          >
            📥 Import Backup
          </button>
        </div>
        {importStatus && (
          <p className="text-sm text-center py-1">{importStatus}</p>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-2">
        <p className="text-sm font-semibold">About</p>
        <div className="text-xs text-[var(--text-muted)] space-y-1">
          <p>📱 Finance Tracker — Personal finance management</p>
          <p>💾 All data stored locally on your device</p>
          <p>🔒 No accounts, no cloud, your data stays yours</p>
          <p>📲 Install as app: use your browser's "Add to Home Screen"</p>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-[var(--red)]/30 bg-[var(--red)]/5 p-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--red)]">Danger Zone</p>
        <p className="text-xs text-[var(--text-muted)]">
          This will permanently delete all your data. Export a backup first!
        </p>
        <button
          onClick={handleClearAll}
          className="w-full rounded-xl border border-[var(--red)]/50 py-3 font-semibold text-[var(--red)] text-sm active:bg-[var(--red)]/10 transition-all"
        >
          🗑️ Delete All Data
        </button>
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center pb-4">
        Made with ❤️ for Dad
      </p>
    </div>
  );
}
