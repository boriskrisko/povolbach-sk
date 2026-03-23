'use client'

import { useState, useMemo } from 'react'
import CallCard from '@/components/CallCard'
import type { FundCall, CallMatch } from '@/lib/types'

interface Props {
  matches: (CallMatch & { fund_calls: FundCall })[]
  programs: string[]
}

export default function CallsFilter({ matches, programs }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'all'>('open')
  const [programFilter, setProgramFilter] = useState('')
  const [deadlineFilter, setDeadlineFilter] = useState<
    'all' | 'month' | 'quarter'
  >('all')

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      const call = m.fund_calls
      if (!call) return false

      // Status
      if (statusFilter === 'open' && call.status !== 'open') return false

      // Program
      if (programFilter && call.program !== programFilter) return false

      // Deadline
      if (deadlineFilter !== 'all' && call.deadline) {
        const deadline = new Date(call.deadline)
        const now = new Date()
        if (deadlineFilter === 'month') {
          const monthFromNow = new Date()
          monthFromNow.setMonth(monthFromNow.getMonth() + 1)
          if (deadline > monthFromNow) return false
        } else if (deadlineFilter === 'quarter') {
          const quarterFromNow = new Date()
          quarterFromNow.setMonth(quarterFromNow.getMonth() + 3)
          if (deadline > quarterFromNow) return false
        }
      }

      // Search
      if (search) {
        const q = search.toLowerCase()
        if (
          !call.title.toLowerCase().includes(q) &&
          !call.program?.toLowerCase().includes(q) &&
          !call.managing_authority?.toLowerCase().includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [matches, search, statusFilter, programFilter, deadlineFilter])

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hľadať podľa názvu..."
          className="bg-[#111827] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition w-full sm:w-64"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'open' | 'all')}
          className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="open">Otvorené</option>
          <option value="all">Všetky</option>
        </select>

        <select
          value={deadlineFilter}
          onChange={(e) =>
            setDeadlineFilter(e.target.value as 'all' | 'month' | 'quarter')
          }
          className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="all">Všetky deadliny</option>
          <option value="month">Tento mesiac</option>
          <option value="quarter">Tento kvartál</option>
        </select>

        {programs.length > 0 && (
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            <option value="">Všetky programy</option>
            {programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Results */}
      <p className="text-sm text-gray-500 mb-4">
        {filtered.length} výziev
      </p>

      {filtered.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500">
            {matches.length === 0
              ? 'Zatiaľ nemáte priradené žiadne výzvy.'
              : 'Žiadne výzvy nezodpovedajú vašim filtrom.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((match) => (
            <CallCard
              key={match.id}
              call={match.fund_calls}
              matchReasons={match.match_reasons}
            />
          ))}
        </div>
      )}
    </div>
  )
}
