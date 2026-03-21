'use client';

import { useState, useEffect } from 'react';

interface EvalEntry {
  id: string;
  date: string;
  energy: string;
  signal: string;
  traction: string;
  assumption: string;
  kill: string;
}

const CYCLE_START = new Date('2026-03-22');
const CYCLE_DAYS = 14;

const questions = [
  { key: 'energy', label: 'Energy Check', prompt: 'Am I still energized? What\'s draining me?' },
  { key: 'signal', label: 'Signal Check', prompt: 'What signals am I seeing from users/market?' },
  { key: 'traction', label: 'Traction Check', prompt: 'Are metrics moving? What\'s working?' },
  { key: 'assumption', label: 'Assumption Check', prompt: 'What assumption was wrong? What did I learn?' },
  { key: 'kill', label: 'Kill Criteria', prompt: 'Any reason to stop or pivot? Be honest.' },
];

function getNextCheckin(): Date {
  const now = new Date();
  const diff = now.getTime() - CYCLE_START.getTime();
  const daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24));
  const daysInCycle = daysPassed % CYCLE_DAYS;
  const daysUntilNext = CYCLE_DAYS - daysInCycle;
  const next = new Date(now);
  next.setDate(next.getDate() + daysUntilNext);
  return next;
}

function formatCountdown(target: Date): string {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today!';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default function EvalPage() {
  const [entries, setEntries] = useState<EvalEntry[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/evals').then((r) => r.json()).then(setEntries);
  }, []);

  const nextCheckin = getNextCheckin();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const entry = {
      date: new Date().toISOString().split('T')[0],
      ...form,
    };
    const res = await fetch('/api/evals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    setEntries([saved, ...entries]);
    setForm({});
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Bi-weekly Check-in</h1>
          <p className="text-[#6b7280]">Reflect, learn, decide.</p>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl px-5 py-3 text-center">
          <div className="text-sm text-[#6b7280]">Next check-in in</div>
          <div className="text-xl font-mono font-bold text-[#3b82f6]">
            {formatCountdown(nextCheckin)}
          </div>
          <div className="text-xs text-[#6b7280]">
            {nextCheckin.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 mb-8">
        <div className="space-y-5">
          {questions.map((q) => (
            <div key={q.key}>
              <label className="block text-sm font-semibold text-white mb-1">
                {q.label}
              </label>
              <p className="text-xs text-[#6b7280] mb-2">{q.prompt}</p>
              <textarea
                value={form[q.key] || ''}
                onChange={(e) => setForm({ ...form, [q.key]: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1f2937] rounded-lg text-[#d1d5db] text-sm focus:outline-none focus:border-[#3b82f6] resize-none"
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 px-6 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Check-in'}
        </button>
      </form>

      {/* History */}
      {entries.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Past Check-ins</h2>
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-[#111827] border border-[#1f2937] rounded-xl p-5"
              >
                <div className="text-sm font-mono text-[#6b7280] mb-3">{entry.date}</div>
                <div className="space-y-3">
                  {questions.map((q) => {
                    const val = entry[q.key as keyof EvalEntry];
                    if (!val) return null;
                    return (
                      <div key={q.key}>
                        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">
                          {q.label}
                        </span>
                        <p className="text-sm text-[#d1d5db] mt-0.5">{val}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
