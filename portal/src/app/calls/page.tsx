import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CallCard from '@/components/CallCard'
import type { FundCall } from '@/lib/types'
import CallsFilter from './CallsFilter'

export default async function CallsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Get all matches with call data
  const { data: matches } = await supabase
    .from('call_matches')
    .select('*, fund_calls(*)')
    .eq('org_id', profile.org_id)
    .eq('dismissed', false)
    .order('relevance_score', { ascending: false })

  const matchesWithCalls =
    matches?.filter((m) => m.fund_calls) || []

  // Extract unique programs for filter
  const programs = [
    ...new Set(
      matchesWithCalls
        .map((m) => m.fund_calls?.program)
        .filter(Boolean) as string[]
    ),
  ]

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Výzvy pre vašu organizáciu</h1>

      <CallsFilter
        matches={matchesWithCalls}
        programs={programs}
      />
    </div>
  )
}
