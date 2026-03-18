'use client';

import { useData } from '@/lib/DataContext';

export default function Footer() {
  const { period } = useData();

  return (
    <footer className="border-t border-[#1e1e2e] py-10 px-4">
      <div className="max-w-5xl mx-auto text-center">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-[#94a3b8]">
          <span>
            <span className="text-[#3b82f6] font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>povolbach</span>
            <span>.sk</span>
          </span>
          <span className="hidden md:inline">·</span>
          <span>Dáta: {period === '2127' ? 'ITMS2021+ Open Data' : 'ITMS2014+ Open Data'}</span>
          <span className="hidden md:inline">·</span>
          <span>Aktualizované: marec 2026</span>
        </div>
        <p className="text-[#94a3b8]/60 text-xs mt-4">
          Projekt nie je financovaný ani podporovaný žiadnou politickou stranou.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          {/* GitHub */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
            aria-label="GitHub"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          {/* Email */}
          <a
            href="mailto:info@povolbach.sk"
            className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
            aria-label="Email"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
