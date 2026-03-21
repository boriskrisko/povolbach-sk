'use client';

import { useData } from '@/lib/DataContext';
import { t, type Locale } from '@/lib/translations';

interface Props {
  locale: Locale;
}

export default function Footer({ locale }: Props) {
  const { period } = useData();
  const tr = t[locale];

  return (
    <>
      <footer className="border-t border-[#1e1e2e] py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-[#94a3b8]">
            <span>
              <span className="text-[#3b82f6] font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>povolbach</span>
              <span>.sk</span>
            </span>
            <span className="hidden md:inline">·</span>
            <span>{period === '2127' ? tr.footer_data_2127 : tr.footer_data_1420}</span>
            <span className="hidden md:inline">·</span>
            <span>{tr.footer_updated}</span>
          </div>
          <p className="text-[#94a3b8]/60 text-xs mt-4">
            {tr.footer_disclaimer}
          </p>
        </div>
      </footer>
      {/* Fixed bug report button */}
      <a
        href="mailto:boris@povolbach.sk?subject=Nahlásenie chyby — povolbach.sk"
        className="fixed bottom-12 right-12 z-[60] px-4 py-2 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 shadow-lg transition-all"
      >
        {tr.report_bug}
      </a>
    </>
  );
}
