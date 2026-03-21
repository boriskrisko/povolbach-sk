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
    <footer className="border-t border-[#1e1e2e] py-10 px-4">
      <div className="max-w-5xl mx-auto text-center">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-[#94a3b8]">
          <span>
            <span className="font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}><span className="text-[#3b82f6]">po</span><span className="text-[#ffffff]">volbach</span></span>
            <span className="text-[#6b7280]">.sk</span>
          </span>
          <span className="hidden md:inline">·</span>
          <span>{period === '21' ? tr.footer_data_21 : tr.footer_data_14}</span>
          <span className="hidden md:inline">·</span>
          <span>{tr.footer_updated}</span>
        </div>
        <p className="text-[#94a3b8]/60 text-xs mt-4">
          {tr.footer_disclaimer}
        </p>
        <div className="mt-4">
          <a
            href="mailto:boris@povolbach.sk?subject=Nahlásenie chyby — povolbach.sk"
            className="text-xs text-[#94a3b8]/50 hover:text-[#f8fafc] transition-colors"
          >
            {tr.report_bug}
          </a>
        </div>
      </div>
    </footer>
  );
}
