'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', label: 'Timeline' },
  { href: '/dashboard/metrics', label: 'Metrics' },
  { href: '/dashboard/eval', label: 'Check-in' },
  { href: '/dashboard/stories', label: 'Stories' },
  { href: '/dashboard/contacts', label: 'Contacts' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1f2937]">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight shrink-0" style={{ fontFamily: 'var(--font-syne)', letterSpacing: '-0.5px' }}>
          <span className="text-[#94a3b8]">dev.</span>
          <span className="text-[#3b82f6]">po</span>
          <span className="text-[#f8fafc]">volbach</span>
          <span className="text-[#94a3b8]">.sk</span>
        </Link>
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active =
              tab.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#1f2937] text-white'
                    : 'text-[#9ca3af] hover:text-white hover:bg-[#111827]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
