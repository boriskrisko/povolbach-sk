import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types'
import { formatEur, daysUntil, deadlineColor, formatDate } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user profile + org
  const { data: profile } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const org = profile.organizations as unknown as {
    name: string
    entity_type: EntityType
    region: string
    district: string
  }

  // Get matched calls
  const { data: matches } = await supabase
    .from('call_matches')
    .select('*, fund_calls(*)')
    .eq('org_id', profile.org_id)
    .eq('dismissed', false)
    .order('relevance_score', { ascending: false })
    .limit(5)

  const openMatches =
    matches?.filter((m) => m.fund_calls?.status === 'open') || []
  const totalOpen = openMatches.length

  // Find closest deadline
  const closestMatch = openMatches
    .filter((m) => m.fund_calls?.deadline)
    .sort(
      (a, b) =>
        new Date(a.fund_calls!.deadline!).getTime() -
        new Date(b.fund_calls!.deadline!).getTime()
    )[0]

  const closestDays = closestMatch
    ? daysUntil(closestMatch.fund_calls!.deadline)
    : null

  // Count new this week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const newThisWeek = openMatches.filter(
    (m) => new Date(m.created_at) > weekAgo
  ).length

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Org header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded text-xs font-medium">
            {ENTITY_TYPE_LABELS[org.entity_type]}
          </span>
          <span className="ml-2">
            {org.district && `Okres ${org.district} · `}
            {org.region}
          </span>
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Link
          href="/calls"
          className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition"
        >
          <p className="text-sm text-gray-400 mb-1">Otvorené výzvy pre vás</p>
          <p className="text-3xl font-bold text-green-400">{totalOpen}</p>
        </Link>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Najbližší deadline</p>
          {closestMatch ? (
            <>
              <p
                className={`text-xl font-bold ${deadlineColor(closestDays)}`}
              >
                {closestDays != null && closestDays > 0
                  ? `${closestDays} dní`
                  : 'Dnes!'}
              </p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {closestMatch.fund_calls!.title}
              </p>
            </>
          ) : (
            <p className="text-xl font-bold text-gray-600">—</p>
          )}
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Nové tento týždeň</p>
          <p className="text-3xl font-bold text-white">{newThisWeek}</p>
        </div>
      </div>

      {/* Recent matched calls */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Najrelevantnejšie výzvy</h2>
          <Link
            href="/calls"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Zobraziť všetky →
          </Link>
        </div>

        {openMatches.length === 0 ? (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-10 text-center">
            <p className="text-gray-500">
              Momentálne nemáte žiadne priradené výzvy.
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Nové výzvy kontrolujeme denne.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {openMatches.map((match) => {
              const call = match.fund_calls!
              const days = daysUntil(call.deadline)
              return (
                <Link
                  key={match.id}
                  href={`/calls/${call.id}`}
                  className="block bg-[#111827] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-white line-clamp-1">
                        {call.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {call.program}
                        {call.max_grant_eur &&
                          ` · Max. ${formatEur(call.max_grant_eur)}`}
                      </p>
                    </div>
                    {days != null && (
                      <span
                        className={`shrink-0 text-xs font-medium ${deadlineColor(days)}`}
                      >
                        {days > 0 ? `${days} dní` : 'Dnes'}
                      </span>
                    )}
                  </div>
                  {match.match_reasons && match.match_reasons.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {match.match_reasons.map((r: string) => (
                        <span
                          key={r}
                          className="text-xs bg-green-900/20 text-green-500 px-2 py-0.5 rounded-full"
                        >
                          {r} ✓
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
