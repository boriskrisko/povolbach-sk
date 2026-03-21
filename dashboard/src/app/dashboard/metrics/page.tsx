'use client';

import { useState, useEffect } from 'react';

interface Metric {
  id: string;
  icon: string;
  label: string;
  actual: number;
  target: number;
}

const icons: Record<string, string> = {
  eye: '👁',
  building: '🏘',
  share: '🔗',
  newspaper: '📰',
  mail: '📨',
};

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetch('/api/metrics').then((r) => r.json()).then(setMetrics);
  }, []);

  async function saveMetric(id: string) {
    const val = parseInt(editValue, 10);
    if (isNaN(val)) return;
    const updated = metrics.map((m) =>
      m.id === id ? { ...m, actual: val } : m
    );
    setMetrics(updated);
    setEditing(null);
    await fetch('/api/metrics', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  function formatNum(n: number): string {
    return n.toLocaleString('en-US');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Phase 2 KPIs</h1>
      <p className="text-[#6b7280] mb-6">Launch & Distribution — Mar 22 to Apr 30</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const pct = m.target > 0 ? Math.min(100, Math.round((m.actual / m.target) * 100)) : 0;
          const isEditing = editing === m.id;

          return (
            <div
              key={m.id}
              className="bg-[#111827] border border-[#1f2937] rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{icons[m.icon] || '📊'}</span>
                <span className="text-sm text-[#9ca3af] font-medium">{m.label}</span>
              </div>

              <div className="flex items-baseline gap-2 mb-3">
                {isEditing ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveMetric(m.id)}
                    onKeyDown={(e) => e.key === 'Enter' && saveMetric(m.id)}
                    autoFocus
                    className="w-28 text-3xl font-mono font-bold bg-[#0a0a0a] border border-[#3b82f6] rounded px-2 py-0.5 text-white focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditing(m.id);
                      setEditValue(m.actual.toString());
                    }}
                    className="text-3xl font-mono font-bold text-white hover:text-[#3b82f6] transition-colors cursor-pointer"
                  >
                    {formatNum(m.actual)}
                  </button>
                )}
                <span className="text-sm text-[#6b7280]">/ {formatNum(m.target)}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[#1f2937] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#3b82f6] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-[#9ca3af] w-10 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
