'use client';

import { useState, useEffect, useCallback } from 'react';
import { phases, type Phase } from '@/lib/phases';

const statusColors: Record<string, string> = {
  completed: 'bg-[#22c55e]',
  active: 'bg-[#f59e0b]',
  upcoming: 'bg-[#6b7280]',
};

const statusLabels: Record<string, string> = {
  completed: 'Completed',
  active: 'Active',
  upcoming: 'Upcoming',
};

function isOverdue(due?: string): boolean {
  if (!due) return false;
  return new Date(due) < new Date() && new Date(due).toDateString() !== new Date().toDateString();
}

export default function TimelinePage() {
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>({});
  const [gateStates, setGateStates] = useState<Record<string, boolean>>({});
  const [expandedPhase, setExpandedPhase] = useState<number | null>(2);

  useEffect(() => {
    fetch('/api/tasks').then((r) => r.json()).then(setTaskStates);
    fetch('/api/gates').then((r) => r.json()).then(setGateStates);
  }, []);

  // Pre-check all Phase 0+1 tasks
  const getTaskChecked = useCallback(
    (taskId: string, phaseId: number) => {
      if (phaseId === 0) return true;
      return taskStates[taskId] || false;
    },
    [taskStates]
  );

  const toggleTask = async (taskId: string) => {
    const updated = { ...taskStates, [taskId]: !taskStates[taskId] };
    setTaskStates(updated);
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const toggleGate = async (gateId: string) => {
    const updated = { ...gateStates, [gateId]: !gateStates[gateId] };
    setGateStates(updated);
    await fetch('/api/gates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  function getProgress(phase: Phase): number {
    if (phase.id === 0) return 100;
    const total = phase.tasks.length + phase.gates.length;
    if (total === 0) return 0;
    const done =
      phase.tasks.filter((t) => taskStates[t.id]).length +
      phase.gates.filter((g) => gateStates[g.id]).length;
    return Math.round((done / total) * 100);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white mb-6">Roadmap Timeline</h1>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-[#1f2937]" />

        {phases.map((phase) => {
          const progress = getProgress(phase);
          const expanded = expandedPhase === phase.id;

          return (
            <div key={phase.id} className="relative pl-16 pb-6">
              {/* Dot */}
              <div
                className={`absolute left-[18px] top-3 w-5 h-5 rounded-full border-2 border-[#0a0a0a] ${statusColors[phase.status]}`}
              />

              {/* Phase card */}
              <div
                className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 cursor-pointer hover:border-[#374151] transition-colors"
                onClick={() => setExpandedPhase(expanded ? null : phase.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[#6b7280] text-sm font-medium">{phase.label}</span>
                    <h2 className="text-lg font-semibold text-white">{phase.title}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#6b7280] text-sm">{phase.dates}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${statusColors[phase.status]}`}
                    >
                      {statusLabels[phase.status]}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        phase.status === 'completed' ? 'bg-[#22c55e]' : 'bg-[#3b82f6]'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono text-[#9ca3af] w-10 text-right">
                    {progress}%
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="mt-3 bg-[#111827] border border-[#1f2937] rounded-xl p-5 space-y-4">
                  {/* Tasks */}
                  {phase.tasks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
                        Tasks
                      </h3>
                      <div className="space-y-2">
                        {phase.tasks.map((task) => {
                          const checked = getTaskChecked(task.id, phase.id);
                          const overdue = !checked && isOverdue(task.due);
                          return (
                            <label
                              key={task.id}
                              className="flex items-center gap-3 group cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => phase.id !== 0 && toggleTask(task.id)}
                                disabled={phase.id === 0}
                                className="w-4 h-4 rounded border-[#374151] bg-[#0a0a0a] text-[#3b82f6] focus:ring-0 focus:ring-offset-0 accent-[#3b82f6]"
                              />
                              <span
                                className={`text-sm flex-1 ${
                                  checked ? 'text-[#6b7280] line-through' : 'text-[#d1d5db]'
                                }`}
                              >
                                {task.label}
                              </span>
                              {task.week && (
                                <span className="text-xs text-[#6b7280] bg-[#1f2937] px-2 py-0.5 rounded">
                                  {task.week}
                                </span>
                              )}
                              {task.due && (
                                <span
                                  className={`text-xs font-mono ${
                                    overdue ? 'text-[#ef4444] font-semibold' : 'text-[#6b7280]'
                                  }`}
                                >
                                  {overdue && '! '}
                                  {task.due}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Gates */}
                  {phase.gates.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
                        Gates
                      </h3>
                      <div className="space-y-2">
                        {phase.gates.map((gate) => (
                          <label
                            key={gate.id}
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={gateStates[gate.id] || false}
                              onChange={() => toggleGate(gate.id)}
                              className="w-4 h-4 rounded border-[#374151] bg-[#0a0a0a] text-[#22c55e] focus:ring-0 focus:ring-offset-0 accent-[#22c55e]"
                            />
                            <span
                              className={`text-sm ${
                                gateStates[gate.id] ? 'text-[#22c55e]' : 'text-[#d1d5db]'
                              }`}
                            >
                              {gate.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
