'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ENTITY_TYPE_LABELS, type EntityType, type User } from '@/lib/types'

export default function SettingsPage() {
  const [profile, setProfile] = useState<
    | (User & {
        organizations: {
          name: string
          entity_type: EntityType
          reg_id: string
          region: string
          district: string
          population: number
        }
      })
    | null
  >(null)
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'none'>('weekly')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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
        setProfile(data as typeof profile)
        setFrequency(data.notification_frequency as typeof frequency)
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

  return (
    <div className="p-6 lg:p-10 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Nastavenia</h1>

      {/* Org profile */}
      <section className="bg-[#111827] border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Organizácia</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Názov</span>
            <span className="text-sm">{org.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">IČO</span>
            <span className="text-sm font-mono">{org.reg_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Typ</span>
            <span className="text-sm">
              {ENTITY_TYPE_LABELS[org.entity_type]}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Región</span>
            <span className="text-sm">{org.region}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Okres</span>
            <span className="text-sm">{org.district}</span>
          </div>
          {org.population && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Obyvatelia</span>
              <span className="text-sm">
                {org.population.toLocaleString('sk-SK')}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Account */}
      <section className="bg-[#111827] border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Účet</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm">{profile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Meno</span>
            <span className="text-sm">{profile.name || '—'}</span>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-[#111827] border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Notifikácie</h2>
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
          className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {saving ? 'Ukladám...' : saved ? 'Uložené ✓' : 'Uložiť'}
        </button>
      </section>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="text-sm text-red-400 hover:text-red-300 transition"
      >
        Odhlásiť sa
      </button>
    </div>
  )
}
