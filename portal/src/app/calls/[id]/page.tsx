import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { formatEur, formatDate, daysUntil, deadlineBadgeColor } from '@/lib/utils'
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types'
import EligibilityBadge from '@/components/EligibilityBadge'
import Link from 'next/link'

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user org
  const { data: profile } = await supabase
    .from('users')
    .select('org_id, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const org = profile.organizations as unknown as {
    entity_type: EntityType
    region: string
    population: number | null
    name: string
  }

  // Get call
  const { data: call } = await supabase
    .from('fund_calls')
    .select('*')
    .eq('id', id)
    .single()

  if (!call) notFound()

  const days = daysUntil(call.deadline)

  // Eligibility checks
  const checks = [
    {
      label: `Typ: ${ENTITY_TYPE_LABELS[org.entity_type]}`,
      matched: !call.eligible_entity_types?.length ||
        call.eligible_entity_types.includes(org.entity_type),
    },
    {
      label: `Región: ${org.region || 'N/A'}`,
      matched:
        (!call.eligible_regions?.length ||
          call.eligible_regions.includes(org.region)) &&
        (!call.excluded_regions?.length ||
          !call.excluded_regions.includes(org.region)),
    },
    {
      label: `Obyvatelia: ${org.population?.toLocaleString('sk-SK') || 'N/A'}`,
      matched:
        (!call.population_min || !org.population || org.population >= call.population_min) &&
        (!call.population_max || !org.population || org.population <= call.population_max),
    },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <Link
        href="/calls"
        className="text-sm text-gray-500 hover:text-gray-300 transition mb-4 inline-block"
      >
        ← Späť na výzvy
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-xl font-bold mb-2">{call.title}</h1>
          {call.code && (
            <p className="text-sm text-gray-500 font-mono">{call.code}</p>
          )}
        </div>
        {days != null && (
          <span
            className={`shrink-0 text-sm font-medium px-3 py-1.5 rounded-full ${deadlineBadgeColor(days)}`}
          >
            {days > 0 ? `${days} dní do uzávierky` : days === 0 ? 'Dnes!' : 'Uzavretá'}
          </span>
        )}
      </div>

      {/* Eligibility */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-3">
          Oprávnenosť pre {org.name}
        </h2>
        <div className="flex flex-wrap gap-2">
          {checks.map((check) => (
            <EligibilityBadge
              key={check.label}
              label={check.label}
              matched={check.matched}
            />
          ))}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {call.program && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Program</p>
            <p className="text-sm">{call.program}</p>
          </div>
        )}
        {call.managing_authority && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Riadiaci orgán</p>
            <p className="text-sm">{call.managing_authority}</p>
          </div>
        )}
        {call.allocation_eur && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Celková alokácia</p>
            <p className="text-sm font-medium">{formatEur(call.allocation_eur)}</p>
          </div>
        )}
        {call.max_grant_eur && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Max. grant</p>
            <p className="text-sm font-medium">{formatEur(call.max_grant_eur)}</p>
          </div>
        )}
        {call.min_grant_eur && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Min. grant</p>
            <p className="text-sm font-medium">{formatEur(call.min_grant_eur)}</p>
          </div>
        )}
        {call.cofinancing_rate != null && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Spolufinancovanie</p>
            <p className="text-sm font-medium">
              {(call.cofinancing_rate * 100).toFixed(0)}%
            </p>
          </div>
        )}
        {call.published_at && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Vyhlásená</p>
            <p className="text-sm">{formatDate(call.published_at)}</p>
          </div>
        )}
        {call.deadline && (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Uzávierka</p>
            <p className="text-sm font-medium">{formatDate(call.deadline)}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {call.description && (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Popis</h2>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {call.description}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        {call.source_url && (
          <a
            href={call.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition text-sm"
          >
            Otvoriť na ITMS →
          </a>
        )}
        <span className="text-sm text-gray-600 bg-gray-800/50 px-4 py-2.5 rounded-lg">
          Pripraviť žiadosť — čoskoro
        </span>
      </div>
    </div>
  )
}
