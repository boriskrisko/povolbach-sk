import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { user_id, email, name, org_id } = await request.json()

  if (!user_id || !email || !org_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Create user record
  const { error: userError } = await supabase.from('users').insert({
    id: user_id,
    email,
    name: name || null,
    org_id,
    role: 'admin',
  })

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  // Mark org as claimed
  const { error: orgError } = await supabase
    .from('organizations')
    .update({ claimed: true, updated_at: new Date().toISOString() })
    .eq('id', org_id)

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // Create free subscription
  const { error: subError } = await supabase.from('subscriptions').insert({
    org_id,
    tier: 'free',
    price_eur_monthly: 0,
  })

  if (subError) {
    console.error('Subscription creation error:', subError.message)
  }

  // Run eligibility matching for this org against all open calls
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', org_id)
    .single()

  if (org) {
    const { data: calls } = await supabase
      .from('fund_calls')
      .select('*')
      .eq('status', 'open')

    if (calls && calls.length > 0) {
      const matches = calls
        .filter((call) => {
          if (
            call.eligible_entity_types?.length &&
            !call.eligible_entity_types.includes(org.entity_type)
          ) {
            return false
          }
          if (
            call.eligible_regions?.length &&
            org.region &&
            !call.eligible_regions.includes(org.region)
          ) {
            return false
          }
          if (
            call.excluded_regions?.length &&
            org.region &&
            call.excluded_regions.includes(org.region)
          ) {
            return false
          }
          if (call.population_max && org.population && org.population > call.population_max) {
            return false
          }
          if (call.population_min && org.population && org.population < call.population_min) {
            return false
          }
          return true
        })
        .map((call) => {
          const reasons: string[] = []
          if (call.eligible_entity_types?.includes(org.entity_type)) {
            reasons.push(`Typ: ${org.entity_type}`)
          }
          if (call.eligible_regions?.includes(org.region)) {
            reasons.push(`Región: ${org.region}`)
          }
          if (call.population_min || call.population_max) {
            reasons.push(`Obyvatelia: ${org.population?.toLocaleString('sk-SK')}`)
          }
          return {
            org_id,
            call_id: call.id,
            relevance_score: 0.5 + reasons.length * 0.15,
            match_reasons: reasons.length > 0 ? reasons : ['Všeobecná výzva'],
          }
        })

      if (matches.length > 0) {
        await supabase.from('call_matches').insert(matches)
      }
    }
  }

  return NextResponse.json({ success: true })
}
