import { useState, useEffect } from 'react';

export default function LiveCountdown({ dateStr }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const now = new Date();
  const due = new Date(dateStr + 'T23:59:59');
  const diff = due.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const secs = Math.floor((abs % 60000) / 1000);

  if (diff < 0) return <span className="text-red-400 text-xs ml-1 font-mono">(-{days}d {hours}h {mins}m {secs}s)</span>;

  let cls = 'text-dark-400';
  if (days === 0) cls = 'text-red-400';
  else if (days <= 3) cls = 'text-yellow-400';
  else if (days <= 7) cls = 'text-blue-400';

  return <span className={`${cls} text-xs ml-1 font-mono`}>({days}d {hours}h {mins}m {secs}s)</span>;
}
