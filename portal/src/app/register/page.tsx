'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types'

const ENTITY_TYPES: EntityType[] = ['vuc', 'mesto', 'mestska_cast', 'obec', 'zdruzenie']

interface OrgMatch {
  id: string
  name: string
  region: string | null
  district: string | null
  population: number | null
  entity_type: string
  claimed: boolean
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [entityType, setEntityType] = useState<EntityType | ''>('')
  const [ico, setIco] = useState('')
  const [orgMatch, setOrgMatch] = useState<OrgMatch | null>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // Search for org by IČO
  useEffect(() => {
    if (ico.length < 6) {
      setOrgMatch(null)
      setSearchError('')
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError('')

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, region, district, population, entity_type, claimed')
        .eq('reg_id', ico)
        .single()

      setSearching(false)

      if (error || !data) {
        setOrgMatch(null)
        setSearchError('Organizáciu sme nenašli. Skontrolujte IČO.')
        return
      }

      if (data.claimed) {
        setOrgMatch(null)
        setSearchError(
          'Táto organizácia je už zaregistrovaná. Kontaktujte administrátora.'
        )
        return
      }

      setOrgMatch(data)
    }, 400)

    return () => clearTimeout(timer)
  }, [ico, supabase])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!orgMatch) return
    setError('')
    setLoading(true)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { org_id: orgMatch.id, name },
      },
    })

    if (authError || !authData.user) {
      setError(authError?.message || 'Registrácia zlyhala.')
      setLoading(false)
      return
    }

    // 2. Create user record + claim org + create subscription via API
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: authData.user.id,
        email,
        name,
        org_id: orgMatch.id,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Registrácia zlyhala.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Registrácia samosprávy</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s <= step ? 'w-12 bg-blue-500' : 'w-8 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            {/* Entity type */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Typ organizácie
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ENTITY_TYPES.map((et) => (
                  <button
                    key={et}
                    type="button"
                    onClick={() => setEntityType(et)}
                    className={`px-4 py-2.5 rounded-lg text-sm border transition ${
                      entityType === et
                        ? 'border-blue-500 bg-blue-600/10 text-blue-400'
                        : 'border-gray-700 bg-[#111827] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {ENTITY_TYPE_LABELS[et]}
                  </button>
                ))}
              </div>
            </div>

            {/* IČO input */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">IČO</label>
              <input
                type="text"
                value={ico}
                onChange={(e) => setIco(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition font-mono"
                placeholder="00312941"
              />
            </div>

            {/* Search result */}
            {searching && (
              <p className="text-sm text-gray-500">Hľadám...</p>
            )}

            {searchError && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                {searchError}
              </div>
            )}

            {orgMatch && (
              <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4">
                <p className="font-medium text-green-400">{orgMatch.name}</p>
                <p className="text-sm text-gray-400 mt-1">
                  IČO: {ico} · {orgMatch.district && `Okres ${orgMatch.district} · `}
                  {orgMatch.region}
                  {orgMatch.population && ` · ${orgMatch.population.toLocaleString('sk-SK')} obyvateľov`}
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={!orgMatch || !entityType}
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition"
            >
              Pokračovať
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleRegister} className="space-y-4">
            {orgMatch && (
              <div className="bg-[#111827] border border-gray-800 rounded-lg p-4 mb-2">
                <p className="font-medium text-white">{orgMatch.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  IČO: {ico} · {orgMatch.region}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Vaše meno
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                placeholder="Ján Novák"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                placeholder="vas@email.sk"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Heslo</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                placeholder="Min. 6 znakov"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-700 text-gray-400 hover:text-white py-2.5 rounded-lg transition"
              >
                Späť
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
              >
                {loading ? 'Registrujem...' : 'Vytvoriť účet'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Už máte účet?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Prihlásiť sa
          </Link>
        </p>
      </div>
    </div>
  )
}
