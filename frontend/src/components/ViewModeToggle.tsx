'use client';

import { t, type Locale } from '@/lib/translations';

type ViewMode = 'total' | 'capita';

interface Props {
  viewMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
  locale: Locale;
}

export default function ViewModeToggle({ viewMode, onToggle, locale }: Props) {
  const tr = t[locale];
  return (
    <div className="inline-flex rounded-lg border border-[#1e1e2e] overflow-hidden">
      <button
        onClick={() => onToggle('total')}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          viewMode === 'total'
            ? 'bg-[#3b82f6] text-white'
            : 'bg-[#13131a] text-[#94a3b8] hover:text-[#f8fafc]'
        }`}
      >
        {tr.toggle_total}
      </button>
      <button
        onClick={() => onToggle('capita')}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          viewMode === 'capita'
            ? 'bg-[#3b82f6] text-white'
            : 'bg-[#13131a] text-[#94a3b8] hover:text-[#f8fafc]'
        }`}
      >
        {tr.toggle_capita}
      </button>
    </div>
  );
}
