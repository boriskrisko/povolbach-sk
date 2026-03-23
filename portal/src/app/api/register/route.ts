import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { user_id, email, name, phone, org_id, invitation_code } =
    await request.json()

  if (!user_id || !email || !org_id || !invitation_code) {
    return NextResponse.json(
      { error: 'Chýbajú povinné údaje.' },
      { status: 400 }
    )
  }

  // 1. Validate invitation code
  const { data: invitation, error: invErr } = await supabase
    .from('invitations')
    .select('*')
    .eq('code', invitation_code)
    .eq('status', 'active')
    .single()

  if (invErr || !invitation) {
    return NextResponse.json(
      { error: 'Neplatný kód pozvánky.' },
      { status: 400 }
    )
  }

  if (invitation.org_id !== org_id) {
    return NextResponse.json(
      { error: 'Kód pozvánky nepatrí k tejto organizácii.' },
      { status: 400 }
    )
  }

  if (invitation.used_count >= invitation.max_uses) {
    return NextResponse.json(
      { error: 'Kód pozvánky bol už použitý.' },
      { status: 400 }
    )
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Kód pozvánky vypršal.' },
      { status: 400 }
    )
  }

  // 2. Determine role — first user for org = admin, subsequent = viewer
  const { count: existingUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org_id)

  const role = (existingUsers ?? 0) === 0 ? 'admin' : 'viewer'

  // 3. Create user record
  const { error: userError } = await supabase.from('users').insert({
    id: user_id,
    email,
    name: name || null,
    phone: phone || null,
    org_id,
    role,
  })

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  // 4. Increment invitation used_count
  await supabase
    .from('invitations')
    .update({ used_count: invitation.used_count + 1 })
    .eq('id', invitation.id)

  // 5. Mark org as claimed (if first user)
  if (role === 'admin') {
    await supabase
      .from('organizations')
      .update({ claimed: true, updated_at: new Date().toISOString() })
      .eq('id', org_id)

    // Create free subscription
    await supabase.from('subscriptions').insert({
      org_id,
      tier: 'free',
      price_eur_monthly: 0,
    })
  }

  // 6. Run eligibility matching for this org against all open calls
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
          )
            return false
          if (
            call.eligible_regions?.length &&
            org.region &&
            !call.eligible_regions.includes(org.region)
          )
            return false
          if (
            call.excluded_regions?.length &&
            org.region &&
            call.excluded_regions.includes(org.region)
          )
            return false
          if (
            call.population_max &&
            org.population &&
            org.population > call.population_max
          )
            return false
          if (
            call.population_min &&
            org.population &&
            org.population < call.population_min
          )
            return false
          return true
        })
        .map((call) => {
          const reasons: string[] = []
          if (call.eligible_entity_types?.includes(org.entity_type))
            reasons.push(`Typ: ${org.entity_type}`)
          if (call.eligible_regions?.includes(org.region))
            reasons.push(`Región: ${org.region}`)
          if (call.population_min || call.population_max)
            reasons.push(
              `Obyvatelia: ${org.population?.toLocaleString('sk-SK')}`
            )
          return {
            org_id,
            call_id: call.id,
            relevance_score: 0.5 + reasons.length * 0.15,
            match_reasons: reasons.length > 0 ? reasons : ['Všeobecná výzva'],
          }
        })

      if (matches.length > 0) {
        // Upsert to avoid conflicts if matching was already run
        await supabase.from('call_matches').upsert(matches, {
          onConflict: 'org_id,call_id',
        })
      }
    }
  }

  return NextResponse.json({ success: true, role })
}
