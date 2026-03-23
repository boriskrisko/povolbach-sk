import Link from 'next/link'
import Logo from './Logo'

export default function Header() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-text-secondary hover:text-text-primary transition"
          >
            Prihlásiť sa
          </Link>
          <Link
            href="/register"
            className="text-sm bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded-lg transition"
          >
            Registrácia
          </Link>
        </nav>
      </div>
    </header>
  )
}
