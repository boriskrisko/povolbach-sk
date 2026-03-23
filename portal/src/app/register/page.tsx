'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types'
import { removeDiacritics } from '@/lib/utils'

interface OrgResult {
  id: string
  name: string
  reg_id: string
  region: string | null
  district: string | null
  population: number | null
  entity_type: EntityType
  claimed: boolean
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)

  // Step 1: search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrgResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<OrgResult | null>(null)
  const [searchError, setSearchError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Step 2: details
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Search organizations by IČO or name
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      setSearchError('')
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError('')

      const isNumeric = /^\d+$/.test(query)

      let data: OrgResult[] | null = null

      if (isNumeric) {
        // Search by IČO prefix
        const { data: d } = await supabase
          .from('organizations')
          .select('id, name, reg_id, region, district, population, entity_type, claimed')
          .like('reg_id', `${query}%`)
          .limit(10)
        data = d
      } else {
        // Search by name — fetch broader set and filter client-side for diacritics flexibility
        const q = removeDiacritics(query.toLowerCase())
        const { data: d } = await supabase
          .from('organizations')
          .select('id, name, reg_id, region, district, population, entity_type, claimed')
          .limit(2000)
        data = d?.filter((o) =>
          removeDiacritics(o.name.toLowerCase()).includes(q)
        )?.slice(0, 10) || null
      }

      setSearching(false)

      if (data && data.length > 0) {
        setResults(data)
        setShowDropdown(true)
      } else {
        setResults([])
        setShowDropdown(false)
        setSearchError('Organizáciu sme nenašli. Skúste iné IČO alebo názov.')
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, supabase])

  function selectOrg(org: OrgResult) {
    if (org.claimed) {
      setSearchError(
        'Táto samospráva je už zaregistrovaná. Kontaktujte administrátora vašej organizácie.'
      )
      setShowDropdown(false)
      return
    }
    setSelectedOrg(org)
    setShowDropdown(false)
    setQuery('')
    setSearchError('')
  }

  function clearSelection() {
    setSelectedOrg(null)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOrg) return
    setError('')
    setLoading(true)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { org_id: selectedOrg.id, name },
      },
    })

    if (authError || !authData.user) {
      setError(authError?.message || 'Registrácia zlyhala.')
      setLoading(false)
      return
    }

    // 2. Create user record + validate invitation via API
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: authData.user.id,
        email,
        name,
        phone: phone || null,
        org_id: selectedOrg.id,
        invitation_code: inviteCode,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Registrácia zlyhala.')
      // Clean up auth user on failure
      setLoading(false)
      return
    }

    router.push(`/register/verify?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <p className="text-text-secondary mt-2 text-sm">Registrácia samosprávy</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s <= step ? 'w-12 bg-accent' : 'w-8 bg-border'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {!selectedOrg ? (
              <>
                {/* Search input */}
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setShowDropdown(true)}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition text-sm"
                    placeholder="Zadajte IČO alebo názov samosprávy..."
                    autoFocus
                  />
                  {searching && (
                    <div className="absolute right-3 top-3.5 text-text-secondary text-xs">
                      Hľadám...
                    </div>
                  )}

                  {/* Results dropdown */}
                  {showDropdown && results.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                      {results.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => selectOrg(org)}
                          className={`w-full text-left px-4 py-3 hover:bg-border/50 transition border-b border-border last:border-b-0 ${
                            org.claimed ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-primary">
                              {org.name}
                            </span>
                            {org.claimed && (
                              <span className="text-xs text-amber-400 shrink-0 ml-2">
                                Registrovaná
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            IČO: {org.reg_id}
                            {org.district && ` · Okres ${org.district}`}
                            {org.region && ` · ${org.region}`}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {searchError && (
                  <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                    {searchError}
                  </div>
                )}
              </>
            ) : (
              /* Selected org confirmation card */
              <div className="bg-surface border border-success/30 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-success">✓</span>
                      <span className="font-display font-semibold text-text-primary">
                        {selectedOrg.name}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary space-y-0.5 ml-6">
                      <p>
                        IČO: <span className="font-mono">{selectedOrg.reg_id}</span>
                      </p>
                      <p>
                        {selectedOrg.district && `Okres ${selectedOrg.district} · `}
                        {selectedOrg.region}
                      </p>
                      {selectedOrg.population && (
                        <p>
                          Obyvatelia:{' '}
                          {selectedOrg.population.toLocaleString('sk-SK')}
                        </p>
                      )}
                      <p>
                        Typ:{' '}
                        {ENTITY_TYPE_LABELS[selectedOrg.entity_type]}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs text-accent hover:text-accent/80 transition shrink-0"
                  >
                    Zmeniť
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedOrg}
              onClick={() => setStep(2)}
              className="w-full bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition"
            >
              Pokračovať
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Org summary */}
            {selectedOrg && (
              <div className="bg-surface border border-border rounded-lg p-4 mb-2">
                <p className="font-medium text-text-primary text-sm">
                  {selectedOrg.name}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  IČO: {selectedOrg.reg_id} · {selectedOrg.region}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Meno a priezvisko
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition"
                placeholder="Ján Novák"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Email
              </label>
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
              <label className="block text-sm text-text-secondary mb-1.5">
                Telefónne číslo{' '}
                <span className="text-text-secondary/50">(nepovinné)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition"
                placeholder="+421 9XX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Heslo
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition"
                placeholder="Min. 6 znakov"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Kód pozvánky
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent transition font-mono tracking-wider"
                placeholder="OBEC-2026-XXXX"
              />
              <p className="text-xs text-text-secondary/50 mt-1">
                Kód pozvánky ste dostali od administrátora alebo od nás.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-border text-text-secondary hover:text-text-primary py-2.5 rounded-lg transition"
              >
                Späť
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
              >
                {loading ? 'Registrujem...' : 'Zaregistrovať sa'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-text-secondary/60 mt-6">
          Už máte účet?{' '}
          <Link href="/login" className="text-accent hover:text-accent/80">
            Prihlásiť sa
          </Link>
        </p>
      </div>
    </div>
  )
}
