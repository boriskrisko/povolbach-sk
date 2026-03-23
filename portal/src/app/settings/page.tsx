'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ENTITY_TYPE_LABELS,
  type EntityType,
  type User,
  type Invitation,
} from '@/lib/types'

type Profile = User & {
  organizations: {
    name: string
    entity_type: EntityType
    reg_id: string
    region: string
    district: string
    population: number
  }
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'none'>(
    'weekly'
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'org' | 'users' | 'notifications'>('org')
  const [orgUsers, setOrgUsers] = useState<User[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('users')
        .select('*, organizations(*)')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
        setFrequency(data.notification_frequency as typeof frequency)

        // Load org users
        const { data: users } = await supabase
          .from('users')
          .select('*')
          .eq('org_id', data.org_id)
          .order('created_at')
        if (users) setOrgUsers(users)

        // Load invitations
        const { data: invs } = await supabase
          .from('invitations')
          .select('*')
          .eq('org_id', data.org_id)
          .order('created_at', { ascending: false })
        if (invs) setInvitations(invs)
      }
    }
    load()
  }, [supabase, router])

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    setSaved(false)

    await supabase
      .from('users')
      .update({ notification_frequency: frequency })
      .eq('id', profile.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!profile) {
    return (
      <div className="p-6 lg:p-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    )
  }

  const org = profile.organizations
  const isAdmin = profile.role === 'admin'

  return (
    <div className="p-6 lg:p-10 max-w-2xl">
      <h1 className="font-display text-2xl font-bold mb-6">Nastavenia</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1 border border-border">
        {(
          [
            { id: 'org', label: 'Organizácia' },
            ...(isAdmin ? [{ id: 'users', label: 'Používatelia' }] : []),
            { id: 'notifications', label: 'Notifikácie' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex-1 text-sm py-2 rounded-md transition ${
              tab === t.id
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Org tab */}
      {tab === 'org' && (
        <>
          <section className="bg-surface border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-medium text-text-secondary mb-4">
              Organizácia
            </h2>
            <div className="space-y-3">
              {[
                ['Názov', org.name],
                ['IČO', org.reg_id, true],
                ['Typ', ENTITY_TYPE_LABELS[org.entity_type]],
                ['Región', org.region],
                ['Okres', org.district],
                ...(org.population
                  ? [['Obyvatelia', org.population.toLocaleString('sk-SK')]]
                  : []),
              ].map(([label, value, mono]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-sm text-text-secondary/60">
                    {label}
                  </span>
                  <span className={`text-sm ${mono ? 'font-mono' : ''}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-medium text-text-secondary mb-4">
              Účet
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary/60">Email</span>
                <span className="text-sm">{profile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary/60">Meno</span>
                <span className="text-sm">{profile.name || '—'}</span>
              </div>
              {profile.phone && (
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary/60">
                    Telefón
                  </span>
                  <span className="text-sm">{profile.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary/60">Rola</span>
                <span className="text-sm">
                  {profile.role === 'admin'
                    ? 'Administrátor'
                    : profile.role === 'editor'
                      ? 'Editor'
                      : 'Čitateľ'}
                </span>
              </div>
            </div>
          </section>

          <button
            onClick={handleLogout}
            className="text-sm text-red-400 hover:text-red-300 transition"
          >
            Odhlásiť sa
          </button>
        </>
      )}

      {/* Users tab (admin only) */}
      {tab === 'users' && isAdmin && (
        <>
          <section className="bg-surface border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-medium text-text-secondary mb-4">
              Používatelia ({orgUsers.length})
            </h2>
            <div className="space-y-3">
              {orgUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm text-text-primary">
                      {u.name || u.email}
                    </p>
                    <p className="text-xs text-text-secondary">{u.email}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      u.role === 'admin'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-border text-text-secondary'
                    }`}
                  >
                    {u.role === 'admin'
                      ? 'Admin'
                      : u.role === 'editor'
                        ? 'Editor'
                        : 'Čitateľ'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-text-secondary mb-4">
              Pozvánky
            </h2>
            {invitations.length === 0 ? (
              <p className="text-sm text-text-secondary/60">
                Žiadne aktívne pozvánky.
              </p>
            ) : (
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-mono text-text-primary">
                        {inv.code}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Použitia: {inv.used_count}/{inv.max_uses}
                        {inv.status !== 'active' && (
                          <span className="ml-2 text-amber-400">
                            ({inv.status})
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        inv.used_count < inv.max_uses &&
                        inv.status === 'active'
                          ? 'bg-success/10 text-success'
                          : 'bg-border text-text-secondary'
                      }`}
                    >
                      {inv.used_count < inv.max_uses &&
                      inv.status === 'active'
                        ? 'Aktívna'
                        : 'Vyčerpaná'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-text-secondary mb-4">
            Frekvencia notifikácií
          </h2>
          <div className="space-y-2">
            {(['daily', 'weekly', 'none'] as const).map((f) => (
              <label
                key={f}
                className="flex items-center gap-3 cursor-pointer py-1"
              >
                <input
                  type="radio"
                  name="frequency"
                  value={f}
                  checked={frequency === f}
                  onChange={() => setFrequency(f)}
                  className="accent-blue-500"
                />
                <span className="text-sm">
                  {f === 'daily' && 'Denne'}
                  {f === 'weekly' && 'Týždenne'}
                  {f === 'none' && 'Vypnuté'}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            {saving ? 'Ukladám...' : saved ? 'Uložené ✓' : 'Uložiť'}
          </button>
        </section>
      )}
    </div>
  )
}
