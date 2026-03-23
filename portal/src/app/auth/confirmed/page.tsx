import Link from 'next/link'
import Logo from '@/components/Logo'

export default function ConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
        </div>

        <div className="w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-bold mb-3">
          Email úspešne potvrdený
        </h1>
        <p className="text-text-secondary mb-8">
          Váš účet je aktívny. Teraz sa môžete prihlásiť.
        </p>

        <Link
          href="/login"
          className="inline-block bg-accent hover:bg-accent/80 text-white font-medium px-8 py-3 rounded-xl transition"
        >
          Prihlásiť sa
        </Link>
      </div>
    </div>
  )
}
