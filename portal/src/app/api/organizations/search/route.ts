import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const isNumeric = /^\d+$/.test(q)

  if (isNumeric) {
    // Search by IČO prefix
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, reg_id, entity_type, region, district, population, claimed')
      .like('reg_id', `${q}%`)
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data || [])
  }

  // Search by name — use ILIKE for case-insensitive, then filter client-side for diacritics
  // First try exact ILIKE
  const { data: exactData } = await supabase
    .from('organizations')
    .select('id, name, reg_id, entity_type, region, district, population, claimed')
    .ilike('name', `%${q}%`)
    .limit(10)

  if (exactData && exactData.length > 0) {
    return NextResponse.json(exactData)
  }

  // Fallback: fetch broader set and filter with diacritics removal
  const qNorm = removeDiacritics(q.toLowerCase())

  // Fetch by first 2 chars of normalized query to narrow down
  const { data: allData } = await supabase
    .from('organizations')
    .select('id, name, reg_id, entity_type, region, district, population, claimed')
    .limit(3000)

  const filtered = (allData || [])
    .filter((o) => removeDiacritics(o.name.toLowerCase()).includes(qNorm))
    .slice(0, 10)

  return NextResponse.json(filtered)
}
