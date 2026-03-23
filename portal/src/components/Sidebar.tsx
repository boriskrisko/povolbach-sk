'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from './Logo'

const links = [
  { href: '/dashboard', label: 'Prehľad', icon: '📊' },
  { href: '/calls', label: 'Výzvy', icon: '📋' },
  { href: '/settings', label: 'Nastavenia', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-gray-800 bg-[#0a0a0a] min-h-screen flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-800">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => {
          const active = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                active
                  ? 'bg-blue-600/10 text-blue-400 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
