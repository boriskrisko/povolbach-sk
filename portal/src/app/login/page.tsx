'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const confirmed = searchParams.get('confirmed') === 'true'
  const supabase = useMemo(() => createClient(), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Nesprávny email alebo heslo.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Link href="/">
          <Logo className="text-2xl" />
        </Link>
        <p className="text-text-secondary mt-2 text-sm">Prihláste sa do portálu</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {confirmed && (
          <div className="bg-green-900/30 border border-green-800 text-green-400 text-sm px-4 py-3 rounded-lg">
            Email úspešne overený. Teraz sa môžete prihlásiť.
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition"
            placeholder="vas@email.sk"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Heslo</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
        >
          {loading ? 'Prihlasovanie...' : 'Prihlásiť sa'}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary/60 mt-6">
        Nemáte účet?{' '}
        <Link href="/register" className="text-accent hover:text-accent/80">
          Zaregistrovať sa
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
